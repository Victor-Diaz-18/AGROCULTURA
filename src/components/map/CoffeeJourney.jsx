import { referenceImage } from '../../config/referenceImages.js'
import Icon from '../ui/Icon.jsx'
import Reveal from './Reveal.jsx'

const STAGES = [
  ['cafeto', 'La mata', 'El cafeto crece en la montaña, muchas veces a la sombra de otros árboles.'],
  ['cerezas', 'La cereza', 'El fruto pasa de verde a rojo y se recoge a mano, cuando está maduro.'],
  ['secado', 'El secado', 'Después de lavarlo, el grano se extiende al sol hasta que pierde la humedad.'],
  ['transporte', 'El camino', 'Antes de las carreteras, las cargas bajaban de la montaña a lomo de animal.'],
  ['tostado', 'El tueste', 'El calor le da al grano su color, su aroma y su sabor.'],
]

/** The way of the coffee in pictures: what most of the stories of the map talk about. */
export default function CoffeeJourney() {
  return (
    <section className="ag-vjourney" aria-labelledby="del-grano">
      <div className="ag-vjourney__head">
        <span className="ag-vtile">
          <Icon name="grano" size={22} />
        </span>
        <h2 id="del-grano">De la mata a la taza</h2>
      </div>
      {/* On a phone this row scrolls sideways: the keyboard has to be able to reach it too. */}
      <ol tabIndex={0} aria-label="Las etapas del café">
        {STAGES.map(([image, title, text]) => (
          <Reveal as="li" key={title}>
            <img src={referenceImage(image).large} alt={referenceImage(image).alt} loading="lazy" />
            <span className="ag-vjourney__label">
              <b>{title}</b>
              {text}
            </span>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}
