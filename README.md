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

- Node.js 20 o superior
- Python 3.12 o superior
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
| `JWT_SECRET` | Firma de las sesiones. Cadena larga y aleatoria |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Administrador inicial que crea el seed |
| `SEED_DEMO_NARRATOR_*` | Narradora de ejemplo (opcional) |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob |
| `ALLOW_DEMO_RESET` | Permite el botón "Reiniciar datos de ejemplo" |
| `VITE_SHOW_CODES` | Muestra los códigos F1, F2… del diseño |

Para generar un `JWT_SECRET`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
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

## Cargar los datos iniciales (seed)

Con `MONGODB_URI` definido en tu `.env` y el entorno virtual activado:

```bash
python -m scripts.seed
```

Carga los sectores, las etiquetas y la configuración del portal. **Solo llena colecciones vacías**:
si la base ya tiene datos, no los sobrescribe. (Los centros de los sectores son provisionales hasta
confirmarlos con las familias de la zona.)

## API

La documentación interactiva está en `/api/docs` cuando la API corre. Rutas disponibles por ahora:

| Ruta | Qué devuelve |
|---|---|
| `GET /api/salud` | Estado de la API y de la conexión a MongoDB |
| `GET /api/config` | Nombre del portal, sectores, etiquetas, épocas y motivos de rechazo |
| `GET /api/estadisticas` | Contadores: historias publicadas, en revisión, formatos |

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
- [ ] Bloque 2: registro e ingreso (F2)
- [ ] Bloques 3 a 8: contar historias, moderación, mapa, sin conexión, filtros, video y cierre

En `docs/comparacion/` hay capturas de cada bloque frente al diseño aprobado. Los pasos para
desplegar en Vercel se documentan al cerrar el bloque 8.
