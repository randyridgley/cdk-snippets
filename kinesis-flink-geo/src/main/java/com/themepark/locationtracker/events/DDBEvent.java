package com.themepark.locationtracker.events;

import com.google.gson.JsonElement;
import com.google.gson.internal.Streams;
import com.google.gson.stream.JsonReader;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DDBEvent {
    private String locationId;

    public static DDBEvent parseEvent(byte[] event) {
        //parse the event payload and remove the type attribute
        JsonReader jsonReader =  new JsonReader(new InputStreamReader(new ByteArrayInputStream(event)));
        JsonElement jsonElement = Streams.parse(jsonReader);
        System.out.println(jsonElement.getAsString());
//        JsonElement labelJsonElement = jsonElement.getAsJsonObject().remove(TYPE_FIELD);
//
//        if (labelJsonElement == null) {
//            throw new IllegalArgumentException("Event does not define a type field: " + new String(event));
//        }
        return DDBEvent.builder().build();
    }
}
