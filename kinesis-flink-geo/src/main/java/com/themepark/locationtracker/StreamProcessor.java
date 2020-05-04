/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * This file has been extended from the Apache Flink project skeleton.
 *
 */

package com.themepark.locationtracker;

import com.themepark.locationtracker.events.DDBEvent;
import com.themepark.locationtracker.events.kinesis.Event;
import com.themepark.locationtracker.events.kinesis.LocationEvent;
import com.themepark.locationtracker.events.RegionEvent;
import com.themepark.locationtracker.utils.DynamoDBStreamSchema;
import com.themepark.locationtracker.utils.EventSchema;
import com.themepark.locationtracker.utils.ParameterToolUtils;

import java.util.Properties;

import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.api.common.state.MapStateDescriptor;
import org.apache.flink.api.common.typeinfo.BasicTypeInfo;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.java.utils.ParameterTool;
import org.apache.flink.kinesis.shaded.com.amazonaws.regions.Regions;
import org.apache.flink.kinesis.shaded.com.amazonaws.services.dynamodbv2.model.Record;
import org.apache.flink.streaming.api.TimeCharacteristic;
import org.apache.flink.streaming.api.datastream.BroadcastStream;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.sink.SinkFunction;
import org.apache.flink.streaming.api.functions.source.SourceFunction;
import org.apache.flink.streaming.api.functions.timestamps.BoundedOutOfOrdernessTimestampExtractor;
import org.apache.flink.streaming.api.windowing.time.Time;
import org.apache.flink.streaming.connectors.kinesis.FlinkDynamoDBStreamsConsumer;
import org.apache.flink.streaming.connectors.kinesis.FlinkKinesisConsumer;
import org.apache.flink.streaming.connectors.kinesis.FlinkKinesisProducer;
import org.apache.flink.streaming.connectors.kinesis.config.AWSConfigConstants;
import org.apache.flink.streaming.connectors.kinesis.config.ConsumerConfigConstants;
import org.apache.flink.streaming.api.functions.co.KeyedBroadcastProcessFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class StreamProcessor {
    private static final Logger LOG = LoggerFactory.getLogger(StreamProcessor.class);

    private static final String DEFAULT_REGION_NAME = Regions.getCurrentRegion() == null ? "us-west-2"
            : Regions.getCurrentRegion().getName();

    public static void main(String[] args) throws Exception {
        ParameterTool parameter = ParameterToolUtils.fromArgsAndApplicationProperties(args);

        // set up the streaming execution environment
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.setStreamTimeCharacteristic(TimeCharacteristic.EventTime);
        env.enableCheckpointing(5000);

        DataStream<LocationEvent> events;

        if (parameter.has("InputKinesisStream")) {
            LOG.info("Reading from {} Kinesis stream", parameter.get("InputKinesisStream"));

            events = env.addSource(getKinesisSource(parameter))
                    .name("Kinesis source")
                    .assignTimestampsAndWatermarks(new BoundedOutOfOrdernessTimestampExtractor<Event>(Time.seconds(10)) {
                        @Override
                        public long extractTimestamp(Event element) {
                            return element.getTimestamp();
                        }
                    })
                    .filter(event -> LocationEvent.class.isAssignableFrom(event.getClass()))
                    .map(event -> (LocationEvent) event);
            events.print();
        } else {
            throw new RuntimeException(
                    "Missing runtime parameters: Specify 'InputKinesisStreamName' as a parameters to the Flink job");
        }

        DataStream<Record> ddbStream;

        if (parameter.has("DynamoDBConfigStream")) {
            ddbStream = env.addSource(getDDBStreamSource(parameter))
                    .name("DDB Config source")
                    .map(event -> DDBEvent.builder().build());

            ddbStream.print();
        } else {
            throw new RuntimeException(
                    "Missing runtime parameters: Specify 'DynamoDBConfigStream' as a parameters to the Flink job");
        }

        DataStream<RegionEvent> regionStream = events
                .keyBy(LocationEvent::getLocationId)
                .connect(ddbStream.keyBy(DDBEvent::getLocationId))
                .process(new RegionJoinFunction())
                .addSink(getKinesisSink(parameter))
                .name("Kinesis region output");

        env.execute();
    }

    private static SourceFunction<Record> getDDBStreamSource(ParameterTool parameter) {
        String streamName = parameter.getRequired("DynamoDBConfigStream");
        String region = parameter.get("ConfigStreamRegion", DEFAULT_REGION_NAME);

        // set Kinesis consumer properties
        Properties ddbConsumerConfig = new Properties();
        // set the region the DDB stream is located in
        ddbConsumerConfig.setProperty(AWSConfigConstants.AWS_REGION, region);
        // obtain credentials through the DefaultCredentialsProviderChain, which
        // includes the instance metadata
        ddbConsumerConfig.setProperty(AWSConfigConstants.AWS_CREDENTIALS_PROVIDER, "AUTO");

        return new FlinkDynamoDBStreamsConsumer<>(
                streamName,
                new DynamoDBStreamSchema(),
                ddbConsumerConfig);
    }

    private static SourceFunction<Event> getKinesisSource(ParameterTool parameter) {
        String streamName = parameter.getRequired("InputKinesisStream");
        String region = parameter.get("InputStreamRegion", DEFAULT_REGION_NAME);
        String initialPosition = parameter.get("InputStreamInitialPosition",
                ConsumerConfigConstants.DEFAULT_STREAM_INITIAL_POSITION);

        // set Kinesis consumer properties
        Properties kinesisConsumerConfig = new Properties();
        // set the region the Kinesis stream is located in
        kinesisConsumerConfig.setProperty(AWSConfigConstants.AWS_REGION, region);
        // obtain credentials through the DefaultCredentialsProviderChain, which
        // includes the instance metadata
        kinesisConsumerConfig.setProperty(AWSConfigConstants.AWS_CREDENTIALS_PROVIDER, "AUTO");
        // poll new events from the Kinesis stream once every second
        kinesisConsumerConfig.setProperty(ConsumerConfigConstants.SHARD_GETRECORDS_INTERVAL_MILLIS, "1000");

        kinesisConsumerConfig.setProperty(ConsumerConfigConstants.STREAM_INITIAL_POSITION, initialPosition);

        return new FlinkKinesisConsumer<>(streamName, new EventSchema(), kinesisConsumerConfig);
    }

    private static SinkFunction<RegionEvent> getKinesisSink(ParameterTool parameter) {
        String streamName = parameter.getRequired("OutputKinesisStream");
        String region = parameter.get("OutputStreamRegion", DEFAULT_REGION_NAME);

        Properties properties = new Properties();
        properties.setProperty(AWSConfigConstants.AWS_REGION, region);
        properties.setProperty(AWSConfigConstants.AWS_CREDENTIALS_PROVIDER, "AUTO");

        FlinkKinesisProducer<RegionEvent> producer = new FlinkKinesisProducer(new SimpleStringSchema(), properties);
        producer.setFailOnError(true);
        producer.setDefaultStream(streamName);
        producer.setDefaultPartition("0");

        return producer;
    }

    public static class RegionJoinFunction extends KeyedBroadcastProcessFunction<Long, LocationEvent, DDBEvent, RegionEvent> {

        @Override
        public void processElement(LocationEvent value, ReadOnlyContext ctx, Collector<RegionEvent> out) throws Exception {

        }

        @Override
        public void processBroadcastElement(DDBEvent value, Context ctx, Collector<RegionEvent> out) throws Exception {

        }
    }
}