# Guía para quien desarrolla

Cómo instalar, correr, probar y entender el código de AGROCULTURA en tu computador. Para saber **qué hace** la plataforma, mira el
[README](../README.md) y [`funcionamiento.md`](funcionamiento.md); para ponerla en internet, [`despliegue.md`](despliegue.md).

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
- Una base de datos en MongoDB Atlas (ver [MongoDB Atlas](despliegue.md#mongodb-atlas))

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

Están descritas en [`.env.example`](../.env.example). Las principales:

| Variable | Para qué sirve |
|---|---|
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas |
| `MONGODB_DB` | Nombre de la base (por defecto `agrocultura`) |
| `JWT_SECRET` | Firma de las sesiones (la API de Python la firma y la función de video `api/blob-token.js` la verifica con el mismo secreto). Cadena aleatoria de **32 caracteres o más**; sin ella el ingreso y la subida de videos responden 503 |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Administrador inicial. La contraseña tiene **10 caracteres o más** |
| `SEED_DEMO_NARRATOR_*` | Narradora de ejemplo (opcional) |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob, donde se guardan las fotos, los audios y los videos. Aparece solo al conectar un *Blob store* al proyecto (Storage → Create → Blob, con acceso **Public**) |
| `ALLOW_DEMO_RESET` | Muestra y permite el botón «Reiniciar datos de ejemplo» (**borra todas las historias**). Sin esta variable (o con `false`) el botón no existe. Se quita antes de usar la plataforma con familias reales |
| `VITE_SHOW_CODES` | Opcional. Con `true` se ven los códigos F1, F2… del diseño (notas para el equipo al comparar pantallas). **Sin ella no se ve ninguno**, en ninguna pantalla. Se lee al compilar: en Vercel, un cambio pide volver a desplegar |

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

## Estructura

```
docs/diseno/    diseños de referencia aprobados (no se despliegan)
docs/plan-v1.md plan y decisiones acordadas
docs/funcionamiento.md  cómo funciona cada parte, con sus reglas
docs/despliegue.md      Atlas, Vercel, uso real y costos
docs/desarrollo.md      esta guía
docs/capturas/  imágenes del README
docs/comparacion/  capturas de cada etapa frente al diseño aprobado
src/            frontend React + Vite (components, pages, hooks, services, offline)
public/         recursos estáticos de la PWA
api/            punto de entrada del backend (api/index.py) y la función de Node del video (api/blob-token.js)
lib/            código compartido del backend, un paquete por tema
tests/          pruebas del backend
e2e/            recorrido de punta a punta y accesibilidad en un navegador real (npm run e2e)
```
