package com.themepark.locationtracker;

import ch.hsr.geohash.GeoHash;
import org.junit.Test;

public class GeoHashTest {

    @Test
    public void testGeoHashLatLong() {
//        28.419309, -81.577516
        String hash = GeoHash.geoHashStringWithCharacterPrecision(28.419309, -81.577516, 6);
        System.out.println(hash);
    }
}
