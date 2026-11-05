# Poner AGROCULTURA en internet y usarla de verdad

Cómo preparar la base de datos, desplegar en Vercel, qué cambiar antes de recibir historias reales, cuánto cuesta y qué comprobar.
Para lo que hace la plataforma, mira el [README](../README.md).

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
| `OperationFailure` | 8000 | Atlas rechazó la autenticación (es su forma de decir lo mismo que el 18) | Lo mismo que el 18: usuario y contraseña de `MONGODB_URI` |
| `OperationFailure` | 13 | El usuario no tiene permiso | En Atlas → Database Access, el usuario debe tener `readWrite` sobre la base `agrocultura` (escrita igual que `MONGODB_DB`) |
| `ServerSelectionTimeoutError` | — | No se llega al cluster | Network Access con `0.0.0.0/0`; que el cluster no esté pausado |
| `ConfigurationError` o `InvalidURI` | — | La cadena de conexión está mal formada | Volver a copiarla desde Atlas (Connect → Drivers) |
| *(503 con "Falta la variable MONGODB_URI")* | — | La función no ve la variable | Que exista en el entorno **Production** y que se hiciera un Redeploy después de crearla |

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
   | `JWT_SECRET` | Una cadena aleatoria de 32 caracteres o más (la receta está en [Variables de entorno](desarrollo.md#variables-de-entorno)) |
   | `ADMIN_USER` | El usuario del administrador inicial |
   | `ADMIN_PASSWORD` | Su contraseña (10 caracteres o más). Para cambiarla después: se cambia aquí y se vuelve a desplegar |
   | `BLOB_READ_WRITE_TOKEN` | Ya la creó el paso 3 |
   | `AZURE_SPEECH_KEY` y `AZURE_SPEECH_REGION` | Opcionales: la clave y la región de un recurso **Speech** de Azure (plan gratuito **F0**). Con ellas, la portada, las primeras fincas y las fichas publicadas se leen con la voz del portal; sin ellas, con la voz de cada dispositivo. `AZURE_SPEECH_VOICE` elige la voz (por defecto `es-CO-SalomeNeural`) y `VOZ_MAX_CARACTERES_DIA` limita el gasto diario (15000) |
| `ALLOW_DEMO_RESET` | `true` solo mientras se prueba con datos de ejemplo (ver la lista siguiente) |
   | `SEED_DEMO_NARRATOR_PHONE` y `SEED_DEMO_NARRATOR_PIN` | Opcionales: una narradora de ejemplo para las demostraciones (entra con ese celular como usuario y ese PIN como contraseña) |

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
- [ ] **Quitar «datos de ejemplo»** del encabezado: *Configuración → Portal → «Mostrar “datos de ejemplo”»* en apagado.
- [ ] **Sin historias de ejemplo.** Si en algún momento se pulsó «Reiniciar datos de ejemplo», hay 14 historias de ejemplo (`HIS-2026-001` a
  `014`, marcadas `ejemplo: true`) mezcladas con las reales en el mapa. Se quitan en Atlas: *Browse Collections → `agrocultura` → `historias`*,
  filtro `{ "ejemplo": true }`, seleccionarlas y borrarlas (no tocan ninguna historia real). **El botón de reinicio no sirve para esto**: borra
  todo y *vuelve a cargar* los ejemplos. Los códigos siguen desde la `015`.
- [ ] **Sin narradora de ejemplo.** Quita `SEED_DEMO_NARRATOR_*` de Vercel; la cuenta que ya se creó se borra en Atlas (colección `usuarios`, el
  documento de «Ana Beltrán» o el nombre que le hayas puesto).
- [ ] **Cambiar la contraseña del administrador** por una que no se haya compartido (variable `ADMIN_PASSWORD` y *Redeploy*).
- [ ] **Poner el nombre definitivo del portal** (*Configuración → Portal*). Hoy dice «AGROCULTURA».
- [ ] **Revisar con el profesor los textos de la autorización** (`lib/stories/consentimiento.json`: cuatro para las familias y cuatro para el
  equipo). Es lo que cada persona acepta al enviar su historia. Si se cambia una palabra, se cambia también la `version` del archivo. Las
  historias en revisión que se enviaron **antes** de que existiera la autorización no se pueden publicar (se rechazan con el motivo «Falta la
  autorización» o se reinician los ejemplos); los borradores guardados en un teléfono antes del cambio hay que volver a enviarlos.
- [ ] **Decidir si se avisa al narrador cuando se rechaza su historia.** La opción existe pero todavía **no envía nada** (no hay correo,
  SMS ni WhatsApp conectado); hoy el narrador lo ve en «Mis historias».
- [ ] **Confirmar con las familias la posición de los sectores.** Minca, La Tagua y San Lorenzo ya tienen un punto (el de San Lorenzo es
  «Cuchillas San Lorenzo», una cresta); **Tijereras sigue sin punto confirmado**, por eso no sale su nombre en el mapa ni su botón.
  Cuando se tenga, se cambia en `lib/seed/catalog.py` y se sube `SECTORES_VERSION`.
- [ ] **Una prueba con dos o tres familias** en sus teléfonos y con su señal (ver [Accesibilidad](funcionamiento.md#accesibilidad)).
- [ ] **Mirar el mapa en producción con señal** una vez: el fondo de OpenStreetMap no se pudo probar desde el entorno donde se construyó.

## Costos y límites

Todo funciona con planes gratuitos, sin tarjeta, mientras el proyecto sea pequeño:

| Servicio | Plan | Lo que conviene saber |
|---|---|---|
| Vercel | Hobby (gratis) | Pensado para proyectos personales o académicos; si la plataforma pasa a un uso comercial hay que cambiar de plan. Las funciones tienen límite de tiempo y de tamaño por petición (de ahí la subida directa del video) |
| MongoDB Atlas | M0 (gratis) | 512 MB. Se pausa por inactividad en algunos planes: si `/api/salud` falla de repente, mira si el cluster está pausado |
| Vercel Blob | Hobby | Cupo gratuito de almacenamiento y transferencia; las fotos se reducen a menos de 1 MB y el audio es muy liviano, pero los videos (hasta 25 MB cada uno) llenan el cupo mucho más rápido: conviene vigilarlo en el panel de Vercel |
| OpenStreetMap | Servicio comunitario | Sus [normas](https://operations.osmfoundation.org/policies/tiles/) valen para poco tráfico; si crece hay que usar un proveedor de mapas propio (se cambia en una sola constante, `src/config/map.js`) |
