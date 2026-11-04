# AGROCULTURA

Plataforma digital de memoria histórica y patrimonio cultural de la cultura cafetera de **Minca y
sectores cercanos** (La Tagua, San Lorenzo, Tijereras). Las familias cuentan sus historias con foto
y audio, un administrador las revisa y las aprobadas se ven sobre un mapa.

Proyecto del curso Diseño y Prototipado (Ingeniería de Sistemas, Universidad del Magdalena).
Equipo Protopía: Jeison, Victor y Marleidys. Referencia: [La Piragua](https://lapiragua.com.co).

> Esta es la **versión 1**. El stack se confirmará con las entrevistas; por eso las capas están
> desacopladas (frontend, API y acceso a datos). El plan y las decisiones acordadas están en
> [`docs/plan-v1.md`](docs/plan-v1.md) y los diseños aprobados en [`docs/diseno/`](docs/diseno/).

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
| `JWT_SECRET` | Firma de las sesiones. Cadena aleatoria de **32 caracteres o más**; sin ella el ingreso responde 503 |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Administrador inicial. La contraseña tiene **10 caracteres o más** |
| `SEED_DEMO_NARRATOR_*` | Narradora de ejemplo (opcional) |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob, donde se guardan las fotos y los audios. Aparece solo al conectar un *Blob store* al proyecto (Storage → Create → Blob, con acceso **Public**) |
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
solo habla con un origen, igual que en producción.

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
  `src/offline/connectivity.test.js`).

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
  lugar, época, etiquetas) y *Revisar y enviar*. Lo que escribe o graba vive en la página hasta que la envía.
- **Antes de subir**, el teléfono reduce cada foto (máximo 1280 px por lado y menos de 1 MB, y de paso borra
  los datos ocultos de la cámara, como la posición GPS) y graba el audio en mono a baja calidad
  (unos 180 KB por minuto). Así se sube rápido con poca señal.
- Las fotos y el audio pasan por `POST /api/medios` (máximo **3,5 MB** cada uno: una función de Vercel
  acepta unos 4,5 MB por petición). El servidor **decide el tipo de archivo por su contenido**, no por el
  nombre ni por lo que diga el navegador, y lo guarda en Vercel Blob. El video (bloque 7) se subirá directo
  desde el navegador a Blob, sin pasar por la API.
- La historia se envía con `POST /api/historias`. **Siempre** queda «en revisión» (aunque alguien intente
  mandar otro estado) y no aparece en el mapa hasta que un administrador la aprueba. El servidor decide el
  autor y el código (`HIS-AAAA-NNN`, consecutivo).
- Cada borrador lleva un identificador propio (`client_id`). Si el envío se repite (se cortó la señal justo
  al responder), el servidor reconoce la historia y no la duplica; y las fotos que ya subieron no se suben otra vez.
- Si no hay `BLOB_READ_WRITE_TOKEN`, subir un archivo responde 503 con el mensaje «Falta configurar…».
- El lugar se elige tocando un sector, tocando el mapa o con el botón «Usar mi ubicación» (el GPS del
  teléfono funciona sin señal). Se guarda como un punto GeoJSON `[longitud, latitud]` con un índice `2dsphere`.

## Mapa y ficha de la historia

- **Qué se ve en el mapa.** `GET /api/historias` es público y devuelve **solo** las historias publicadas (más
  nuevas primero, hasta 1000), con lo que necesita el mapa: código, título, quién la cuenta, sector, época,
  formatos, origen, el punto y la primera foto. **Nunca** lleva el texto, el autor, el identificador del borrador
  ni nada de la revisión. `GET /api/historias/{codigo}` es la ficha: también pública y también solo de historias
  publicadas (una en revisión, rechazada o inexistente responde 404).
- **La zona visible.** El mapa carga todas las publicadas de una vez, las agrupa cuando están cerca y la lista
  de al lado muestra solo las que están en la zona que se ve (se actualiza al mover o acercar el mapa). Así
  también funciona sin conexión en el bloque 6, sin pedir datos al servidor cada vez que se mueve el mapa.
  El índice `2dsphere` de `ubicacion` queda listo por si algún día hace falta consultar por zona en el servidor.
- **Fondo del mapa.** OpenStreetMap, en una sola constante (`src/config/map.js`) para cambiarlo después por un
  mapa de relieve sin tocar componentes. El servicio gratuito de OpenStreetMap tiene
  [normas de uso](https://operations.osmfoundation.org/policies/tiles/) para poco tráfico; si el proyecto crece
  habrá que pasar a un proveedor propio.
- **Dónde están los sectores.** Cada sector tiene un punto central (en `lib/seed/catalog.py`) que usan las
  historias que se ubican «en el sector». **Hoy solo el de Minca está comprobado**; los otros tres son
  provisionales. Para corregirlos: cambia las coordenadas y **sube `SECTORES_VERSION`**. En el siguiente arranque
  la aplicación mueve los sectores guardados y también las historias ubicadas «en el sector» (con la misma
  distancia); las historias con punto propio (GPS o un toque en el mapa) no se mueven.
- **Nombres de los sectores en el mapa.** Se ven solo con el mapa alejado (hasta el nivel 12) y desaparecen al
  acercar, como las etiquetas de un mapa; `SECTOR_LABELS_MAX_ZOOM` en `src/config/map.js`.
- **Pines.** Rojo: comunidad. Verde azulado: proyecto. Un pin marcado se ve oscuro, más grande y con su título.
  Los títulos y los nombres de sector se muestran siempre como texto, nunca como HTML.
- **Ficha (F8).** Fotos (varias, con miniaturas), video, audio y los datos de la historia. «Ver en el mapa» la
  marca en el mapa (`/?historia=HIS-2026-001`: ese enlace también se puede compartir). Las historias de ejemplo
  no tienen archivos: la ficha muestra los marcadores de posición del diseño y dice que no hay audio.

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
  el propio administrador (`POST /api/medios`) y una historia solo puede apuntar a archivos que subió quien la crea.
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

## Estructura

```
docs/diseno/    diseños de referencia aprobados (no se despliegan)
docs/plan-v1.md plan y decisiones acordadas
src/            frontend React + Vite (components, pages, hooks, services)
public/         recursos estáticos de la PWA
api/            punto de entrada del backend (api/index.py)
lib/            código compartido del backend, un paquete por tema
tests/          pruebas del backend
```

## Estado

La versión 1 se construye por bloques (ver `docs/plan-v1.md`).

- [x] Bloque 0: andamiaje, pruebas y CI
- [x] Bloque 1: base visual, encabezado, menú, conexión simulada, voz, `/api/config` y `/api/estadisticas`
- [x] Bloque 2: registro e ingreso (F2)
- [x] Bloque 3: contar una historia con voz, texto y fotos; «Mis historias» (F3, F4, F5)
- [x] Bloque 4: revisión, historias del proyecto, configuración y reinicio de ejemplo (F6, F7, F12)
- [x] Bloque 5: mapa de historias y ficha (F1, F8)
- [ ] Bloques 6 a 8: sin conexión, filtros, video y cierre

En `docs/comparacion/` hay capturas de cada bloque frente al diseño aprobado. Los pasos para
desplegar en Vercel se documentan al cerrar el bloque 8.
