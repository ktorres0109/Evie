package io.github.ktorres0109.cycle;

import android.content.Context;
import android.content.SharedPreferences;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

final class WidgetSnapshotStore {
    static final String REFRESH_ACTION = "io.github.ktorres0109.cycle.WIDGET_REFRESH";
    private static final String PREFERENCES = "meztli.widget.v1";
    private static final String SNAPSHOT_KEY = "cycle-widget-snapshot-v1";

    private WidgetSnapshotStore() {}

    static void save(Context context, JSCompatibleSnapshot snapshot) {
        preferences(context).edit().putString(SNAPSHOT_KEY, snapshot.json).apply();
    }

    static void clear(Context context) {
        preferences(context).edit().remove(SNAPSHOT_KEY).apply();
    }

    static Snapshot read(Context context) {
        String json = preferences(context).getString(SNAPSHOT_KEY, null);
        if (json == null) return Snapshot.empty();
        try {
            JSONObject object = new JSONObject(json);
            String headline = object.optString("headline", "").trim();
            String detail = object.optString("detail", "").trim();
            if (headline.isEmpty()) return Snapshot.empty();
            // The day count moves on even when the app isn't opened.
            String counted = countedHeadline(
                object.optString("headlineTemplate", ""),
                object.optInt("cycleDay", 0),
                object.optString("anchorDate", ""),
                today()
            );
            return new Snapshot(counted != null ? counted : headline, detail);
        } catch (Exception ignored) {
            return Snapshot.empty();
        }
    }

    /** Days the template may be carried forward before the app must refresh it. */
    static final int MAX_CARRY_DAYS = 45;

    /**
     * "Day {n}" advanced from the day it was written to `today` (both
     * yyyy-MM-dd, local). Null when there is nothing to count or it's too old.
     */
    static String countedHeadline(String template, int cycleDay, String anchorDate, String today) {
        if (template == null || !template.contains("{n}") || cycleDay < 1) return null;
        long days = daysBetween(anchorDate, today);
        if (days < 0 || days > MAX_CARRY_DAYS) return null;
        return template.replace("{n}", String.valueOf(cycleDay + days));
    }

    static long daysBetween(String from, String to) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            f.setLenient(false);
            return Math.round((f.parse(to).getTime() - f.parse(from).getTime()) / 86400000.0);
        } catch (ParseException | NullPointerException e) {
            return -1;
        }
    }

    private static String today() {
        Calendar c = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    static final class JSCompatibleSnapshot {
        final String json;

        JSCompatibleSnapshot(String json) {
            this.json = json;
        }
    }

    static final class Snapshot {
        final String headline;
        final String detail;

        Snapshot(String headline, String detail) {
            this.headline = headline;
            this.detail = detail;
        }

        static Snapshot empty() {
            return new Snapshot("Open Evie", "Log today to see your cycle at a glance.");
        }
    }
}
