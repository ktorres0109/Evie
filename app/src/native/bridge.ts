import { registerPlugin } from '@capacitor/core'

const meztliNativeBridge = registerPlugin('MeztliNative')

/**
 * Returns the single shared Capacitor proxy with a feature-specific type.
 * Keeping registration here avoids duplicate-plugin warnings when multiple
 * native service modules are imported together.
 */
export function getMeztliNativeBridge<T extends object>(): T {
  return meztliNativeBridge as unknown as T
}
