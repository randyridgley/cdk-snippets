package com.themepark.locationtracker.events.kinesis;

import org.joda.time.DateTime;


public class WatermarkEvent extends Event {
    public final DateTime watermark;

    public WatermarkEvent() {
        this.watermark = DateTime.now();
    }

    @Override
    public long getTimestamp() {
        return watermark.getMillis();
    }
}
