import { getMeztliNativeBridge } from './bridge'
import { isNative } from './runtime'

interface PrivacyPlugin {
  setPrivacyScreen(options: { enabled: boolean }): Promise<void>
}

const plugin = getMeztliNativeBridge<PrivacyPlugin>()

/** Hide app content in the app switcher (Android also blocks screenshots). */
export async function setPrivacyScreen(enabled: boolean): Promise<void> {
  if (!isNative) return
  await plugin.setPrivacyScreen({ enabled }).catch(() => undefined)
}
