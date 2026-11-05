import { Link } from 'react-router-dom'

/** Who makes this, for someone who just arrived, and what is coming (the entries a signed-in person has in the side menu). */
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
      <nav aria-label="Próximamente" className="ag-vfooter__next">
        <span>Próximamente:</span>
        <Link to="/proximamente/360">Recorridos 360°</Link>
        <Link to="/proximamente/ra">Avatares en RA</Link>
      </nav>
    </footer>
  )
}
