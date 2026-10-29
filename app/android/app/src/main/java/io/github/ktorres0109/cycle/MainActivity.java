package io.github.ktorres0109.cycle;

import android.app.Activity;
import android.content.Context;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MeztliNativePlugin.class);
        super.onCreate(savedInstanceState);
        boolean hide = getSharedPreferences(MeztliNativePlugin.PRIVACY_PREFS, Context.MODE_PRIVATE)
            .getBoolean(MeztliNativePlugin.PRIVACY_SCREEN_KEY, true);
        applyPrivacyScreen(this, hide);
        WidgetRefreshJobService.schedule(this);
    }

    static void applyPrivacyScreen(Activity activity, boolean enabled) {
        if (enabled) {
            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        } else {
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }
}
