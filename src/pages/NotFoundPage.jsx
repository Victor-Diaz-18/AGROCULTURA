import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'

export default function NotFoundPage() {
  return (
    <div className="ag-notfound">
      <PageHeader title="No encontramos esta página" subtitle="Puede que el enlace esté mal escrito o que la página ya no exista." />
      <Link to="/" className="ag-btn ag-btn--dark">
        Volver al mapa
      </Link>
    </div>
  )
}
