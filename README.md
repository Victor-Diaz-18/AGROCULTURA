# AGROCULTURA

Plataforma digital de memoria histórica y patrimonio cultural de la cultura cafetera de **Minca y
sectores cercanos** (La Tagua, San Lorenzo, Tijereras). Las familias cuentan sus historias con foto
y audio, un administrador las revisa y las aprobadas se ven sobre un mapa.

Proyecto del curso Diseño y Prototipado (Ingeniería de Sistemas, Universidad del Magdalena).
Equipo Protopía: Jeison, Victor y Marleidys. Referencia: [La Piragua](https://lapiragua.com.co).

> Esta es la **versión 1**. El stack se confirmará con las entrevistas; por eso las capas están
> desacopladas (frontend, API y acceso a datos). El plan y las decisiones acordadas están en
> [`docs/plan-v1.md`](docs/plan-v1.md) y los diseños aprobados en [`docs/diseno/`](docs/diseno/).

**Para ir directo a lo que buscas:** [desplegar en Vercel](#desplegar-en-vercel-paso-a-paso) ·
[antes de usarla con familias](#antes-de-usarla-con-familias-lista-de-pendientes-de-configuración) ·
[correrla en tu computador](#cómo-correr-el-proyecto-en-tu-computador) · [pruebas](#pruebas) ·
[accesibilidad](#accesibilidad) · [sin conexión](#sin-conexión-f10) · [qué falta o está por definir](#pendientes-y-por-definir)

## Stack

| Capa | Tecnología |
|---|---|
| Despliegue | Vercel (un repositorio, un proyecto) |
| Frontend | JavaScript, React + Vite, PWA |
| Backend | Python + FastAPI como funciones serverless de Vercel |
| Base de datos | MongoDB Atlas (plan gratuito) |
| Archivos | Vercel Blob |

## Requisitos

- Node.js 22 (Vercel usa la misma versión; ver `engines` en `package.json`)
- Python 3.12 (ver `.python-version`)
- Una base de datos en MongoDB Atlas (ver [MongoDB Atlas](#mongodb-atlas))

## Instalación

```bash
git clone https://github.com/Victor-Diaz-18/AGROCULTURA.git
cd AGROCULTURA
```

```bash
npm install
```

```bash
python -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
```

```bash
cp .env.example .env             # y completa los valores
```

> **Nunca subas el archivo `.env` al repositorio.** Ya está en `.gitignore`. Si una clave se
> filtra por error, cámbiala de inmediato (contraseña del usuario de Atlas, `JWT_SECRET`, token de Blob).

## Variables de entorno

Están descritas en [`.env.example`](.env.example). Las principales:

| Variable | Para qué sirve |
|---|---|
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas |
| `MONGODB_DB` | Nombre de la base (por defecto `agrocultura`) |
| `JWT_SECRET` | Firma de las sesiones (la API de Python la firma y la función de video `api/blob-token.js` la verifica con el mismo secreto). Cadena aleatoria de **32 caracteres o más**; sin ella el ingreso y la subida de videos responden 503 |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Administrador inicial. La contraseña tiene **10 caracteres o más** |
| `SEED_DEMO_NARRATOR_*` | Narradora de ejemplo (opcional) |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob, donde se guardan las fotos, los audios y los videos. Aparece solo al conectar un *Blob store* al proyecto (Storage → Create → Blob, con acceso **Public**) |
| `ALLOW_DEMO_RESET` | Muestra y permite el botón «Reiniciar datos de ejemplo» (**borra todas las historias**). Sin esta variable (o con `false`) el botón no existe. Se quita antes de usar la plataforma con familias reales |
| `VITE_SHOW_CODES` | Muestra los códigos F1, F2… del diseño |

Para generar un `JWT_SECRET` (con Node, que ya tienes instalado):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Cómo correr el proyecto en tu computador

Hay dos formas. Las dos usan el mismo código.

### Forma 1: `vercel dev` (igual que en producción)

Requiere la CLI de Vercel 48.1.8 o superior y una cuenta de Vercel.

```bash
npm install -g vercel
vercel login
vercel link
vercel dev
```

### Forma 2: uvicorn para la API y Vite para la interfaz

No necesita cuenta de Vercel. Abre dos terminales en la carpeta del proyecto, con el entorno virtual
activado en la primera:

```bash
npm run dev:api        # API en http://127.0.0.1:8000  (documentación en /api/docs)
```

```bash
npm run dev            # interfaz en http://localhost:5173
```

Vite redirige las llamadas a `/api` hacia la API (ver `vite.config.js`), así que el navegador
solo habla con un origen, igual que en producción. Para ver la aplicación como PWA (con service worker) usa
`npm run build && npm run preview` en lugar de `npm run dev` (ver «Sin conexión»).

## Pruebas

Las dos suites corren sin configuración adicional (después de instalar las dependencias).

```bash
npm test               # frontend: Vitest + Testing Library
```

```bash
pytest                 # backend: pytest + httpx (con el entorno virtual activado)
```

- Las pruebas del backend **nunca tocan la base real**: usan una base falsa en memoria
  (`mongomock`) o, si defines `TEST_MONGODB_URI`, una base de MongoDB cuyo nombre termina en `_test`.
  Si el nombre no termina en `_test`, las pruebas se niegan a correr.
- Las pruebas marcadas `real_mongo` (consultas geoespaciales por zona del mapa) se omiten salvo que
  definas `TEST_MONGODB_URI`. El CI de GitHub las ejecuta con un MongoDB real.
- Cada prueba del frontend vive junto al componente que prueba (por ejemplo
  `src/offline/connectivity.test.js`). Lo que usa IndexedDB se prueba con `fake-indexeddb` (ya viene instalado) y
  entre una prueba y otra el teléfono «se vacía» solo (`src/test/setup.js`).
- **Recorrido de punta a punta (opcional): `npm run e2e`.** Abre un Chromium de verdad contra la API real sobre una
  base en memoria (`e2e/server.py`, sin MongoDB ni Blob ni cuentas) y repite lo que hacen las familias y el equipo:
  crear la cuenta, contar una historia, que el equipo la revise y la apruebe, que un visitante la encuentre en el mapa,
  buscarla y abrir su ficha, guardar un borrador sin señal y que salga al volver, y recuperar lo que quedó a medias.
  Incluye la auditoría de accesibilidad con colores reales, en escritorio y en móvil. La primera vez hace falta el navegador
  (`npx playwright install chromium`) y el entorno virtual de Python activado. No corre en el CI (tarda y necesita un
  navegador): se corre a mano antes de un cambio grande.
- `npm test` corre dos proyectos de Vitest: `app` (la interfaz, en jsdom) y `functions` (las funciones de Node de
  `api/`, en Node; las pruebas de `api/blob-token.js` incluyen un token firmado por la API de Python).
- El service worker no se prueba con Vitest (no corre en jsdom): se comprueba en un navegador real con
  `npm run build && npm run preview` (ver «Sin conexión»).

## Datos iniciales

La primera vez que la API se conecta a una base vacía, **carga sola** los sectores, las etiquetas y la
configuración del portal (queda una marca en la colección `configuracion` para que no se repita).
Por eso, para desplegar solo hace falta definir `MONGODB_URI`.

Si prefieres cargarlos a mano (con `MONGODB_URI` en tu `.env` y el entorno virtual activado):

```bash
python -m scripts.seed
```

El seed **solo llena colecciones vacías**: nunca sobrescribe lo que ya existe. Los centros de los
sectores son provisionales hasta confirmarlos con las familias de la zona.

## Ingreso y sesiones

- **Narrador:** se registra con su nombre, su celular (10 dígitos, empieza por 3; se acepta con `+57`, espacios
  o guiones) y una clave corta (**PIN de 4 a 6 números**). No usa correo. El PIN se guarda solo con hash
  (bcrypt), nunca en texto plano. La sesión dura **30 días**, para que pueda usar la aplicación sin señal.
- **Administrador:** entra con usuario y contraseña. Los define `ADMIN_USER` y `ADMIN_PASSWORD`; la aplicación
  crea al administrador sola en la primera petición. **La variable manda:** para cambiar la contraseña, cambia
  `ADMIN_PASSWORD` en Vercel y haz un Redeploy. La sesión dura **8 horas**.
- **Intentos fallidos:** como máximo **5 intentos cada 15 minutos por celular (o usuario)**. Pasado el límite
  se bloquea aunque se escriba la clave correcta, hasta que termine la ventana de 15 minutos.
- **Narradora de ejemplo (opcional):** si defines `SEED_DEMO_NARRATOR_PHONE` y `SEED_DEMO_NARRATOR_PIN`
  (y opcionalmente `SEED_DEMO_NARRATOR_NAME`), se crea una cuenta de ejemplo. Nunca se modifica después.
- **Clave olvidada:** en la versión 1 no hay recuperación. Un administrador puede borrar la cuenta en Atlas
  (colección `usuarios`) para que la persona se registre de nuevo.
- Si el ingreso responde *«Falta configurar JWT_SECRET en el servidor»*, falta esa variable (o es muy corta):
  agrégala en Vercel y haz un Redeploy.

## Contar una historia (fotos y audio)

- La narradora cuenta su historia en tres pasos: *Cuéntala* (voz, texto, fotos), *Dónde y cuándo* (título,
  lugar, época, etiquetas) y *Revisar y enviar*. Lo que escribe o graba se guarda **en el teléfono** mientras
  lo cuenta (ver «Sin conexión»): si cierra la página a medias, la historia vuelve donde la dejó.
- **Antes de subir**, el teléfono reduce cada foto (máximo 1280 px por lado y menos de 1 MB, y de paso borra
  los datos ocultos de la cámara, como la posición GPS) y graba el audio en mono a baja calidad
  (unos 180 KB por minuto). Así se sube rápido con poca señal.
- Las fotos y el audio pasan por `POST /api/medios` (máximo **3,5 MB** cada uno: una función de Vercel
  acepta unos 4,5 MB por petición). El servidor **decide el tipo de archivo por su contenido**, no por el
  nombre ni por lo que diga el navegador, y lo guarda en Vercel Blob. El video va aparte (ver «Video»).
- La historia se envía con `POST /api/historias`. **Siempre** queda «en revisión» (aunque alguien intente
  mandar otro estado) y no aparece en el mapa hasta que un administrador la aprueba. El servidor decide el
  autor y el código (`HIS-AAAA-NNN`, consecutivo).
- Cada borrador lleva un identificador propio (`client_id`). Si el envío se repite (se cortó la señal justo
  al responder, o se envió desde el teléfono y otra vez al volver la señal), el servidor reconoce la historia y no
  la duplica; y las fotos que ya subieron no se suben otra vez.
- Si no hay `BLOB_READ_WRITE_TOKEN`, subir un archivo responde 503 con el mensaje «Falta configurar…».

### Video (F13)

- «Agregar video» (MP4, MOV de iPhone o WebM, **hasta 25 MB**: 25 000 000 bytes, como los cuenta el teléfono) está en
  «Fotos y video» del paso 1 y en «Nueva historia del proyecto». Un video por historia. No se reduce en el teléfono:
  la pantalla avisa si pesa más o no es un video.
- **El video no pasa por la API** (una función de Vercel acepta unos 4,5 MB por petición): sube **directo del
  navegador a Vercel Blob**. La función de Node **`api/blob-token.js`** solo contesta una pregunta: «¿esta persona
  puede subir este archivo?». Verifica la sesión (el JWT que firmó la API, con `node:crypto`: algoritmo HS256,
  firma, vencimiento) y entrega un permiso corto para **una ruta en la carpeta de esa persona**
  (`historias/<su id>/…`), solo tipos de video y hasta 25 MB. Las reglas están en `api/_lib/video.js`. La API
  de Python vuelve a comprobar al guardar la historia (tipo, tamaño, que la dirección sea de la carpeta de quien la
  envía).
- **La historia no espera al video.** Primero se envía la historia (con sus fotos y su audio) y el video sube
  después y se agrega con `POST /api/historias/{codigo}/video`, mientras la historia siga «en revisión» (después de
  la revisión ya no se le pueden agregar archivos). Repetir ese envío no cambia nada.
- **Si el video falla o no hay señal**, la historia ya está enviada y el video **queda en el teléfono** y se
  reintenta solo (al volver la señal y cada minuto; tras 5 intentos fallidos espera a la persona). «Mis historias»
  dice en «Qué sigue»: *«Lo revisa un administrador. Falta subir el video: se sube cuando haya señal.»*, el avance
  (*«Subiendo el video… 40 %»*) o el motivo, con **Reintentar** y **Quitar** (pregunta antes).
- En «Nueva historia del proyecto» el video sube antes de publicar: si falla, la historia **no** se publica sin él
  y se puede intentar otra vez (el equipo está mirando la pantalla).
- **Para probarlo en el computador hace falta `vercel dev`** (forma 1): `uvicorn` solo sirve la API de Python, que no
  tiene `/api/blob-token`; con la forma 2 el video responde «La subida de videos no está disponible en este
  momento» y el resto de la aplicación funciona igual. En producción no hay que configurar nada más que el Blob store
  y `JWT_SECRET`, que ya existen.
- Un video que se sube y nunca llega a una historia (la persona cierra todo a mitad) queda en Blob sin usar, como
  una foto. Se puede limpiar desde el panel de Vercel.
- El lugar se elige tocando un sector, tocando el mapa o con el botón «Usar mi ubicación» (el GPS del
  teléfono funciona sin señal). Se guarda como un punto GeoJSON `[longitud, latitud]` con un índice `2dsphere`.

## Mapa y ficha de la historia

- **Filtros y búsqueda (F11).** Sobre el mapa está la barra del diseño: pestañas de **sector** (con cuántas historias
  muestra cada una con los otros filtros; aparece «Otro lugar» si hay historias fuera de los sectores), de
  **origen** (Todas, Comunidad, Proyecto), una **búsqueda** y los menús de **época** y **formato**. Filtran el mapa y
  la lista a la vez y funcionan sin conexión (se hacen en el teléfono con las historias que ya tiene). La búsqueda
  mira el título, quién la cuenta, el nombre del lugar, el sector, la época y las etiquetas, **sin importar tildes ni
  mayúsculas** («cafe» encuentra «café») y exige todas las palabras, en cualquier orden. Al cambiar un filtro el mapa
  se acerca a lo que queda (la búsqueda espera a que se deje de escribir). Sin resultados dice «No hay historias con
  estos filtros» y ofrece «Quitar los filtros». Por eso `GET /api/historias` ahora trae también las `etiquetas`.

- **Qué se ve en el mapa.** `GET /api/historias` es público y devuelve **solo** las historias publicadas (más
  nuevas primero, hasta 1000), con lo que necesita el mapa: código, título, quién la cuenta, sector, época,
  formatos, origen, el punto y la primera foto. **Nunca** lleva el texto, el autor, el identificador del borrador
  ni nada de la revisión. `GET /api/historias/{codigo}` es la ficha: también pública y también solo de historias
  publicadas (una en revisión, rechazada o inexistente responde 404).
- **La zona visible.** El mapa carga todas las publicadas de una vez, las agrupa cuando están cerca y la lista
  de al lado muestra solo las que están en la zona que se ve (se actualiza al mover o acercar el mapa). Así
  también funciona sin conexión, sin pedir datos al servidor cada vez que se mueve el mapa.
  El índice `2dsphere` de `ubicacion` queda listo por si algún día hace falta consultar por zona en el servidor.
- **Fondo del mapa.** OpenStreetMap, en una sola constante (`src/config/map.js`) para cambiarlo después por un
  mapa de relieve sin tocar componentes. El servicio gratuito de OpenStreetMap tiene
  [normas de uso](https://operations.osmfoundation.org/policies/tiles/) para poco tráfico; si el proyecto crece
  habrá que pasar a un proveedor propio. Los pedazos que la persona ya vio se guardan para el modo sin conexión
  (el proveedor debe permitir CORS; el de OpenStreetMap lo permite).
- **El lugar puede ser cualquiera de la zona.** «Minca y sectores aledaños» es toda la zona, no solo los
  sectores. Al contar una historia se toca **cualquier punto del mapa** (o «Usar mi ubicación»); los botones de
  sector son atajos. Un punto fuera de la zona (`ZONE` en `src/config/map.js`, unos 90 km alrededor de Minca) no se
  acepta, y el mapa del formulario no deja alejarse más. El **sector se calcula en el servidor a partir del
  punto**: es el más cercano dentro de 3 km (`SECTOR_RADIUS_KM`), o ninguno, y entonces se muestra «Otro lugar
  de la zona». Lo que mande el teléfono como sector se ignora. Un sector con punto provisional solo cuenta si la
  persona lo eligió. Que un punto esté en la zona lo revisa además el administrador (comprobación «Ocurrió en
  Minca o en un sector aledaño»).
- **Privacidad del lugar.** Quien cuenta una historia puede estar en su casa, y las historias del equipo también
  pueden ser de un lugar privado. Por eso el servidor guarda el punto exacto, **que solo ven los administradores**
  (al revisar y en «Historias del proyecto»), y el mapa, la lista y la ficha públicos muestran **un punto
  redondeado a una cuadrícula de unos 500 m** (`GRID_DEGREES` en `lib/stories/privacy.py`), **sea de la comunidad
  o del proyecto**: las historias de una misma cuadrícula se ven en el mismo sitio y los números exactos no salen en
  ninguna respuesta pública. La ficha y los enlaces a Google/Apple Maps usan ese punto aproximado y lo avisan. No se
  redondean las historias ubicadas con un botón de sector (es el centro del sector, no la posición de nadie). Los
  formularios (el de contar una historia y el de «Nueva historia del proyecto») también lo dicen.
- **Nombre del lugar (opcional).** Quien cuenta puede escribir cómo se llama el lugar («Finca La Esperanza»,
  hasta 80 letras). Se muestra en la ficha pública y en las listas junto al sector («Finca La Esperanza, La Tagua»),
  y entra en la búsqueda. El administrador lo ve al revisar (la comprobación «No expone datos personales de otras
  personas» lo cubre).
- **Dónde están los sectores.** Cada sector tiene un punto central (en `lib/seed/catalog.py`) que usan las
  historias que se ubican «en el sector». **Minca, La Tagua y San Lorenzo están confirmados** (los dos últimos
  con puntos de Google Maps que pasó el equipo; el de San Lorenzo cae en «Cuchillas San Lorenzo», una cresta de
  montaña: hay que confirmar con las familias si su San Lorenzo es otro punto cercano). **Tijereras sigue
  provisional** (`centro_provisional`) y así se queda mientras no haga falta: el mapa no escribe su nombre, el
  formulario no le ofrece botón de atajo (pondría la historia en un lugar inventado) y la pantalla de configuración
  lo avisa. Quien viva ahí toca el lugar exacto en el mapa. Solo sirve de sector para las historias de ejemplo. Para corregirlos: cambia las coordenadas y **sube `SECTORES_VERSION`**. En el siguiente arranque
  la aplicación mueve los sectores guardados y también las historias ubicadas «en el sector» (con la misma
  distancia); las historias con punto propio (GPS o un toque en el mapa) no se mueven.
- **Nombres de los sectores en el mapa.** Se comportan como los nombres de un mapa real: con el mapa alejado no se
  escribe ninguno; solo salen cuando se está cerca (desde el nivel 13, `SECTOR_LABELS_MIN_ZOOM` en
  `src/config/map.js`, una vista de unos 15 km) y **solo los de los sectores que están a la vista**: al acercarse
  a La Tagua se lee «LA TAGUA», y al mover el mapa a otro lado el nombre se va. Un sector sin punto confirmado no se
  escribe y, si dos nombres quedaran uno sobre otro, se deja uno.
- **Pines.** Rojo: comunidad. Verde azulado: proyecto. Un pin marcado se ve oscuro, más grande y con su título.
  Los títulos y los nombres de sector se muestran siempre como texto, nunca como HTML.
- **Ficha (F8).** Fotos (varias, con miniaturas), video, audio y los datos de la historia. «Abrir en Google Maps» y
  «Abrir en Apple Maps» abren el punto de la historia en esas aplicaciones (son enlaces normales: no usan llaves ni
  tienen costo). «Ver en el mapa» la marca en el mapa (`/?historia=HIS-2026-001`: ese enlace también se puede compartir). Las historias de ejemplo
  no tienen archivos: la ficha muestra los marcadores de posición del diseño y dice que no hay audio.

## Sin conexión (F10)

Está pensado para quien cuenta su historia en la finca, donde casi nunca hay señal.

**Qué funciona sin señal** (después de haber abierto la página una vez con señal):

- La aplicación abre, también si se recarga la página. Se puede **instalar** como una aplicación en el teléfono.
- Se puede contar una historia completa: voz, texto, fotos y «Usar mi ubicación» (el GPS no necesita señal). Los
  sectores, las etiquetas y las épocas son los de la última vez que hubo conexión.
- Lo que se va escribiendo o grabando **se guarda en el teléfono** (cada vez que se hace una pausa, y al cambiar de
  paso). Si se cierra la página a medias, al volver aparece «Recuperamos la historia que dejaste a medias» con la
  opción «Empezar de nuevo». Cada narradora tiene la suya.
- En el último paso, sin señal, el botón dice **«Guardar en el dispositivo»**. La historia queda como **borrador**
  en «Mis historias» (con el código «Por asignar»: el código `HIS-AAAA-NNN` lo da el servidor al recibirla).
- «Mis historias» muestra la última lista que se cargó, con los borradores arriba. El mapa muestra las historias
  publicadas que ya se habían visto y los pedazos de mapa que ya se habían mirado.

**Cómo se envían los borradores**, sin que la persona haga nada:

- Cuando vuelve la señal, cuando se abre la aplicación con señal y cuando la persona ingresa. Sale el aviso
  «Volvió la señal: se envió 1 borrador a revisión.».
- Si el servidor falla o la conexión se cae a mitad del envío, el borrador se queda y se vuelve a intentar al
  minuto. Es seguro repetirlo: cada historia lleva su `client_id`, así que **nunca se duplica**, y las fotos y el
  audio que ya subieron no se suben otra vez (se recuerda cuáles).
- Si el servidor **rechaza** una historia (por ejemplo un audio demasiado pesado), el borrador se queda con el
  motivo escrito en «Qué sigue», sin reintentarse solo, y la persona elige **«Reintentar»** o **«Quitar»** (este
  último pregunta antes: es la única copia).
- Si la sesión venció, los borradores esperan y salen cuando la persona vuelva a ingresar.

**Cómo está hecho** (tres piezas, cada una con un trabajo):

| Pieza | Dónde | Qué guarda |
|---|---|---|
| Service worker (`vite-plugin-pwa`, ver `vite.config.js`) | Cache del navegador | La aplicación (páginas, scripts, estilos, tipografías, íconos) y los pedazos de mapa ya vistos (máx. 400, 30 días). Nunca respuestas de la API |
| `src/offline/store.js` | IndexedDB (`idb`) | La historia en curso (`borrador`), los borradores terminados (`cola`) y las últimas respuestas públicas del servidor (`cache`) |
| `src/offline/outbox.js` + `OutboxContext` | Memoria | Quién envía la cola, en qué momento y qué avisa |

Las fotos y el audio se guardan como bytes (no como `Blob`): algunas versiones de Safari pierden los `Blob`
guardados en IndexedDB. Si IndexedDB no está disponible (ventana privada, por ejemplo), todo sigue funcionando
mientras la página esté abierta y la pantalla lo **dice** («solo mientras no cierres esta página»).

**Límites que conviene conocer**

- La primera visita necesita señal: de ahí salen la aplicación y la configuración.
- **No se envía con la aplicación cerrada.** Los borradores salen cuando la persona abre la aplicación con señal
  (el envío en segundo plano de los navegadores no existe en iPhone ni en Firefox). Por eso el aviso dice
  «se envía sola cuando vuelva la señal» y no «aunque cierres la aplicación».
- La ficha completa de una historia (audio, fotos) y la subida de archivos necesitan señal.
- Solo se guardan los pedazos de mapa que la persona ya miró; no se descarga nada por adelantado (las
  [normas de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/) lo prohíben).
- Un iPhone puede borrar los datos de una página que no se usa en unas semanas; **instalada en la pantalla de
  inicio** no sufre eso.
- **Teléfono compartido.** La lista de «Mis historias» guardada se borra al salir. Los borradores y la historia
  a medias **no**: son el único ejemplar de la historia. Solo los ve y los envía quien los escribió.

**Versiones nuevas.** Cuando se publica una versión nueva, el teléfono la descarga en segundo plano y la deja
esperando; la aplicación avisa **«Hay una versión nueva»** con los botones **«Actualizar»** (recarga la página) y
**«Después»** (vuelve a avisar la próxima vez que se abra). Nunca se recarga sola, para no cortar a quien está
grabando; lo que lleva de su historia se guarda en el dispositivo antes. Busca versiones nuevas al abrir, cada hora
y cada vez que la aplicación vuelve al frente (`src/offline/updates.js`).

**Instalar en el teléfono:** en Android (Chrome), menú ⋮ → «Instalar aplicación»; en iPhone (Safari), Compartir →
«Agregar a pantalla de inicio».

**Probarlo en el computador.** `npm run dev` no activa el service worker. Para probarlo de verdad:

```bash
npm run build
npm run preview        # http://localhost:4173, con la API de la forma 2 corriendo en el puerto 8000
```

En el navegador, abre la página, espera unos segundos y en las herramientas de desarrollo (Network → «Offline»)
corta la conexión y recarga. El interruptor «Simular conexión» del encabezado simula la falta de señal sin cortar
nada (sirve para la demostración y para las pruebas).

## Administración (revisión, historias del proyecto y ajustes)

Todo lo de `/api/admin/*` exige una sesión de administrador: el guardián está en el propio router, y una prueba
recorre **todas** las rutas `/api/admin/*` del esquema de la API (también las que se agreguen) comprobando que un
visitante recibe 401 y un narrador 403.

- **Revisión (F6).** Para **aprobar** hay que marcar las tres comprobaciones (cultura cafetera, territorio, datos
  personales): el servidor las exige, no solo el botón. Para **rechazar** hace falta un motivo de la lista; el
  narrador lo lee en «Mis historias» y se guarda tal como se escribió (si la lista cambia después, no se reescribe
  la historia). Una historia se decide **una sola vez**: la decisión es una sola operación atómica sobre las que
  siguen «en revisión», así que dos administradores no pueden decidir la misma a la vez (el segundo recibe 409).
  Las historias del proyecto no pasan por revisión.
- **Historias del proyecto (F12).** Se publican de una vez y quedan marcadas «del proyecto». Los archivos los sube
  el propio administrador (las fotos y el audio por `POST /api/medios`; el video directo a Blob, ver «Video») y una
  historia solo puede apuntar a archivos que subió quien la crea.
  Sin punto en el mapa, queda en el centro de su sector.
- **Configuración (F7).** Nombre del portal, «avisar al narrador si se rechaza» (se guarda, pero todavía no envía
  ningún aviso: está por definir con el profesor), la etiqueta «datos de ejemplo» del encabezado y las etiquetas
  (se normalizan como `#café-viejo`; máximo 40; quitar una no cambia las historias que ya la tienen). **Los
  sectores son de solo lectura.**
- **Reiniciar datos de ejemplo.** Solo con `ALLOW_DEMO_RESET` activo y con un administrador con sesión. Borra
  **todas** las historias, también las reales, y los archivos a los que apuntan, y carga las 12 historias de
  ejemplo del diseño (`HIS-2026-001` a `012`; la siguiente historia real será la `013`). Pide escribir la palabra
  `REINICIAR`. Si hay una narradora de ejemplo (`SEED_DEMO_NARRATOR_*`), se queda con dos de ellas, como Ana en el
  diseño. **Para quitar la función:** borra `lib/seed/demo.py`, `lib/admin/demo_router.py`, su línea en
  `api/index.py`, `src/components/admin/DemoResetDialog.jsx` y la tarjeta «Datos de ejemplo» de
  `SettingsPage.jsx`; o simplemente no definas `ALLOW_DEMO_RESET`.

## API

La documentación interactiva está en `/api/docs` cuando la API corre. Rutas disponibles por ahora:

| Ruta | Qué devuelve |
|---|---|
| `GET /api/salud` | Estado de la API y de la conexión a MongoDB |
| `GET /api/config` | Nombre del portal, sectores, etiquetas, épocas y motivos de rechazo |
| `GET /api/estadisticas` | Contadores: historias publicadas, en revisión, formatos |
| `POST /api/auth/registro` | Crea una cuenta de narrador (nombre, celular, PIN) y devuelve la sesión |
| `POST /api/auth/ingreso` | Ingreso de narrador (celular + PIN) o de administrador (usuario + contraseña) |
| `GET /api/auth/yo` | El usuario de la sesión actual (requiere sesión) |
| `POST /api/medios` | Sube una foto o un audio (narrador o administrador); devuelve su URL en Blob |
| `POST /api/historias` | Envía una historia (solo narradores); queda siempre «en revisión» |
| `GET /api/historias` | Las historias publicadas que dibuja el mapa (público) |
| `GET /api/historias/{codigo}` | La ficha de una historia publicada (público; 404 si no está publicada) |
| `GET /api/historias/mias` | Las historias del narrador que ingresó, con su estado y el motivo si no se publicó |
| `POST /api/historias/{codigo}/video` | Agrega a una historia propia, todavía en revisión, el video ya subido a Blob (solo narradores) |
| `POST /api/blob-token` | **Función de Node** (`api/blob-token.js`, no está en la API de Python): entrega el permiso para subir un video directo a Blob (narradores y administradores) |
| `GET /api/admin/historias` | Historias con todo su contenido, filtradas por `estado` y `origen` (administrador) |
| `POST /api/admin/historias/{codigo}/aprobar` | Publica una historia en revisión; exige las tres comprobaciones |
| `POST /api/admin/historias/{codigo}/rechazar` | Rechaza una historia en revisión; exige un motivo de la lista |
| `POST /api/admin/historias-proyecto` | Publica una historia del equipo (origen «proyecto») |
| `PATCH /api/admin/portal` | Cambia el nombre, «avisar al rechazar» o la etiqueta de datos de ejemplo |
| `POST` / `DELETE /api/admin/etiquetas` | Agrega o quita una etiqueta |
| `POST /api/admin/reiniciar-ejemplo` | Borra todas las historias y carga las de ejemplo (solo con `ALLOW_DEMO_RESET`) |

## MongoDB Atlas

1. Crea una cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas) y un cluster gratuito (**M0**).
2. En **Database Access** crea un usuario de base de datos con una contraseña larga y el permiso
   `readWrite` **solo sobre la base `agrocultura`** (no uses un usuario administrador).
3. En **Network Access** permite el acceso desde cualquier lugar (`0.0.0.0/0`).
   Las funciones de Vercel no tienen una IP fija (cambian), por eso no se puede limitar a una IP.
   La seguridad depende entonces de la contraseña del usuario de base de datos: que sea larga y única.
4. En **Database → Connect → Drivers** copia la cadena de conexión, cambia `<password>` por la
   contraseña real y guárdala en `MONGODB_URI` (en tu `.env` para trabajo local y en las variables
   de entorno de Vercel para producción).

### Si `/api/salud` no dice `ok`

Abre `/api/salud`: cuando falla, indica el tipo de error en `causa` (y el código de MongoDB en `codigo`),
sin mostrar mensajes ni claves. También queda escrito, al inicio, en los registros de Vercel.

| `causa` | `codigo` | Qué significa | Qué revisar |
|---|---|---|---|
| `OperationFailure` | 18 | Usuario o contraseña incorrectos | La contraseña en `MONGODB_URI`: que no quede `<db_password>`, que no tenga espacios y que sus símbolos especiales estén codificados (una contraseña solo con letras y números evita el problema). Que el usuario exista en Atlas |
| `OperationFailure` | 13 | El usuario no tiene permiso | En Atlas → Database Access, el usuario debe tener `readWrite` sobre la base `agrocultura` (escrita igual que `MONGODB_DB`) |
| `ServerSelectionTimeoutError` | — | No se llega al cluster | Network Access con `0.0.0.0/0`; que el cluster no esté pausado |
| `ConfigurationError` o `InvalidURI` | — | La cadena de conexión está mal formada | Volver a copiarla desde Atlas (Connect → Drivers) |
| *(503 con "Falta la variable MONGODB_URI")* | — | La función no ve la variable | Que exista en el entorno **Production** y que se hiciera un Redeploy después de crearla |

## Accesibilidad

Pensada para quien no está acostumbrado a las pantallas (ver también la voz de «Escuchar», F9). Se revisó contra **WCAG 2.2
nivel AA** con axe-core, en **todas las pantallas y diálogos**, en escritorio y en móvil, con colores y diseño reales:
**0 violaciones** (`npm run e2e` lo repite). Lo que hay:

- **Teclado:** todo se alcanza y se usa sin ratón. El primer Tab es «Saltar al contenido». Los diálogos mantienen el Tab dentro, se
  cierran con Escape y devuelven el foco a donde estaba. Los grupos de historias del mapa y las tablas que se desplazan de lado se
  alcanzan con el teclado. Siempre hay un anillo de foco visible.
- **Lector de pantalla:** cada página pone su título en la pestaña («Mis historias · AGROCULTURA») y, al pasar a otra página, el
  foco va a su título para que se diga dónde se está. Los avisos (señal, envío, errores) se anuncian solos. Los mapas y las
  tablas tienen nombre.
- **Contraste:** los textos pequeños cumplen 4,5:1 (se oscurecieron dos grises del prototipo; ver `docs/plan-v1.md`).
- **Movimiento:** quien pide «reducir movimiento» en su teléfono no ve transiciones ni vuelos del mapa.
- **Voz:** cada página tiene «Escuchar», que la lee en voz alta con la voz del dispositivo (sin servicios de pago).
- Los textos están pensados para leerse con calma y los botones principales son grandes; las fichas y los pasos usan frases cortas.

Lo que **no** se pudo comprobar aquí: lectores de pantalla reales (TalkBack, VoiceOver, NVDA) y personas usándola. Conviene una
prueba con dos o tres familias, que enseñará más que cualquier herramienta.

## Desplegar en Vercel (paso a paso)

Un solo repositorio y un solo proyecto de Vercel sirven la interfaz, la API de Python y la función de video. **Cada `git push` a
`main` despliega a producción.** Hace falta una cuenta de Vercel (el plan gratuito sirve) y el repositorio en GitHub.

1. **Atlas listo.** Sigue [MongoDB Atlas](#mongodb-atlas): cluster gratuito, usuario de base de datos con `readWrite` solo sobre
   `agrocultura`, acceso desde `0.0.0.0/0` y la cadena de conexión.
2. **Crear el proyecto.** En Vercel: *Add New → Project*, elige el repositorio. Vercel lee `vercel.json` y ya sabe todo (framework
   Vite, `npm run build`, salida en `dist`, la API de Python en `api/index.py` y la función de Node en `api/blob-token.js`).
   En *Settings → General*, **Node.js Version: 22.x** (el aviso de que existe 26.x no importa: el proyecto fija 22).
3. **Crear el almacén de archivos.** *Storage → Create → Blob*, con acceso **Public**, y conéctalo al proyecto. Eso crea solo
   `BLOB_READ_WRITE_TOKEN`.
4. **Variables de entorno** (*Settings → Environment Variables*, entorno **Production**). **Escríbelas tú directamente ahí; nunca
   las pegues en un chat, un correo ni un archivo del repositorio.**

   | Variable | Valor |
   |---|---|
   | `MONGODB_URI` | La cadena de Atlas, con la contraseña real |
   | `JWT_SECRET` | Una cadena aleatoria de 32 caracteres o más (la receta está en [Variables de entorno](#variables-de-entorno)) |
   | `ADMIN_USER` | El usuario del administrador inicial |
   | `ADMIN_PASSWORD` | Su contraseña (10 caracteres o más). Para cambiarla después: se cambia aquí y se vuelve a desplegar |
   | `BLOB_READ_WRITE_TOKEN` | Ya la creó el paso 3 |
   | `ALLOW_DEMO_RESET` | `true` solo mientras se prueba con datos de ejemplo (ver la lista siguiente) |
   | `SEED_DEMO_NARRATOR_PHONE` y `SEED_DEMO_NARRATOR_PIN` | Opcionales: una narradora de ejemplo para las demostraciones |

5. **Desplegar** (o *Redeploy* si cambiaste variables: solo se leen al desplegar).
6. **Comprobar** (en este orden):
   1. `https://TU-PROYECTO.vercel.app/api/salud` debe decir `"estado":"ok"` y `"base_de_datos":"ok"` (si no, ver [la tabla de
      causas](#si-apisalud-no-dice-ok)).
   2. La página principal abre y muestra el mapa; «Contar una historia» pide ingresar.
   3. `/admin` deja entrar con `ADMIN_USER` y `ADMIN_PASSWORD`.
   4. Cuenta una historia de prueba con una foto y un audio, apruébala desde `/admin` y mira que salga en el mapa. Eso prueba
      la base de datos, los archivos (Blob) y la revisión juntos.
   5. Prueba **un video** de verdad (MP4 de menos de 25 MB): es lo único que no se puede probar fuera de Vercel.
   6. En un teléfono, abre la página, espera unos segundos y mira que ofrezca instalarla; luego pon el modo avión y mira que abra.

**Dominio propio (opcional).** *Settings → Domains*. No hace falta nada más: la aplicación usa direcciones relativas.

## Antes de usarla con las familias (lista de pendientes de configuración)

La plataforma nace con datos y avisos de **demostración**. Antes de recibir historias reales:

- [ ] **Quitar `ALLOW_DEMO_RESET`** (o ponerlo en `false`) y volver a desplegar. Con la variable puesta, un administrador puede **borrar
  todas las historias**, también las reales, con el botón «Reiniciar datos de ejemplo» (pide escribir `REINICIAR`, pero conviene
  que el botón no exista). Desaparece de la pantalla de Configuración.
- [ ] **Ocultar los códigos F1, F2…** poniendo `VITE_SHOW_CODES=false` en Vercel y desplegando de nuevo. Son anotaciones del diseño
  para el equipo; las familias no deben verlas. (Es una variable de *compilación*: hace falta volver a desplegar.)
- [ ] **Quitar «datos de ejemplo»** del encabezado: *Configuración → Portal → «Mostrar “datos de ejemplo”»* en apagado.
- [ ] **Sin historias de ejemplo.** Si en algún momento se pulsó «Reiniciar datos de ejemplo», hay 12 historias de ejemplo (`HIS-2026-001` a
  `012`, marcadas `ejemplo: true`) mezcladas con las reales en el mapa. Se quitan en Atlas: *Browse Collections → `agrocultura` → `historias`*,
  filtro `{ "ejemplo": true }`, seleccionarlas y borrarlas (no tocan ninguna historia real). **El botón de reinicio no sirve para esto**: borra
  todo y *vuelve a cargar* los ejemplos. Los códigos siguen desde la `013`.
- [ ] **Sin narradora de ejemplo.** Quita `SEED_DEMO_NARRATOR_*` de Vercel; la cuenta que ya se creó se borra en Atlas (colección `usuarios`, el
  documento de «Ana Beltrán» o el nombre que le hayas puesto).
- [ ] **Cambiar la contraseña del administrador** por una que no se haya compartido (variable `ADMIN_PASSWORD` y *Redeploy*).
- [ ] **Poner el nombre definitivo del portal** (*Configuración → Portal*). Hoy dice «AGROCULTURA».
- [ ] **Decidir si se avisa al narrador cuando se rechaza su historia.** La opción existe pero todavía **no envía nada** (no hay correo,
  SMS ni WhatsApp conectado); hoy el narrador lo ve en «Mis historias».
- [ ] **Confirmar con las familias la posición de los sectores.** Minca, La Tagua y San Lorenzo ya tienen un punto (el de San Lorenzo es
  «Cuchillas San Lorenzo», una cresta); **Tijereras sigue sin punto confirmado**, por eso no sale su nombre en el mapa ni su botón.
  Cuando se tenga, se cambia en `lib/seed/catalog.py` y se sube `SECTORES_VERSION`.
- [ ] **Una prueba con dos o tres familias** en sus teléfonos y con su señal (ver [Accesibilidad](#accesibilidad)).
- [ ] **Mirar el mapa en producción con señal** una vez: el fondo de OpenStreetMap no se pudo probar desde el entorno donde se construyó.

## Costos y límites

Todo funciona con planes gratuitos, sin tarjeta, mientras el proyecto sea pequeño:

| Servicio | Plan | Lo que conviene saber |
|---|---|---|
| Vercel | Hobby (gratis) | Pensado para proyectos personales o académicos; si la plataforma pasa a un uso comercial hay que cambiar de plan. Las funciones tienen límite de tiempo y de tamaño por petición (de ahí la subida directa del video) |
| MongoDB Atlas | M0 (gratis) | 512 MB. Se pausa por inactividad en algunos planes: si `/api/salud` falla de repente, mira si el cluster está pausado |
| Vercel Blob | Hobby | Cupo gratuito de almacenamiento y transferencia; las fotos se reducen a menos de 1 MB y el audio es muy liviano, pero los videos (hasta 25 MB cada uno) llenan el cupo mucho más rápido: conviene vigilarlo en el panel de Vercel |
| OpenStreetMap | Servicio comunitario | Sus [normas](https://operations.osmfoundation.org/policies/tiles/) valen para poco tráfico; si crece hay que usar un proveedor de mapas propio (se cambia en una sola constante, `src/config/map.js`) |

## Pendientes y por definir

Lo que **no** está en la versión 1, para decidir en las mejoras que siguen:

- **Por definir con el profesor:** el nombre definitivo del portal y si se avisa al narrador al rechazar su historia (y por qué medio).
- **Fases futuras (no se construyeron):** F14 Recorridos 360° y F15 Avatares en realidad aumentada (aparecen como «Próximamente»).
- **Mejoras que quedaron anotadas:** audio de más de 3,5 MB para el equipo (pasarlo a subida directa como el video); envío de los
  borradores con la aplicación cerrada (solo existe en Chrome y Edge); recuperación de la clave olvidada de un narrador (hoy un
  administrador borra la cuenta en Atlas); limpieza de archivos huérfanos en Blob; que el recorrido de punta a punta corra en el CI.
- **Sin comprobar fuera del entorno de desarrollo:** iPhone (Safari), lectores de pantalla reales, un video subido de verdad a Blob y el
  fondo del mapa con la red real. Todo lo demás está probado (ver [Pruebas](#pruebas)).

## Estructura

```
docs/diseno/    diseños de referencia aprobados (no se despliegan)
docs/plan-v1.md plan y decisiones acordadas
src/            frontend React + Vite (components, pages, hooks, services, offline)
public/         recursos estáticos de la PWA
api/            punto de entrada del backend (api/index.py) y la función de Node del video (api/blob-token.js)
lib/            código compartido del backend, un paquete por tema
tests/          pruebas del backend
e2e/            recorrido de punta a punta y accesibilidad en un navegador real (npm run e2e)
```

## Estado

La versión 1 se construye por bloques (ver `docs/plan-v1.md`).

- [x] Bloque 0: andamiaje, pruebas y CI
- [x] Bloque 1: base visual, encabezado, menú, conexión simulada, voz, `/api/config` y `/api/estadisticas`
- [x] Bloque 2: registro e ingreso (F2)
- [x] Bloque 3: contar una historia con voz, texto y fotos; «Mis historias» (F3, F4, F5)
- [x] Bloque 4: revisión, historias del proyecto, configuración y reinicio de ejemplo (F6, F7, F12)
- [x] Bloque 5: mapa de historias y ficha (F1, F8)
- [x] Bloque 6: funciona sin conexión: aplicación instalable, borradores en el teléfono y envío al volver la señal (F10)
- [x] Bloque 7: filtros y búsqueda en el mapa (F11) y video con subida directa a Blob (F13)
- [x] Bloque 8: accesibilidad (WCAG 2.2 AA), recorrido de punta a punta, README completo y despliegue verificado

**La versión 1 está terminada.** En `docs/comparacion/` hay capturas de cada bloque frente al diseño aprobado. Lo que falta para
usarla con familias está en [Antes de usarla con las familias](#antes-de-usarla-con-las-familias-lista-de-pendientes-de-configuración)
y lo que queda por mejorar en [Pendientes y por definir](#pendientes-y-por-definir).
