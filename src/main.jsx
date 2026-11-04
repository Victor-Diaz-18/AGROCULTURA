import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fonts are bundled (not loaded from Google) so they also work without signal.
import '@fontsource/bricolage-grotesque/latin-600.css'
import '@fontsource/bricolage-grotesque/latin-700.css'
import '@fontsource/nunito-sans/latin-400.css'
import '@fontsource/nunito-sans/latin-600.css'
import '@fontsource/nunito-sans/latin-700.css'
import '@fontsource/nunito-sans/latin-800.css'
import '@fontsource/ibm-plex-mono/latin-500.css'

import 'leaflet/dist/leaflet.css'
import './styles/tokens.css'
import './styles/base.css'
import './components/ui/ui.css'
import './components/layout/layout.css'
import './components/auth/auth.css'
import './components/map/map.css'
import './components/tell/tell.css'
import './components/story/story.css'
import './components/admin/admin.css'
import './pages/pages.css'

import App from './App.jsx'
import { watchForUpdates } from './offline/updates.js'

watchForUpdates() // registers the service worker (the built app only) and listens for new versions

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
