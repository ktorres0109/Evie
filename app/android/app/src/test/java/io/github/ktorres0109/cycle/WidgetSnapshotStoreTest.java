package io.github.ktorres0109.cycle;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class WidgetSnapshotStoreTest {
    @Test
    public void advancesTheDayCount() {
        assertEquals("Day 14", WidgetSnapshotStore.countedHeadline("Day {n}", 14, "2026-11-02", "2026-11-02"));
        assertEquals("Day 17", WidgetSnapshotStore.countedHeadline("Day {n}", 14, "2026-11-02", "2026-11-05"));
        assertEquals("Día 16", WidgetSnapshotStore.countedHeadline("Día {n}", 14, "2026-10-31", "2026-11-02"));
    }

    @Test
    public void crossesDaylightSavingAndYearEnd() {
        assertEquals(2, WidgetSnapshotStore.daysBetween("2026-03-07", "2026-03-09"));
        assertEquals(1, WidgetSnapshotStore.daysBetween("2026-12-31", "2027-01-01"));
    }

    @Test
    public void givesUpWhenThereIsNothingToCount() {
        assertNull(WidgetSnapshotStore.countedHeadline("", 14, "2026-11-02", "2026-11-03"));
        assertNull(WidgetSnapshotStore.countedHeadline("Day {n}", 0, "2026-11-02", "2026-11-03"));
        assertNull(WidgetSnapshotStore.countedHeadline("Day {n}", 14, "2026-11-05", "2026-11-03"));
        assertNull(WidgetSnapshotStore.countedHeadline("Day {n}", 14, "2026-09-01", "2026-11-03"));
        assertNull(WidgetSnapshotStore.countedHeadline("Day {n}", 14, "garbage", "2026-11-03"));
    }
}
