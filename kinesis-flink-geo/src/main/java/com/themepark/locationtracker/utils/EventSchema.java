package com.themepark.locationtracker.utils;

import com.themepark.locationtracker.events.kinesis.Event;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.java.typeutils.TypeExtractor;
import org.apache.flink.api.common.serialization.DeserializationSchema;


public class EventSchema implements DeserializationSchema<Event> {

    @Override
    public Event deserialize(byte[] bytes) {
        return Event.parseEvent(bytes);
    }

    @Override
    public boolean isEndOfStream(Event event) {
        return false;
    }

    @Override
    public TypeInformation<Event> getProducedType() {
        return TypeExtractor.getForClass(Event.class);
    }
}
