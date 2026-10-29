import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Keyboard } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { handleBack, setBaseBackFallback } from '../lib/back'

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

  setBaseBackFallback(() => void NativeApp.minimizeApp())
  await NativeApp.addListener('backButton', () => handleBack())

  await SplashScreen.hide({ fadeOutDuration: 260 })
}

export async function nativeTap(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!isNative) return
  await Haptics.impact({ style }).catch(() => undefined)
}

/** Light or dark system-bar icons to match Night/Day Bloom. */
export async function setSystemBarColors(theme: 'night' | 'day'): Promise<void> {
  if (!isNative) return
  await StatusBar.setStyle({ style: theme === 'day' ? Style.Light : Style.Dark }).catch(() => undefined)
}

/** Medium impact, used only on destructive confirmation (spec §06). */
export async function destructiveTap(): Promise<void> {
  await nativeTap(ImpactStyle.Medium)
}
