/**
 * One back-button stack for the whole app. Pushed screens and sheets register
 * a handler while mounted; the Android back button (and Escape on the web)
 * calls the top one. With nothing registered, the fallback runs.
 */
const handlers: (() => void)[] = []
/** App-level default (e.g. minimise on Android). */
let baseFallback: (() => void) | null = null
/** Screen-level default (e.g. "go to Today" from another tab). */
let fallback: (() => void) | null = null

export function pushBackHandler(fn: () => void): () => void {
  handlers.push(fn)
  return () => {
    const i = handlers.lastIndexOf(fn)
    if (i >= 0) handlers.splice(i, 1)
  }
}

export function setBackFallback(fn: (() => void) | null): void {
  fallback = fn
}

export function setBaseBackFallback(fn: (() => void) | null): void {
  baseFallback = fn
}

export function handleBack(): void {
  const top = handlers.at(-1)
  if (top) top()
  else if (fallback) fallback()
  else baseFallback?.()
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && handlers.length) handleBack()
  })
}
