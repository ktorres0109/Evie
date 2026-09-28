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
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#14111C',
      overlaysWebView: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_meztli',
      iconColor: '#f35f7f',
    },
  },
}

export default config
