import { Link } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { REFERENCE_IDS, referenceImage } from '../../config/referenceImages.js'

const HERO = {
  titulo: 'Fincas cafeteras - Sierra Nevada',
  autor: 'diego_cue',
  licencia: 'CC BY-SA 3.0',
  licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  pagina: 'https://commons.wikimedia.org/wiki/File:Fincas_cafeteras_-_Sierra_Nevada_-_panoramio.jpg',
}

function Credit({ credit, image, alt }) {
  return (
    <li className="ag-credits__item">
      {image && <img src={image} alt={alt} loading="lazy" />}
      <span>
        <a href={credit.pagina} target="_blank" rel="noopener noreferrer">
          {credit.titulo}
        </a>
        <span className="ag-credits__who">
          {credit.autor} ·{' '}
          {credit.licenciaUrl ? (
            <a href={credit.licenciaUrl} target="_blank" rel="noopener noreferrer">
              {credit.licencia}
            </a>
          ) : (
            credit.licencia
          )}
        </span>
      </span>
    </li>
  )
}

/** Who made the images of the portal: their free licenses ask for it. */
export default function CreditsPage() {
  return (
    <>
      <PageHeader
        title="Créditos de las imágenes"
        subtitle="Estas fotos vienen de Wikimedia Commons con licencias libres, algunas recortadas o reducidas. Sirven de referencia: no son fotos de las historias ni de las familias."
      />
      <ul className="ag-credits">
        <Credit credit={HERO} />
        {REFERENCE_IDS.map((id) => {
          const image = referenceImage(id)
          return <Credit key={id} credit={image.credit} image={image.small} alt={image.alt} />
        })}
      </ul>
      <Link to="/" className="ag-credits__back">
        Volver al mapa
      </Link>
    </>
  )
}
