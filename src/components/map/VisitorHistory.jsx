import texts from '../../../lib/voice/fincas.json'
import { referenceImage } from '../../config/referenceImages.js'
import Icon from '../ui/Icon.jsx'
import ListenButton from '../ui/ListenButton.jsx'
import MountainScene from './MountainScene.jsx'
import Reveal from './Reveal.jsx'

/**
 * The history of the first farms and some facts about the zone, below the map. On purpose it names no people, only farms
 * and companies, and where sources disagree on a date it follows the academic one (the first source listed below).
 * The words live in lib/voice/fincas.json, because the server reads them aloud too: page and voice cannot say different things.
 */
const { fincas: FARMS, datos: FACTS } = texts

const SOURCES = [
  ['«Aroma de café: economía y empresas cafeteras en la Sierra Nevada de Santa Marta», Jangwa Pana, Universidad del Magdalena, 2019', 'https://www.redalyc.org/journal/5880/588066550002/html/'],
  ['UNESCO: Sierra Nevada de Santa Marta', 'https://whc.unesco.org/en/news/2548'],
  ['Altura de la Sierra Nevada (artículo académico)', 'https://digitalcommons.usf.edu/gia_facpub/141'],
  ['Colombia Travel: la Sierra Nevada', 'https://colombia.travel/es/blog/sabiduria-y-vida-silvestre-en-la-sierra-nevada-de-santa-marta'],
  ['ProAves: Reserva El Dorado', 'https://proaves.org/blog/visit-the-el-dorado-reserve-a-paradise-of-birds/'],
  ['City Population: censo de Minca (datos del DANE)', 'https://citypopulation.de/en/colombia/magdalena/santa_marta/47001009__minca/'],
  ['Nueva Lengua: altura de Minca', 'https://nuevalengua.com/en/minca-paradise-of-the-sierra/'],
  ['Noticartagena: distancia a Santa Marta', 'https://noticartagena.com.co/minca-la-historia-que-nadie-sabe/'],
]

const readAloud = () =>
  [
    ...FARMS.map((farm) => `${farm.title}, ${farm.when}. ${farm.text}`),
    'Datos de la zona.',
    ...FACTS.map((fact) => `${fact.value} ${fact.text}`),
  ].join(' ')

export default function VisitorHistory() {
  return (
    <section className="ag-vhist" aria-labelledby="primeras-fincas">
      <MountainScene />
      <div className="ag-vhist__farms">
        <div className="ag-vhist__head">
          <h2 id="primeras-fincas">Las primeras fincas</h2>
          <ListenButton title="Las primeras fincas" text={readAloud} piece="fincas" label="Escuchar esta sección" size="sm" />
        </div>
        <ol className="ag-vhist__line">
          {FARMS.map((farm) => (
            <Reveal as="li" key={farm.title}>
              <span className="ag-vhist__when">{farm.when}</span>
              <div className="ag-vhist__entry">
                <div>
                  <h3>{farm.title}</h3>
                  <p>{farm.text}</p>
                </div>
                <img src={referenceImage(farm.image).large} alt={referenceImage(farm.image).alt} loading="lazy" />
              </div>
            </Reveal>
          ))}
        </ol>
        <p className="ag-vhist__note">Las fotos son imágenes de referencia: no muestran estas fincas ni esas épocas, salvo la del paisaje de Minca.</p>
      </div>

      <aside className="ag-vhist__facts" aria-labelledby="datos-zona">
        <h2 id="datos-zona">Datos de la zona</h2>
        <ul>
          {FACTS.map((fact) => (
            <li key={fact.value}>
              <span className="ag-vtile">
                <Icon name={fact.icon} size={22} />
              </span>
              <span>
                <b>{fact.value}</b> {fact.text}
              </span>
            </li>
          ))}
        </ul>
        <figure className="ag-vhist__bird">
          <img src={referenceImage('perico').large} alt={referenceImage('perico').alt} loading="lazy" />
          <figcaption>El perico de Santa Marta, una de las aves endémicas de esta sierra.</figcaption>
        </figure>
      </aside>

      <details className="ag-vhist__sources">
        <summary>
          <Icon name="lista" size={16} />
          Fuentes
        </summary>
        <ul>
          {SOURCES.map(([label, url]) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
