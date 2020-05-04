package com.themepark.locationtracker;

import ch.hsr.geohash.GeoHash;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Region {
    private String locationId;
    private List<GeoHash> region;
}
