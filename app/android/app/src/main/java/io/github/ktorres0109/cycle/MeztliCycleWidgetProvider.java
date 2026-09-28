package io.github.ktorres0109.cycle;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public final class MeztliCycleWidgetProvider extends AppWidgetProvider {
    @Override
    public void onEnabled(Context context) {
        WidgetRefreshJobService.schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefreshJobService.cancel(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        render(context, manager, appWidgetIds);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (WidgetSnapshotStore.REFRESH_ACTION.equals(intent.getAction())) updateAll(context);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
            new ComponentName(context, MeztliCycleWidgetProvider.class)
        );
        render(context, manager, ids);
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        WidgetSnapshotStore.Snapshot snapshot = WidgetSnapshotStore.read(context);
        Intent openIntent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openApp = PendingIntent.getActivity(
            context,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.meztli_cycle_widget);
            views.setTextViewText(R.id.widget_headline, snapshot.headline);
            views.setTextViewText(
                R.id.widget_detail,
                snapshot.detail.isEmpty() ? "Tap to check in" : snapshot.detail
            );
            views.setOnClickPendingIntent(R.id.widget_root, openApp);
            manager.updateAppWidget(id, views);
        }
    }
}
