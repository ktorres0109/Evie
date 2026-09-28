import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Keyboard } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNative = Capacitor.isNativePlatform()
export const nativePlatform = Capacitor.getPlatform()

/**
 * Keep the React application platform-agnostic while the native shells own
 * operating-system concerns. Every call is guarded so the browser build
 * remains a useful development surface.
 */
export async function initializeNativeRuntime(): Promise<void> {
  document.documentElement.dataset.runtime = isNative ? nativePlatform : 'web'
  if (!isNative) return

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setOverlaysWebView({ overlay: true }),
    Keyboard.setAccessoryBarVisible({ isVisible: true }),
  ])

  await NativeApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) history.back()
    else void NativeApp.minimizeApp()
  })

  await SplashScreen.hide({ fadeOutDuration: 260 })
}

export async function nativeTap(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!isNative) return
  await Haptics.impact({ style }).catch(() => undefined)
}
