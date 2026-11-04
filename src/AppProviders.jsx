import LoginModal from './components/auth/LoginModal.jsx'
import ConnectivityToasts from './components/layout/ConnectivityToasts.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { MyStoriesProvider } from './context/MyStoriesContext.jsx'
import { PortalDataProvider } from './context/PortalDataContext.jsx'
import { SpeechProvider } from './context/SpeechContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

/** Everything the pages share. Must live inside a Router (speech stops on page change). */
export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <ConnectivityToasts />
      <SpeechProvider>
        <AuthProvider>
          <PortalDataProvider>
            <MyStoriesProvider>
              {children}
              <LoginModal />
            </MyStoriesProvider>
          </PortalDataProvider>
        </AuthProvider>
      </SpeechProvider>
    </ToastProvider>
  )
}
