import LoginModal from './components/auth/LoginModal.jsx'
import ConnectivityToasts from './components/layout/ConnectivityToasts.jsx'
import UpdateNotice from './components/layout/UpdateNotice.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { MyStoriesProvider } from './context/MyStoriesContext.jsx'
import { OutboxProvider } from './context/OutboxContext.jsx'
import { PortalDataProvider } from './context/PortalDataContext.jsx'
import { SpeechProvider } from './context/SpeechContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

/** Everything the pages share. Must live inside a Router (speech stops on page change). */
export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <SpeechProvider>
        <AuthProvider>
          <PortalDataProvider>
            <OutboxProvider>
              <ConnectivityToasts />
              <UpdateNotice />
              <MyStoriesProvider>
                {children}
                <LoginModal />
              </MyStoriesProvider>
            </OutboxProvider>
          </PortalDataProvider>
        </AuthProvider>
      </SpeechProvider>
    </ToastProvider>
  )
}
