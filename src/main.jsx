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

import './styles/tokens.css'
import './styles/base.css'
import './components/ui/ui.css'
import './components/layout/layout.css'
import './pages/pages.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
