package com.themepark.locationtracker.events.kinesis;
import com.google.gson.*;
import com.google.gson.internal.Streams;
import com.google.gson.stream.JsonReader;
import org.joda.time.DateTime;

import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;


public abstract class Event {
    private static final String TYPE_FIELD = "type";

    private static final Gson gson = new GsonBuilder()
            .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
            .registerTypeAdapter(DateTime.class, (JsonDeserializer<DateTime>) (json, typeOfT, context) -> new DateTime(json.getAsString()))
            .create();

    public static Event parseEvent(byte[] event) {
        //parse the event payload and remove the type attribute
        JsonReader jsonReader =  new JsonReader(new InputStreamReader(new ByteArrayInputStream(event)));
        JsonElement jsonElement = Streams.parse(jsonReader);
        JsonElement labelJsonElement = jsonElement.getAsJsonObject().remove(TYPE_FIELD);

        if (labelJsonElement == null) {
            throw new IllegalArgumentException("Event does not define a type field: " + new String(event));
        }

        //convert json to POJO, based on the type attribute
        switch (labelJsonElement.getAsString()) {
            case "watermark":
                return gson.fromJson(jsonElement, WatermarkEvent.class);
            case "location":
                return gson.fromJson(jsonElement, LocationEvent.class);
            default:
                throw new IllegalArgumentException("Found unsupported event type: " + labelJsonElement.getAsString());
        }
    }

    public abstract long getTimestamp();
}