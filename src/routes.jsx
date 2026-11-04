import { Route, Routes } from 'react-router-dom'
import AdminShell from './components/layout/AdminShell.jsx'
import PortalShell from './components/layout/PortalShell.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ProjectStoriesPage from './pages/admin/ProjectStoriesPage.jsx'
import ReviewPage from './pages/admin/ReviewPage.jsx'
import SettingsPage from './pages/admin/SettingsPage.jsx'
import SummaryPage from './pages/admin/SummaryPage.jsx'
import FuturePage from './pages/portal/FuturePage.jsx'
import MapPage from './pages/portal/MapPage.jsx'
import MyStoriesPage from './pages/portal/MyStoriesPage.jsx'
import TellPage from './pages/portal/TellPage.jsx'

/**
 * Two shells, one set of views:
 *  - the portal ("/") for visitors and narrators; its administration entries open
 *    the same views inside the portal frame, as in the portal design;
 *  - the admin panel ("/admin"), the desktop-first frame of the admin design.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PortalShell />}>
        <Route index element={<MapPage />} />
        <Route path="contar" element={<TellPage />} />
        <Route path="mis-historias" element={<MyStoriesPage />} />
        <Route path="revision" element={<ReviewPage variant="portal" />} />
        <Route path="historias-propias" element={<ProjectStoriesPage variant="portal" />} />
        <Route path="configuracion" element={<SettingsPage variant="portal" />} />
        <Route path="proximamente/:id" element={<FuturePage variant="portal" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="admin" element={<AdminShell />}>
        <Route index element={<SummaryPage />} />
        <Route path="revision" element={<ReviewPage variant="admin" />} />
        <Route path="historias" element={<ProjectStoriesPage variant="admin" />} />
        <Route path="configuracion" element={<SettingsPage variant="admin" />} />
        <Route path="proximamente/:id" element={<FuturePage variant="admin" />} />
      </Route>
    </Routes>
  )
}
