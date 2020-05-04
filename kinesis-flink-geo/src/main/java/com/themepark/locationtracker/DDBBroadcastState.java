package com.themepark.locationtracker;

import com.themepark.locationtracker.events.RegionEvent;
import com.themepark.locationtracker.events.kinesis.LocationEvent;
import org.apache.flink.api.common.state.MapStateDescriptor;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.java.utils.ParameterTool;
import org.apache.flink.kinesis.shaded.com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import org.apache.flink.kinesis.shaded.com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import org.apache.flink.kinesis.shaded.com.amazonaws.services.dynamodbv2.model.AttributeValue;
import org.apache.flink.kinesis.shaded.com.amazonaws.services.dynamodbv2.model.ScanRequest;
import org.apache.flink.kinesis.shaded.com.amazonaws.services.dynamodbv2.model.ScanResult;
import org.apache.flink.streaming.api.functions.co.BroadcastProcessFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class DDBBroadcastState extends BroadcastProcessFunction<LocationEvent, RegionUpdate, RegionEvent> {
    private static final Logger log = LoggerFactory.getLogger(DDBBroadcastState.class);

    public static final MapStateDescriptor<String, Region> mapStateDescriptor =
            new MapStateDescriptor<String, Region>("regionConfiguration", TypeInformation.of(String.class), TypeInformation.of(Region.class));

    private List<Integer> bufferedValues;

    public DDBBroadcastState(ParameterTool parameter) {
        super();
        log.debug("DDBBroadcastState()");
        this.bufferedValues = new ArrayList<>();

        String tableName = parameter.getRequired("DynamoDBTable");
        AmazonDynamoDB client = AmazonDynamoDBClientBuilder.standard().build();

        ScanRequest scanRequest = new ScanRequest()
                .withTableName(tableName);

        ScanResult result = client.scan(scanRequest);
        for(Map<String, AttributeValue> item : result.getItems()) {
            try {
                getRuntimeContext().getMapState(mapStateDescriptor).put(item.get("locationId").getS(), Region.builder()
                        .locationId(item.get("locationId").getS())
                        .build());
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void processElement(LocationEvent value, ReadOnlyContext ctx, Collector<RegionEvent> collector) throws Exception {
        log.debug("processElement({})", value);
        Region region = ctx.getBroadcastState(mapStateDescriptor).get(value.getLocationId());
        if (region == null) {
            // need to do buffering here
//                log.debug("\n\nRegion value missing: {}\n\n", number);
//                bufferedValues.add(number);
        } else {
            log.debug("Checking buffer");
//                if (!bufferedValues.isEmpty()) {
//                    for (Integer nr : bufferedValues) {
//                        log.debug("Handling buffered value: {}", nr);
//                        collector.collect(Integer.toString(factor * nr));
//                    }
//                }
            //do region lookup of ddb table regions add to region event convert
            collector.collect(RegionEvent.builder().build());
        }
    }

    @Override
    public void processBroadcastElement(RegionUpdate value, Context ctx, Collector<RegionEvent> out) throws Exception {
        log.debug("processBroadcastElement({})", value);
        try {
            log.debug("multiply factor set to {}", value);
            ctx.getBroadcastState(mapStateDescriptor).put(value.getLocationId(), Region.builder().build());
        } catch (NumberFormatException e) {
            log.warn("Could not parse '{}' to Integer, state unchanged.", value);
        }
    }
}