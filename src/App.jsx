import { BrowserRouter } from 'react-router-dom'
import AppProviders from './AppProviders.jsx'
import AppRoutes from './routes.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  )
}
