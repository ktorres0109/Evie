import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.ktorres0109.cycle',
  appName: 'Meztli',
  webDir: 'dist',
  backgroundColor: '#fff8fa',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#fff8fa',
    allowMixedContent: false,
  },
  plugins: {
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#fff8fa',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#fff8fa',
      overlaysWebView: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_meztli',
      iconColor: '#f35f7f',
    },
  },
}

export default config
