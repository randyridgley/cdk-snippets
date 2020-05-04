package com.themepark.locationtracker.events;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.joda.time.DateTime;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegionEvent {
    private String locationId;
    private String entitlementId;
    private String detailType;
    private DateTime time;
    private String region;
}