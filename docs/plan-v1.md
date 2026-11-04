# Plan de la versión 1

Documento de trabajo del equipo Protopía. Resume lo acordado para construir AGROCULTURA v1
a partir de los diseños aprobados en `docs/diseno/`. Si algo cambia, se actualiza aquí.

## Reglas de trabajo

- Código y comentarios en inglés; textos de la interfaz y documentación en español.
- Commits pequeños y claros, **directamente en `main`**. Cada push a `main` despliega a producción en
  Vercel. Al cerrar cada bloque se entrega un resumen para revisión.
- Sin dependencias pesadas ni servicios de pago. Sin TypeScript. No se construyen F14 ni F15.
- Las pruebas de cada bloque se escriben junto con el bloque (ver "Pruebas").
- El diseño aprobado manda: no se rediseñan pantallas, textos, colores ni flujos.
  Cada cambio visible respecto al diseño se anota en el resumen del bloque.

## Decisiones acordadas

| Tema | Decisión |
|---|---|
| Ingreso del narrador | Nombre, celular y una clave corta (PIN) de 4 a 6 dígitos. Botón "Primera vez / Ya tengo cuenta". Correo opcional (o fuera del modal si lo complica). El PIN se guarda con hash (bcrypt), nunca en texto plano. Se limitan los intentos fallidos por celular. |
| Ingreso del administrador | Usuario y contraseña, como en el diseño. Usuario y clave salen de variables de entorno en el seed. |
| Video (F13) | Tope de 25 MB. La subida va **directo del navegador a Vercel Blob** (client upload). La función Node (`api/blob-token.js`) solo entrega el token; el archivo no pasa por ella (el cuerpo de las funciones de Vercel está limitado a ~4,5 MB). Si el video falla por mala conexión, no bloquea el envío del resto de la historia. |
| Fotos y audio | Se comprimen en el dispositivo y se suben por la API de Python con el SDK `vercel.blob` (caben en el límite de 4,5 MB). |
| "Reiniciar datos de ejemplo" | Solo para un administrador con sesión, con confirmación cuyo texto dice claramente que borra **todas** las historias, incluidas las reales. Fácil de quitar: una sola ruta, un solo componente y la variable `ALLOW_DEMO_RESET`, que se desactiva antes de usar la plataforma con familias reales. |
| Sectores | Solo lectura (como en el diseño). Etiquetas editables. Los centros de los sectores son **provisionales** hasta confirmarlos con las familias. |
| Narradora de ejemplo | Opcional. Se crea en el seed solo si existen `SEED_DEMO_NARRATOR_PHONE` y `SEED_DEMO_NARRATOR_PIN`. Ninguna clave se escribe en el código. |
| Lista y mapa | La lista junto al mapa se reduce a la zona visible. Al abrir se ve todo el territorio. |
| Texto del rechazo | El del prototipo de administración: "El narrador verá este motivo en «Mis historias»". |
| Por definir con el profesor | Nombre definitivo del portal; si se avisa al narrador cuando se rechaza su historia. Se dejan marcados en la interfaz. |
| Mapa sin conexión | Solo se guardan en caché las teselas que se visitan (la política de OpenStreetMap desaconseja la descarga masiva). Sin mapa guardado, el GPS y la lista de sectores siguen funcionando. |

## Arquitectura (tres capas, monolito modular)

```
React (components/pages) → services/ + offline/ → /api (FastAPI: HTTP + Pydantic)
   → lib/<tema>/service.py (reglas de negocio)
   → lib/<tema>/repository.py (único lugar con pymongo) → MongoDB Atlas
```

Cambiar la base de datos implica reescribir solo los `repository.py`. El frontend solo conoce el
contrato `/api` (documentado por FastAPI en `/api/docs`).

## Colecciones

`usuarios`, `historias`, `sectores`, `etiquetas`, `configuracion` y `contadores` (para el
consecutivo `HIS-AAAA-NNN`). Las referencias (sector, autor, etiquetas) se validan en el código.
Ubicación de cada historia: GeoJSON Point con índice `2dsphere`.

## Pruebas

- Backend: `pytest` + `httpx` en `tests/`, con base de prueba separada (nunca la real).
  Por defecto usa una base falsa en memoria (`mongomock`), sin configurar nada. Las pruebas
  marcadas `real_mongo` (consultas geoespaciales) solo corren si se define `TEST_MONGODB_URI`
  (así corren en el CI de GitHub).
- Frontend: Vitest + Testing Library, cada prueba junto al componente que prueba.
- Opcional al final: recorrido de punta a punta con Playwright en `e2e/`.
- Casos que se cubren (no se busca cobertura total):
  1. Registro e ingreso, y que `/admin` rechace a quien no sea administrador (F2, F7).
  2. Una historia nueva queda "en revisión" y no sale en el mapa hasta aprobarse (F6, F1).
  3. El rechazo exige un motivo.
  4. El borrador sin conexión se guarda y se envía al volver la señal (F10).

## Orden de construcción

| Bloque | Contenido | Pruebas del bloque |
|---|---|---|
| 0 | Andamiaje: Vite + React, FastAPI mínimo, `vercel.json`, CI, README | Infraestructura de pruebas, protección de la base de prueba |
| 1 | Base: estilos, tipografías, kit de interfaz, encabezado, menú, simulador de conexión, voz, `/api/config`, `/api/estadisticas`, `/api/salud` | Conexión real/simulada, voz, config y estadísticas |
| 2 | F2: registro e ingreso con JWT, PIN con hash, límite de intentos, rutas protegidas | Caso 1 (autenticación) |
| 3 | F3 + F4 + F5: contar una historia, grabadora, fotos, subida a Blob | Caso 2 (creación en revisión), idempotencia del caso 4 |
| 4 | F6 + F7: administración, revisión, historias del proyecto, configuración, reinicio | Casos 1 (rutas `/api/admin/*`), 2 (aprobar) y 3 |
| 5 | F1 + F8: mapa Leaflet, agrupación, ficha de historia | Mapa, zona visible (solo con Mongo real) |
| 6 | F10: PWA, borradores en IndexedDB, sincronización | Caso 4 completo |
| 7 | F11, F13: búsqueda, filtros, distintivos, video | Filtros, función de token, video pendiente |
| 8 | Cierre: accesibilidad, README completo, despliegue verificado, recorrido e2e opcional | e2e opcional |

Al cerrar cada bloque se compara el resultado con el diseño de referencia (qué se parece, qué cambió).

## Estado de avance

| Bloque | Estado |
|---|---|
| 0 Andamiaje | Hecho. Pruebas: 9 de backend |
| 1 Base | Hecho. Pruebas: 18 de backend (+2 que solo corren con Mongo real) y 36 de frontend. Comparación en `docs/comparacion/bloque-1/` |
| 2 Ingreso (F2) | Hecho. Pruebas: 77 de backend (+2 con Mongo real) y 74 de frontend. Comparación en `docs/comparacion/bloque-2/` |
| 3 Contar (F3, F4, F5) | Hecho. Pruebas: 123 de backend (+3 con Mongo real) y 153 de frontend. Comparación en `docs/comparacion/bloque-3/` |
| 4 Administración (F6, F7, F12) | Hecho. Pruebas: 205 de backend (+4 con Mongo real) y 226 de frontend. Comparación en `docs/comparacion/bloque-4/` |
| 5 Mapa y ficha (F1, F8) | Hecho. Pruebas: 218 de backend (+4 con Mongo real) y 276 de frontend. Comparación en `docs/comparacion/bloque-5/` |
| 6 Sin conexión (F10) | Hecho. Pruebas: 262 de backend (+4 con Mongo real; sin cambios en este bloque) y 376 de frontend. Comparación en `docs/comparacion/bloque-6/` |
| 7 Filtros y video (F11, F13) | Hecho. Pruebas: 290 de backend (+4 con Mongo real) y 521 de frontend (incluye las de la función de Node). Comparación en `docs/comparacion/bloque-7/` |
| 8 Cierre | Hecho. Pruebas: 290 de backend (+4 con Mongo real), 535 de frontend (incluye axe sobre cada pantalla) y 13 del recorrido de punta a punta (`npm run e2e`). Comparación: no cambia el aspecto, solo se oscurecen dos grises |

## Notas de construcción

- Pequeñas adiciones al diseño, anotadas para que el equipo las conozca:
  - El botón «Escuchar» está en todas las páginas del portal (la tarjeta «Voz e íconos» del diseño dice
    que cada página lo tiene; el prototipo solo lo cableaba en algunas).
  - Al perder o recuperar la señal (real o simulada) sale un aviso, como en el diseño.
  - Si el dispositivo no puede leer en voz alta, se avisa en lugar de no hacer nada.
  - El texto «datos de ejemplo» del encabezado se controla con la opción `datos_de_ejemplo` de la
    configuración (el seed la activa; se apaga antes de usar la plataforma con familias reales).
- Adiciones del bloque 3 al diseño (para revisar con el equipo):
  - Botón **«Oír mi audio»** junto a «Grabar de nuevo» y «Quitar»: para comprobar la grabación antes de enviarla.
  - Las fotos agregadas muestran una **miniatura** además del nombre y el peso.
  - Botón **«Usar mi ubicación»** (GPS) debajo del mapa del paso 2, además de tocar un sector. El mapa es
    Leaflet de verdad (el del diseño era un dibujo); si no hay señal ni mapa guardado, los botones de sector y el
    GPS siguen funcionando.
  - La lista de «Mis historias» y el contador junto a «Mis historias» en el menú vienen del servidor; el botón
    «Ver ficha» llega con el mapa (bloque 5).
  - El título exige al menos 3 letras (lo mismo que valida el servidor).
  - Si no se elige ninguna etiqueta, se envía `#café` (como hacía el prototipo) y se muestra en el paso 3.
- Adiciones del bloque 4 al diseño (para revisar con el equipo):
  - La revisión muestra los **archivos** de la historia: un reproductor de audio (el mismo del diseño de la ficha),
    las fotos y el video. Sin verlos, la revisión no sirve para decidir.
  - «Nueva historia del proyecto» sube **archivos reales**: el selector «Formatos que vas a subir» (tres botones
    de ejemplo) pasó a ser «Agregar foto» y «Agregar audio». El audio es un archivo que el equipo ya tiene
    (máximo 3,5 MB por ahora; si hacen falta audios más grandes se puede pasar a subida directa como el video).
  - La **época no tiene valor por defecto** en ese formulario (el prototipo traía «1960 a 1979» puesto): un valor
    puesto de antemano pasa desapercibido.
  - En la tarjeta «Portal»: un interruptor para **apagar «datos de ejemplo»** del encabezado antes de usar la
    plataforma con familias reales (el prototipo no tenía cómo).
  - «Reiniciar datos de ejemplo» pide escribir **REINICIAR**, además del texto que dice que borra todas las
    historias, también las reales.
  - El nombre del portal se guarda al salir del campo (o con Enter) y avisa «Nombre del portal guardado.».
  - **Lugar libre** (corrección posterior al bloque 5): una historia puede ir en cualquier punto de la zona; el
  sector es opcional y lo calcula el servidor (el más cercano dentro de 3 km; si no, «Otro lugar de la zona»). El
  diseño decía «Toca el sector en el mapa»; ahora dice «Toca el lugar en el mapa» y los botones de sector son
  atajos. «Nueva historia del proyecto» también elige el lugar en el mapa (ya no hay lista de sectores).
- **Privacidad y nombre del lugar** (decididos con el equipo): lo público ve un punto aproximado (cuadrícula de
  ~500 m) de las historias contadas con GPS o tocando el mapa, **de la comunidad y también del equipo** (decidido
  después del bloque 6); el exacto solo lo ven los administradores. Campo
  opcional «Nombre del lugar» (hasta 80 letras) en el paso 2 y en «Nueva historia del proyecto». **Tijereras**:
  no se pidió su posición; se queda provisional, sin nombre en el mapa y sin botón de atajo.
- Adiciones y decisiones del bloque 5:
  - El mapa es **Leaflet de verdad** (el del diseño era un dibujo): lleva control de zoom, la atribución de
    OpenStreetMap y agrupa los pines cercanos (un círculo verde oscuro con cuántas historias hay; al tocarlo se acerca).
    Se quitó la nota «Mapa ilustrativo, no a escala».
  - Los nombres de los sectores se dibujan sobre el mapa como en el diseño (en mayúsculas separadas).
  - **Cambio respecto a lo planeado:** no hay consulta por zona (`bbox`) en el servidor. El mapa carga todas las
    publicadas y la lista se reduce en el navegador; es más simple y es lo que necesita el modo sin conexión (bloque 6).
  - La **barra de filtros** del diseño (sectores, origen, búsqueda, época, formato) llegó con el bloque 7 (F11).
  - La miniatura de la lista es la primera foto de la historia (si no tiene, la imagen a rayas del diseño).
  - La ficha trae «Abrir en Google Maps» y «Abrir en Apple Maps» (enlaces, sin llaves ni costo).
  - Como en el diseño, la ficha escribe «La Tagua, zona de Minca» para los sectores que no son Minca.
  - El reproductor de audio de la ficha es real; en las historias de ejemplo (sin archivo) está apagado y lo dice.
  - «Ver ficha» en las tablas: «Mis historias» (solo publicadas), «Revisión» (aprobadas y rechazadas, que se
    abren desde la lista de administración) e «Historias del proyecto».
- «Avisar al narrador si se rechaza» solo guarda la opción: todavía no hay aviso (correo, SMS o WhatsApp) que
  enviar; depende de lo que decida el profesor.
- **Nombres de los sectores en el mapa** (corregido por segunda vez): solo se escriben con el mapa cerca (nivel 13 o
  más) y solo los sectores que están a la vista, como un mapa real. Antes salían con el mapa *alejado* y desaparecían
  al acercar: estaba al revés.
- Adiciones y decisiones del bloque 6 (sin conexión, F10; para revisar con el equipo):
  - Vuelven los textos del diseño que habían quedado temporales: «Se guarda en este dispositivo hasta que la
    envíes», la tarjeta «Todo se guarda en el dispositivo mientras la cuentas…», el aviso del último paso («Se
    guarda en el dispositivo y se envía sola cuando vuelva la señal»), el botón **«Guardar en el dispositivo»** sin
    señal, el aviso de «Mis historias» («Tus borradores están guardados en este dispositivo…») y el estado
    «Borrador» con «Se envía cuando haya señal».
  - **Los textos solo prometen lo que el teléfono cumple.** Si IndexedDB no está disponible (ventana privada), los
    mismos textos dicen que la historia se queda solo en la página. Esa variante no está en el diseño.
  - **Historia en curso guardada** (no estaba en el diseño, pero «todo se guarda en el dispositivo mientras la
    cuentas» lo pide): al volver a «Contar una historia» aparece lo que quedó a medias, en el mismo paso, con un
    aviso y el botón «Empezar de nuevo». Una por narradora.
  - **Código «Por asignar»** en los borradores: el código `HIS-AAAA-NNN` es consecutivo y lo da el servidor; el
    prototipo se lo inventaba en el teléfono, lo que habría producido códigos repetidos.
  - **«Reintentar» y «Quitar»** en un borrador que el servidor rechazó (no estaba en el diseño). Quitar pregunta
    antes. Un borrador rechazado no se reintenta solo, para no repetir el mismo error cada vez que vuelve la señal.
  - **Reintento automático al minuto** si el servidor falla o la conexión se cae durante el envío. Es seguro porque
    cada historia lleva su `client_id`.
  - **No hay envío con la aplicación cerrada.** El envío en segundo plano (Background Sync) solo existe en Chrome y
    Edge, no en iPhone ni en Firefox, y las narradoras usan de todo. Los borradores salen al abrir la aplicación con
    señal. Si el equipo prefiere ofrecerlo donde exista, se puede añadir después sin cambiar nada de lo anterior.
  - **El service worker guarda la aplicación y los pedazos de mapa vistos, nunca respuestas de la API.** Los datos
    (configuración, historias publicadas, la lista de la narradora) los guarda la propia aplicación en IndexedDB:
    así lo privado de una persona no queda en un caché que otra persona del mismo teléfono pueda leer, y se borra
    al salir.
  - Los pedazos de mapa se piden con CORS (`crossOrigin` en `src/config/map.js`) para poder guardarlos sin que el
    navegador los cuente como varios MB cada uno. El servicio de OpenStreetMap lo permite; un proveedor nuevo debe
    permitirlo también.
  - **Actualizaciones de la aplicación** (decidido con el equipo): aviso «Hay una versión nueva» con «Actualizar» y
    «Después». La versión nueva espera hasta que la persona acepta (actualizar recarga la página, y no debe pasar
    sin avisar mientras alguien graba). Se busca al abrir, cada hora y al volver la aplicación al frente.
  - El indicador «Simular conexión» del encabezado se pone amarillo también cuando la señal se pierde de verdad (antes
    solo lo hacía con el interruptor).
  - Diferencia menor con el diseño: el aviso del último paso usa el ícono de «sin señal» cuando no hay señal (el
    prototipo dejaba el de wifi).
- Comprobado en producción tras el despliegue: Vercel sirve `sw.js` (`application/javascript`, sin caché larga, así
  que las versiones nuevas se detectan) y `manifest.webmanifest` (`application/manifest+json`); `/api/salud` responde ok.
- No se pudo comprobar aquí: el comportamiento en un iPhone (Safari), el aviso de instalación de Chrome en un
  teléfono real, y el servicio de teselas de OpenStreetMap con CORS desde la red real (se comprobó con un servidor
  de teselas de mentira: las teselas se piden con CORS, se guardan y se dibujan sin conexión).
- Adiciones y decisiones del bloque 8 (accesibilidad y cierre; para revisar con el equipo):
  - **Dos grises del prototipo se oscurecieron** para cumplir el contraste AA (4,5:1) en los textos pequeños: `--texto-4` de `#6b776f` a
    `#5f6c64` y `--texto-5` (los códigos F del menú) de `#8a968e` a `#5f6c64`, y el color de los nombres de sector sobre el mapa de `#5e7a66` a
    `#3f5a49`. A simple vista casi no se nota; es el único cambio visible respecto al diseño en este bloque.
  - Se agregaron, sin cambiar el aspecto: «Saltar al contenido», título de pestaña por página, foco al título al cambiar de página, Tab
    contenido dentro de los diálogos, `prefers-reduced-motion`, la tabla que se desplaza de lado enfocable y los grupos de historias del mapa
    como un solo botón. Resultado en navegador real (axe, WCAG 2.2 AA, escritorio y móvil, todas las pantallas y diálogos): 0 violaciones.
  - **Recorrido de punta a punta** con Playwright (`npm run e2e`): API real sobre una base en memoria, sin servicios externos. No corre en el CI
    (necesita un navegador y tarda); se corre a mano.
  - La lista «Antes de usarla con las familias» del README reúne lo que hay que apagar o cambiar para pasar de demostración a uso real.
    Ojo: «Reiniciar datos de ejemplo» **vuelve a cargar** los ejemplos; no limpia. Quitarlos es borrar en Atlas las historias con `ejemplo: true`.
- Adiciones y decisiones del bloque 7 (filtros y video; para revisar con el equipo):
  - **Filtros (F11):** la barra del diseño, con estas diferencias: la búsqueda **no distingue tildes ni mayúsculas** y pide
    todas las palabras (el prototipo buscaba el texto entero tal cual); hay una pestaña **«Otro lugar»** (solo si hay
    historias fuera de los sectores, que el prototipo no tenía porque todas estaban en un sector); al cambiar un filtro
    el mapa **se acerca a lo que queda** (si no, la lista, que muestra solo la zona visible, parecería vacía); y el
    «sin resultados» ofrece «Quitar los filtros». La lista pública del mapa trae ahora las etiquetas.
  - **Video (F13):** «Fotos y video» y «Agregar video» como en el diseño (hasta 25 MB; MP4, MOV o WebM), con subida directa
    a Blob y la función `api/blob-token.js` (ver README). El tope son **25 000 000 bytes** (como los cuenta el teléfono y
    `formatBytes`), igual en la función, la API y la pantalla.
  - **La historia no espera al video** (decidido con el equipo: «si el video falla por mala conexión, no bloquea el envío del
    resto»). Para que el video no se pierda en ese caso se agregó, **sin que estuviera en el plan**, una ruta
    `POST /api/historias/{codigo}/video` (solo el autor, solo en revisión, un video, idempotente) y el video pendiente:
    queda en el teléfono, se reintenta solo (5 veces) y «Mis historias» lo muestra con Reintentar y Quitar. Si el equipo
    prefiere que un video que falla simplemente se descarte, es quitar esa ruta y la fase «video» de `offline/outbox.js`.
  - La función de Node solo ve el JWT (no consulta la base): un usuario borrado con sesión vigente podría subir un video de
    hasta 25 MB, pero ninguna historia lo aceptaría (la API sí consulta). Los videos que no llegan a una historia quedan
    huérfanos en Blob, como las fotos.
  - **Videos de las historias del equipo:** suben antes de publicar y, si fallan, la historia no se publica sin ellos.
  - En `npm run dev` + `uvicorn` (forma 2) no hay `/api/blob-token`: el video avisa que no está disponible. Hace falta `vercel dev`.
  - **Nombres de los sectores** corregidos (segunda vez): solo con el mapa cerca, ver más arriba. **Puntos de las historias del
    equipo:** también aproximados al público; el exacto solo lo ve el administrador (decidido tras el bloque 6).
- Convención de CSS: todo en `border-box`, salvo donde el diseño depende del `content-box` por defecto
  (por ejemplo la tarjeta «Depende de», los pasos del indicador, las etiquetas de fotos y formatos, la tarjeta del formulario y el mapa del paso 2). Al reproducir cada pantalla hay que revisar ese detalle.
- **Posiciones de los sectores** (versión 2): Minca ya era correcta; La Tagua y San Lorenzo salen de puntos de
  Google Maps que pasó el equipo (el de San Lorenzo es «Cuchillas San Lorenzo», una cresta: confirmar con las
  familias). **Pendiente: Tijereras**, que sigue con un punto provisional y sin nombre en el mapa. Al corregirlo se
  sube `SECTORES_VERSION` y las historias ubicadas «en el sector» se mueven solas.
- Starlette recomienda `httpx2` para su `TestClient`; se mantiene `httpx` como se acordó y se silencia
  solo ese aviso en `pytest.ini`. Migrar es cambiar una línea de `requirements-dev.txt`.
- Versiones fijadas tras el primer despliegue: Node 22.x (`engines`) y Python 3.12 (`.python-version`).
- El catálogo (sectores, etiquetas, configuración) se carga solo la primera vez que la API ve una base
  vacía (`lib/core/bootstrap.py`); el administrador inicial se creará igual desde el bloque 2.

### Cambios al modal «Ingresar» respecto al diseño aprobado (para el profesor)

El prototipo pedía «Tu nombre» y «Número de celular», sin contraseña y con la nota «los datos no se guardan».
Para que el ingreso sea real y seguro se agregó:

1. Un campo de **clave corta (PIN) de 4 a 6 números**. Al crear la cuenta se ve en pantalla (para no
   equivocarse al escribirla); al ingresar queda oculto.
2. Un selector **«Primera vez / Ya tengo cuenta»**. Con «Ya tengo cuenta» se pide solo celular y clave.
3. El botón dice **«Crear cuenta»** la primera vez y **«Ingresar»** después.
4. El texto de ayuda cambió: de «Sin correo ni contraseña… no se guardan» a «Sin correo: solo tu celular y
   una clave corta…».
5. Un recuadro rojo con el mensaje del servidor si algo falla (clave incorrecta, demasiados intentos, sin señal).

Se quitó el texto «Prototipo: cualquier usuario y contraseña sirven» de las pantallas de administrador, y los
valores de ejemplo que venían escritos de antemano. El correo no se pide en la versión 1.
