package com.themepark.locationtracker.utils;

import com.themepark.locationtracker.events.DDBEvent;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.java.typeutils.TypeExtractor;
import org.apache.flink.api.common.serialization.DeserializationSchema;

public class DDBEventSchema implements DeserializationSchema<DDBEvent> {

    @Override
    public DDBEvent deserialize(byte[] bytes) {
        return DDBEvent.parseEvent(bytes);
    }

    @Override
    public boolean isEndOfStream(DDBEvent event) {
        return false;
    }

    @Override
    public TypeInformation<DDBEvent> getProducedType() {
        return TypeExtractor.getForClass(DDBEvent.class);
    }

}