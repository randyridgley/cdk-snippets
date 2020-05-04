package com.themepark.locationtracker.events.kinesis;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.joda.time.DateTime;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LocationEvent extends Event {
    private String locationId;
    private String entitlementId;
    private String detailType;
    private DateTime time;
    private String detail;

    @Override
    public long getTimestamp() {
        return time.getMillis();
    }
}