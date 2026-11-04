import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StartupErrorBoundary } from './components/StartupErrorBoundary'
import { useLocale } from './i18n'
import { initializeNativeRuntime } from './native/runtime'
import './styles/base.css'
import './styles/app.css'
import './styles/health-import.css'

// Retire service workers left behind by pre-native development builds. Evie
// no longer registers a PWA or depends on service-worker caching.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined)
}

document.documentElement.lang = useLocale.getState().locale

// Her history lives only on this phone. Ask the system not to evict it under
// storage pressure; a refusal changes nothing, so the result is ignored.
void navigator.storage?.persist?.().catch(() => undefined)

void initializeNativeRuntime()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StartupErrorBoundary>
      <App />
    </StartupErrorBoundary>
  </React.StrictMode>,
)
