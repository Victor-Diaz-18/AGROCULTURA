# Plan de la versión 1

Documento de trabajo del equipo Protopía. Resume lo acordado para construir AGROCULTURA v1
a partir de los diseños aprobados en `docs/diseno/`. Si algo cambia, se actualiza aquí.

## Reglas de trabajo

- Código y comentarios en inglés; textos de la interfaz y documentación en español.
- Commits pequeños y claros en la rama de la sesión `claude/sweet-franklin-4wiubv`.
  Al cerrar cada bloque se entrega un resumen; cuando el equipo lo aprueba, se pasa a `main`.
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
| 7 | F11, F12, F13: búsqueda, filtros, distintivos, video | — |
| 8 | Cierre: accesibilidad, README completo, despliegue verificado, recorrido e2e opcional | e2e opcional |

Al cerrar cada bloque se compara el resultado con el diseño de referencia (qué se parece, qué cambió).

## Estado de avance

| Bloque | Estado |
|---|---|
| 0 Andamiaje | Hecho. Pruebas: 9 de backend |
| 1 Base | Hecho. Pruebas: 18 de backend (+2 que solo corren con Mongo real) y 36 de frontend. Comparación en `docs/comparacion/bloque-1/` |
| 2 a 8 | Pendientes |

## Notas de construcción

- Pequeñas adiciones al diseño, anotadas para que el equipo las conozca:
  - El botón «Escuchar» está en todas las páginas del portal (la tarjeta «Voz e íconos» del diseño dice
    que cada página lo tiene; el prototipo solo lo cableaba en algunas).
  - Al perder o recuperar la señal (real o simulada) sale un aviso, como en el diseño.
  - Si el dispositivo no puede leer en voz alta, se avisa en lugar de no hacer nada.
  - El texto «datos de ejemplo» del encabezado se controla con la opción `datos_de_ejemplo` de la
    configuración (el seed la activa; se apaga antes de usar la plataforma con familias reales).
- Convención de CSS: todo en `border-box`, salvo donde el diseño depende del `content-box` por defecto
  (por ejemplo la tarjeta «Depende de»). Al reproducir cada pantalla hay que revisar ese detalle.
- Los centros de La Tagua, San Lorenzo y Tijereras conservan la disposición relativa del mapa ilustrado
  del diseño; no son geografía real y hay que confirmarlos con las familias.
- Starlette recomienda `httpx2` para su `TestClient`; se mantiene `httpx` como se acordó y se silencia
  solo ese aviso en `pytest.ini`. Migrar es cambiar una línea de `requirements-dev.txt`.
