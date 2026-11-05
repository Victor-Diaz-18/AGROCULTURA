import ListenButton from '../ui/ListenButton.jsx'

/**
 * The history of the first farms and some facts about the zone, below the map. On purpose it names no people, only farms
 * and companies, and where sources disagree on a date it follows the academic one (the first source listed below).
 */
const FARMS = [
  {
    when: '1778',
    title: 'Los primeros cafetos',
    text: 'El gobernador de la provincia informó que ya había cafetos en la Sierra Nevada, aunque dispersos y sin cuidado.',
  },
  {
    when: '1800',
    title: 'Hacienda Minca',
    text: 'Entre 1800 y 1818, una familia empezó a desarrollar sus cafetales, y hoy se la reconoce como una de las primeras haciendas cafeteras de Colombia. Más adelante, uno de sus dueños trajo agricultores italianos para hacerla prosperar de nuevo, pero a los tres meses se fueron. En 1925 tenía cerca de 100.000 cafetos. A finales de los años treinta empezó a sustituirse por caña de azúcar, y ese fue el final de la histórica hacienda cafetera.',
  },
  {
    when: '1896',
    title: 'La Victoria',
    text: 'La fundó la sociedad inglesa Libano Coffee Company, en la cuenca del río Gaira. Allí se trillaba y empacaba el café, que luego se llevaba al puerto de Santa Marta para venderlo en el exterior. A mediados del siglo XX, un matrimonio alemán se hizo cargo de la finca.',
  },
  {
    when: '1898',
    title: 'Cincinnati',
    text: 'Un ingeniero norteamericano, que había llegado a Colombia en 1889 para instalar el teléfono y el telégrafo en Barranquilla, sembró aquí los primeros arbustos tras explorar la Sierra. Contrató a 25 familias campesinas de Puerto Rico, y en cosecha la hacienda empleaba cerca de 800 recolectores.',
  },
  {
    when: '1917',
    title: 'Vista Nieve',
    text: 'Campesinos santandereanos que iban camino a Cuba llegaron a Santa Marta, se quedaron y empezaron a trabajar en esta hacienda, propiedad de un ornitólogo norteamericano.',
  },
  {
    when: 'Años 40',
    title: 'Nace el caserío de Minca',
    text: 'Una familia de origen santandereano ocupó y luego negoció un terreno de 125 hectáreas de la antigua hacienda. De allí surgió el caserío de Minca.',
  },
]

const FACTS = [
  { value: '5.775 m', text: 'de altura alcanza la Sierra Nevada de Santa Marta, que baja hasta el mar Caribe. Se la describe como la montaña costera más alta del mundo.' },
  { value: '1979', text: 'es el año en que la UNESCO la declaró Reserva de la Biosfera.' },
  { value: '4 pueblos', text: 'indígenas viven en ella: kogui, arhuaco, wiwa y kankuamo.' },
  { value: '650 m', text: 'es la altura aproximada de Minca, a unos 14 km de Santa Marta. En el censo de 2018, su centro poblado tenía 632 habitantes.' },
  { value: '337 aves', text: 'registra la Reserva El Dorado, creada en 2006 en la Cuchilla de San Lorenzo; 19 de esas especies son endémicas.' },
  { value: '4.812 familias', text: 'cafeteras tenía el Magdalena en 2018, en 5.233 fincas. Ciénaga aporta más de la mitad del área cultivada, seguida de Santa Marta.' },
]

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
      <div className="ag-vhist__farms">
        <div className="ag-vhist__head">
          <h2 id="primeras-fincas">Las primeras fincas</h2>
          <ListenButton title="Las primeras fincas" text={readAloud} label="Escuchar esta sección" size="sm" />
        </div>
        <ol className="ag-vhist__line">
          {FARMS.map((farm) => (
            <li key={farm.title}>
              <span className="ag-vhist__when">{farm.when}</span>
              <div>
                <h3>{farm.title}</h3>
                <p>{farm.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <aside className="ag-vhist__facts" aria-labelledby="datos-zona">
        <h2 id="datos-zona">Datos de la zona</h2>
        <ul>
          {FACTS.map((fact) => (
            <li key={fact.value}>
              <b>{fact.value}</b> {fact.text}
            </li>
          ))}
        </ul>
      </aside>

      <details className="ag-vhist__sources">
        <summary>Fuentes</summary>
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
