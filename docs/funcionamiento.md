# Cómo funciona AGROCULTURA

El detalle, función por función, de lo que hace la plataforma y las reglas que sigue. Para un resumen, mira el [README](../README.md).
Las decisiones y los cambios respecto al diseño aprobado están en [`plan-v1.md`](plan-v1.md).

## Ingreso y sesiones

- **Un solo ingreso para todos.** El botón «Ingresar» abre una sola ventana con **Usuario** y **Contraseña**, sea quien
  sea la persona (familia o equipo), y debajo «¿No tienes cuenta? **Crea una**», que cambia al formulario de crear cuenta
  (con «¿Ya tienes cuenta? Ingresa» para volver). Nadie tiene que decir qué tipo de persona es: **la cuenta lo dice** y
  el servidor responde con el rol. Cualquier fallo responde lo mismo, *«Usuario o contraseña incorrectos.»*, para no
  revelar si la cuenta existe. La tarjeta de `/admin` («Acceso del equipo») usa el mismo ingreso.
- **Narrador:** crea su cuenta con **solo dos datos: un nombre de usuario y una contraseña**. No se piden correo, celular
  ni nombre aparte.
  - *Nombre de usuario:* de 3 a 40 caracteres. Es también **el nombre que se muestra en sus historias** (en el mapa, en la
    ficha y en la revisión), tal como lo escribió. Es **único**: «Ana Beltrán», «ana beltrán» y « ANA  BELTRÁN » son la
    misma cuenta, y quien llegue después recibe *«Ese nombre de usuario ya está en uso. Elige otro.»*. No puede incluir un
    número de celular (las historias muestran este nombre a todo el mundo y no debe salir un teléfono por descuido), ni
    es posible elegir el usuario del administrador. Al ingresar no importan las mayúsculas.
  - *Contraseña:* **puede ser cualquier cosa** (letras, números, espacios, símbolos, tildes), siempre que no esté vacía y
    tenga **6 caracteres o más** (el máximo técnico es 72 bytes, por la forma como se protege). No se recorta ni se
    cambia: se compara tal como se escribió, y aquí sí importan las mayúsculas. En el formulario de crear cuenta se ve
    mientras se escribe, para no equivocarse (no hay recuperación), con la casilla «Mostrar la contraseña» para ocultarla.
  - Se guarda solo con hash (bcrypt), nunca en texto plano. La sesión dura **30 días**, para que pueda usar la
    aplicación sin señal.
- **Cuentas anteriores (celular y PIN):** las familias que se registraron antes de que existieran los nombres de usuario
  siguen entrando igual: su usuario es su número de celular (se acepta con `+57`, espacios o guiones) y su contraseña es su
  PIN de 4 a 6 números. No hace falta migrar nada.
- **Administrador:** entra con usuario y contraseña. Los define `ADMIN_USER` y `ADMIN_PASSWORD`; la aplicación
  crea al administrador sola en la primera petición. **La variable manda:** para cambiar la contraseña, cambia
  `ADMIN_PASSWORD` en Vercel y haz un Redeploy. La sesión dura **8 horas**.
  Ese es el **administrador principal**: no se puede desactivar desde el panel. Desde **Administradores** (menú de
  administración) **solo él** puede crear otros administradores (usuario, nombre y contraseña de **10 caracteres o
  más**), desactivarlos y reactivarlos. Los administradores creados así hacen todo lo demás (revisar, publicar,
  configurar), pero no ven esa sección ni pueden gestionar administradores. Cada cuenta guarda quién la creó y cuándo,
  y quién la desactivó. Desactivar cierra su sesión de inmediato.
- **Intentos fallidos:** como máximo **5 intentos cada 15 minutos por cuenta (según el nombre de usuario, escrito como se escriba)**. Pasado el límite
  se bloquea aunque se escriba la clave correcta, hasta que termine la ventana de 15 minutos.
- **Narradora de ejemplo (opcional):** si defines `SEED_DEMO_NARRATOR_PHONE` y `SEED_DEMO_NARRATOR_PIN`
  (y opcionalmente `SEED_DEMO_NARRATOR_NAME`), se crea una cuenta de ejemplo (una «cuenta anterior»: entra con ese
  celular como usuario y ese PIN como contraseña). Nunca se modifica después.
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
- El lugar tiene **dos opciones** (ver «Privacidad: lugar, nombre y autorización»): *Lugar aproximado*, que se elige tocando un sector, tocando
  el mapa o con el botón «Usar mi ubicación» (el GPS del teléfono funciona sin señal) y se guarda como un punto GeoJSON `[longitud, latitud]`
  con un índice `2dsphere`; y *Sin ubicación*, que no guarda ningún punto (el campo `ubicacion` ni existe en la historia: el índice
  salta lo que no tiene punto).

## Mapa y ficha de la historia

- **Filtros y búsqueda (F11).** Sobre el mapa está la barra del diseño: pestañas de **sector** (con cuántas historias
  muestra cada una con los otros filtros; «Todos» incluye **todas**, también las que no tienen ubicación; aparece «Otro lugar» si hay historias
  con un lugar fuera de los sectores, y las historias sin ubicación no están en ningún sector), de
  **origen** (Todas, Comunidad, Proyecto), una **búsqueda** y los menús de **época** y **formato**. Filtran el mapa y
  la lista a la vez y funcionan sin conexión (se hacen en el teléfono con las historias que ya tiene). La búsqueda
  mira el título, quién la cuenta (el nombre que lee el público), el nombre del lugar, la finca, el sector, la época y las etiquetas, **sin importar tildes ni
  mayúsculas** («cafe» encuentra «café») y exige todas las palabras, en cualquier orden. Al cambiar un filtro el mapa
  se acerca a lo que queda (la búsqueda espera a que se deje de escribir). Sin resultados dice «No hay historias con
  estos filtros» y ofrece «Quitar los filtros». Por eso `GET /api/historias` ahora trae también las `etiquetas`.

- **Qué se ve en el mapa.** `GET /api/historias` es público y devuelve **solo** las historias publicadas (más
  nuevas primero, hasta 1000), con lo que necesita el mapa: código, título, quién la cuenta, sector, época,
  formatos, origen, el punto y la primera foto. **Nunca** lleva el texto, el autor, el identificador del borrador
  ni nada de la revisión. Una historia sin ubicación viene con `con_ubicacion: false` y **sin punto, sin sector y sin nombre
  de lugar**; una publicada sin nombre trae «Narrador anónimo» y `anonima: true`. `GET /api/historias/{codigo}` es la ficha: también pública y también solo de historias
  publicadas (una en revisión, rechazada o inexistente responde 404).
- **La zona visible.** El mapa carga todas las publicadas de una vez, las agrupa cuando están cerca y la lista
  de al lado muestra las que están en la zona que se ve (se actualiza al mover o acercar el mapa) **y siempre las que no tienen
  ubicación**, que nunca están «en una zona» y llevan la etiqueta «Sin ubicación en el mapa». Así
  también funciona sin conexión, sin pedir datos al servidor cada vez que se mueve el mapa.
  El índice `2dsphere` de `ubicacion` queda listo por si algún día hace falta consultar por zona en el servidor.
- **Fondo del mapa.** OpenStreetMap, en una sola constante (`src/config/map.js`) para cambiarlo después por un
  mapa de relieve sin tocar componentes. El servicio gratuito de OpenStreetMap tiene
  [normas de uso](https://operations.osmfoundation.org/policies/tiles/) para poco tráfico; si el proyecto crece
  habrá que pasar a un proveedor propio. Los pedazos que la persona ya vio se guardan para el modo sin conexión
  (el proveedor debe permitir CORS; el de OpenStreetMap lo permite).
- **El lugar puede ser cualquiera del área del mapa.** Los sectores **no son un límite** del territorio: son nombres de referencia.
  Al contar una historia con *lugar aproximado* se toca **cualquier punto del mapa** (o «Usar mi ubicación»); los botones de sector son
  atajos. El área del mapa del formulario es **una sola constante**, `ZONE` en `src/config/map.js` (sur 10.15, norte 11.50, oeste −74.70,
  este −73.20: unos 150 × 164 km, la vertiente del Magdalena de la Sierra Nevada de Santa Marta con holgura, desde la costa hasta más allá
  de la cumbre y desde la Ciénaga Grande hasta el pie de monte de Aracataca y Fundación). Un punto fuera de ella no se acepta y el mapa no
  deja alejarse más; el zoom mínimo se calcula a partir de la constante. Para ensancharla o estrecharla se cambian esas cuatro cifras. Quien
  esté más lejos puede elegir «Sin ubicación». El **sector se calcula en el servidor a partir del punto**: es el más cercano dentro de 3 km
  (`SECTOR_RADIUS_KM`), o ninguno, y entonces se muestra «Otro lugar de la zona». Lo que mande el teléfono como sector se ignora. Un sector con
  punto provisional solo cuenta si la persona lo eligió. Nada del servidor ni de la revisión decide que una historia está «dentro» o «fuera»:
  el equipo confirma que *se relaciona con la zona cafetera de Minca y sus alrededores*.
- **Privacidad: lugar, nombre y autorización.** Es lo que sale de las entrevistas.
  - **Lugar, dos opciones** (`ubicacion_modo`). *Aproximada*: el servidor guarda el punto exacto, **que solo ven los administradores** (al
    revisar y en «Historias del proyecto»), y el mapa, la lista y la ficha públicos muestran **un punto redondeado a una cuadrícula de unos
    500 m** (`GRID_DEGREES` en `lib/stories/privacy.py`), **sea de la comunidad o del proyecto**: las historias de una misma cuadrícula se ven
    en el mismo sitio y los números exactos no salen en ninguna respuesta pública. La ficha y los enlaces a Google/Apple Maps usan ese punto
    aproximado y lo avisan. No se redondean las historias ubicadas con un botón de sector (es el centro del sector, no la posición de nadie).
    *Ninguna* («Sin ubicación»): **no se guarda ningún punto**, aunque el teléfono lo mande; tampoco sector. Lo único que se guarda es el
    **nombre de referencia** que la persona escriba, y lo ven solo los administradores. El público recibe `lat`, `lon`, `sector_id` y
    `lugar_nombre` vacíos y `con_ubicacion: false`; la ficha dice «Esta historia no tiene ubicación en el mapa» y no ofrece mapas.
  - **«Publicar sin mi nombre»** (`anonima`). El nombre real se guarda siempre (`narrador_nombre`) para el equipo y para su narrador; en
    todas las respuestas **públicas** (lista, ficha, búsqueda) sale «Narrador anónimo». El texto de búsqueda que se guarda tampoco lleva el
    nombre real. Se avisa que tampoco escriba su nombre en el título ni en la historia.
  - **Autorización obligatoria** (`consentimiento`). En el paso «Revisar y enviar» hay una casilla con el texto de lo que se eligió:
    *con nombre / sin nombre* × *lugar aproximado / sin ubicación* (cuatro textos, en `lib/stories/consentimiento.json`, el mismo archivo
    que lee la aplicación: así lo que se ve es lo que el servidor tiene versionado, también sin señal). Si se cambia lo que el texto dice,
    la casilla se desmarca. Sin marcarla no se puede enviar ni guardar en el dispositivo. La historia guarda `{version, variante, de,
    aceptado_en}`; la fecha es la del teléfono (una historia guardada sin señal se envía días después) si es creíble, y si no, la del
    servidor. Si la versión del texto cambió y el teléfono tiene una antigua, el servidor la rechaza con «El texto de la autorización
    cambió. Actualiza la página». El interruptor es `EXIGIR_CONSENTIMIENTO` en `lib/stories/consent.py` (está encendido). Las historias del
    equipo también llevan su autorización (de quien la cuenta, confirmada por el equipo).
  - **Los contadores** («Historias publicadas») cuentan todas, también las que no tienen ubicación, y aparece «N sin ubicación en el mapa».
    «Sectores con historias» solo cuenta las que están en el mapa: si contara las otras, delataría el sector que se quiso ocultar.
- **Nombre del lugar (opcional).** Quien cuenta puede escribir cómo se llama el lugar («Finca La Esperanza», hasta 80 letras). Con lugar
  aproximado se muestra en la ficha pública y en las listas junto al sector («Finca La Esperanza, La Tagua»), y entra en la búsqueda. Sin
  ubicación pasa a ser el *nombre de referencia*, solo para el equipo. El administrador lo ve al revisar.
- **Nombre de la finca o marca (opcional).** Hasta 80 letras. Se muestra en la ficha pública y entra en la búsqueda, también en las
  historias sin ubicación (si dice dónde queda, es decisión de quien la escribe: el formulario lo avisa).

**Qué funciona sin señal** (después de haber abierto la página una vez con señal):

- La aplicación abre, también si se recarga la página. Se puede **instalar** como una aplicación en el teléfono.
- Se puede contar una historia completa: voz, texto, fotos y «Usar mi ubicación» (el GPS no necesita señal), con la autorización marcada. Los
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

- **Revisión (F6).** Para **aprobar** hay que marcar las **cuatro** comprobaciones (cultura cafetera, *relación con la zona cafetera de
  Minca y sus alrededores*, datos personales y *el narrador dio su consentimiento*): el servidor las exige, no solo el botón. El diálogo
  de revisión muestra además lo que el público no ve (el nombre real de una historia sin nombre, la referencia de una sin ubicación y la
  finca) y la autorización del narrador: el texto que aceptó, su versión y el día. Una historia **sin registro de autorización** (enviada antes
  de que existiera) no se puede publicar: se rechaza con el motivo «Falta la autorización». Para **rechazar** hace falta un motivo de la lista; el
  narrador lo lee en «Mis historias» y se guarda tal como se escribió (si la lista cambia después, no se reescribe
  la historia). Una historia se decide **una sola vez**: la decisión es una sola operación atómica sobre las que
  siguen «en revisión», así que dos administradores no pueden decidir la misma a la vez (el segundo recibe 409).
  Las historias del proyecto no pasan por revisión.
- **Historias del proyecto (F12).** Se publican de una vez y quedan marcadas «del proyecto». Los archivos los sube
  el propio administrador (las fotos y el audio por `POST /api/medios`; el video directo a Blob, ver «Video») y una
  historia solo puede apuntar a archivos que subió quien la crea.
  Tiene las mismas opciones que la de una familia (lugar aproximado o sin ubicación, publicar sin el nombre de quien la cuenta, finca) y una
  casilla «Tengo la autorización de quien cuenta la historia…» con el texto del equipo. Sin punto en el mapa (por la API), queda en el
  centro de su sector.
- **Configuración (F7).** Nombre del portal, «avisar al narrador si se rechaza» (se guarda, pero todavía no envía
  ningún aviso: está por definir con el profesor), la etiqueta «datos de ejemplo» del encabezado y las etiquetas
  (se normalizan como `#café-viejo`; máximo 40; quitar una no cambia las historias que ya la tienen). **Los
  sectores son de solo lectura.**
- **Reiniciar datos de ejemplo.** Solo con `ALLOW_DEMO_RESET` activo y con un administrador con sesión. Borra
  **todas** las historias, también las reales, y los archivos a los que apuntan, y carga las 14 historias de
  ejemplo (las 12 del diseño, `HIS-2026-001` a `012`, más la `013` publicada sin ubicación y la `014` publicada sin el nombre de su
  narrador y con finca; la siguiente historia real será la `015`). Llevan su registro de autorización, como si hubieran entrado por la app. Pide escribir la palabra
  `REINICIAR`. Si hay una narradora de ejemplo (`SEED_DEMO_NARRATOR_*`), se queda con dos de ellas, como Ana en el
  diseño. **Para quitar la función:** borra `lib/seed/demo.py`, `lib/admin/demo_router.py`, su línea en
  `api/index.py`, `src/components/admin/DemoResetDialog.jsx` y la tarjeta «Datos de ejemplo» de
  `SettingsPage.jsx`; o simplemente no definas `ALLOW_DEMO_RESET`.

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
