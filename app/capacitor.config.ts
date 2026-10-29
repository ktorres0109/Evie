import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.ktorres0109.cycle',
  appName: 'Meztli',
  webDir: 'dist',
  backgroundColor: '#14111C',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#14111C',
    allowMixedContent: false,
  },
  plugins: {
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#14111C',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#14111C',
      overlaysWebView: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_meztli',
      iconColor: '#8B6BE8',
    },
  },
}

export default config
