import { AuthProvider } from './context/AuthContext.jsx'
import { PortalDataProvider } from './context/PortalDataContext.jsx'
import { SpeechProvider } from './context/SpeechContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

/** Everything the pages share. Must live inside a Router (speech stops on page change). */
export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <SpeechProvider>
        <AuthProvider>
          <PortalDataProvider>{children}</PortalDataProvider>
        </AuthProvider>
      </SpeechProvider>
    </ToastProvider>
  )
}
