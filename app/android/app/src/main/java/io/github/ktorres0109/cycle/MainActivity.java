package io.github.ktorres0109.cycle;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MeztliNativePlugin.class);
        super.onCreate(savedInstanceState);
        WidgetRefreshJobService.schedule(this);
    }
}
