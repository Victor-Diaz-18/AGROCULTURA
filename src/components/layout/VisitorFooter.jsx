import { Link } from 'react-router-dom'

/**
 * Who makes this, for someone who just arrived, and the credit of the images. What is coming (360° tours, avatars in AR)
 * is not announced here: the public is not promised what is not built. The team still sees it in its side menu.
 */
export default function VisitorFooter() {
  return (
    <footer className="ag-vfooter">
      <p>
        Proyecto del curso Diseño y Prototipado, Ingeniería de Sistemas, Universidad del Magdalena. Equipo Protopía.
      </p>
      <p className="ag-vfooter__credit">
        Foto de la portada:{' '}
        <a href="https://commons.wikimedia.org/wiki/File:Fincas_cafeteras_-_Sierra_Nevada_-_panoramio.jpg" target="_blank" rel="noopener noreferrer">
          «Fincas cafeteras - Sierra Nevada»
        </a>
        , de diego_cue, recortada.{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.es" target="_blank" rel="noopener noreferrer">
          CC BY-SA 3.0
        </a>
        . <Link to="/creditos">Créditos de las demás imágenes</Link>.
      </p>
    </footer>
  )
}
