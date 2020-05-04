package com.themepark.locationtracker.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.java.typeutils.TypeExtractor;
import org.apache.flink.kinesis.shaded.com.amazonaws.services.dynamodbv2.model.Record;

import java.io.IOException;

public class DynamoDBStreamSchema implements DeserializationSchema<Record> {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Record deserialize(byte[] message) throws IOException {
        return MAPPER.readValue(message, Record.class);
    }

    @Override
    public boolean isEndOfStream(Record nextElement) {
        return false;
    }

    @Override
    public TypeInformation<Record> getProducedType() {
        return TypeExtractor.getForClass(Record.class);
    }
}
