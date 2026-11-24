import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import RequireRole from './components/auth/RequireRole.jsx'
import AdminShell from './components/layout/AdminShell.jsx'
import PortalShell from './components/layout/PortalShell.jsx'
import LauncherPage from './pages/LauncherPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ProjectStoriesPage from './pages/admin/ProjectStoriesPage.jsx'
import ReviewPage from './pages/admin/ReviewPage.jsx'
import AdminsPage from './pages/admin/AdminsPage.jsx'
import NarratorsPage from './pages/admin/NarratorsPage.jsx'
import SettingsPage from './pages/admin/SettingsPage.jsx'
import SummaryPage from './pages/admin/SummaryPage.jsx'
import TrashPage from './pages/admin/TrashPage.jsx'
import CreditsPage from './pages/portal/CreditsPage.jsx'
import FuturePage from './pages/portal/FuturePage.jsx'
import MapPage from './pages/portal/MapPage.jsx'
import MyStoriesPage from './pages/portal/MyStoriesPage.jsx'
import TellPage from './pages/portal/TellPage.jsx'

/**
 * Pages that need a role are wrapped in RequireRole; /admin shows its own sign-in card.
 *
 * Two shells, one set of views:
 *  - the portal ("/") for visitors and narrators; its administration entries open
 *    the same views inside the portal frame, as in the portal design;
 *  - the admin panel ("/admin"), the desktop-first frame of the admin design.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="h/:codigo" element={<SharedStory />} />
      <Route element={<PortalShell />}>
        <Route index element={<MapPage />} />
        <Route path="inicio" element={<RequireRole role="narrador"><LauncherPage who="narrador" /></RequireRole>} />
        <Route path="contar" element={<RequireRole role="narrador"><TellPage /></RequireRole>} />
        <Route path="mis-historias" element={<RequireRole role="narrador"><MyStoriesPage /></RequireRole>} />
        <Route path="revision" element={<Navigate to="/admin/revision" replace />} />
        <Route path="historias-propias" element={<Navigate to="/admin/historias" replace />} />
        <Route path="configuracion" element={<Navigate to="/admin/configuracion" replace />} />
        <Route path="administradores" element={<Navigate to="/admin/administradores" replace />} />
        <Route path="creditos" element={<CreditsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="admin" element={<AdminShell />}>
        <Route index element={<SummaryPage />} />
        <Route path="inicio" element={<LauncherPage who="admin" />} />
        <Route path="revision" element={<ReviewPage variant="admin" />} />
        <Route path="historias" element={<ProjectStoriesPage variant="admin" />} />
        <Route path="configuracion" element={<SettingsPage variant="admin" />} />
        <Route path="narradores" element={<NarratorsPage />} />
        <Route path="administradores" element={<AdminsPage />} />
        <Route path="papelera" element={<TrashPage />} />
        <Route path="proximamente/:id" element={<FuturePage />} />
      </Route>
    </Routes>
  )
}

/**
 * /h/<código> is the link of a story people share. The server answers it with the preview WhatsApp shows (lib/stories/share.py);
 * opened where the app is already installed, the app answers it itself. Both go on to the story on the map, with its card open.
 */
function SharedStory() {
  const { codigo } = useParams()
  return <Navigate to={`/?historia=${encodeURIComponent(codigo)}&ficha=1`} replace />
}
