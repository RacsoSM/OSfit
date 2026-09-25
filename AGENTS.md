# Instrucciones para agentes — OSfit

Este archivo lo leen los agentes que trabajan en el repo (Codex y cualquier
otro que use `AGENTS.md`). Es la guía permanente del proyecto, no una
asignación de tarea: la tarea la da el entrenador en el chat.

## Regla de oro — contexto del proyecto vía graphify

Para investigar el contexto del proyecto (arquitectura, dónde está algo, qué
llama a qué, cómo funciona X, relaciones entre archivos), la **primera** opción
es el grafo de graphify, antes de `grep`, `find` o leer archivos a ciegas.

1. El grafo vive en `graphify-out/graph.json`. **No está versionado**, así que
   en un clon nuevo no existe: si falta, hay que generarlo o usar búsqueda
   tradicional.
2. Consulta el grafo primero y apóyate en ese resultado.
3. Sólo si el grafo no cubre lo que necesitas o está desactualizado, recurre a
   la búsqueda tradicional. En ese caso **dilo**, y sugiere regenerarlo.
4. Nunca empieces explorando archivos a ciegas.

## El proyecto

Gestión de clientes de gimnasio, de uso personal. Un solo entrenador. Son tres
módulos que comparten un mismo Firebase (proyecto `osfit-cccfe`):

| Módulo | Qué es | Quién lo usa |
| --- | --- | --- |
| `app/` | App Android nativa, Kotlin + Jetpack Compose | El entrenador |
| `web/` | Página por cliente, TypeScript + Vite, sin framework | Los clientes |
| `functions/` | Cloud Functions, TypeScript + Node 22 | Las llama la web |

Backend: Firebase Auth (usuario fijo para el entrenador, claim `clienteId` para
los clientes) + Firestore. La app también genera **resúmenes en video**
(semanal, quincenal, mensual) que el entrenador comparte por WhatsApp.

### Compilar y probar

```bash
./gradlew test                      # tests unitarios JVM (Android)
./gradlew assembleDebug             # compilar la app
./gradlew installDebug              # instalar en el teléfono por USB

cd web && npm test                  # vitest
cd web && npm run build             # tsc && vite build
cd web && npm run dev               # servidor de desarrollo

cd functions && npm test            # vitest
cd functions && npm run build       # tsc
```

Para `installDebug`, `adb devices` debe listar el teléfono como `device` (no
`unauthorized`).

**Antes de compilar la app por primera vez** hace falta configuración local que
no se versiona — ver `README.md`, sección "Configuración local":
`local.properties` (copiado de `local.properties.example`) y
`app/google-services.json` bajado de la consola de Firebase.

### Estructura

```
app/src/main/java/com/osfit/app/
  domain/            lógica de negocio pura, sin Android — acá van los tests
  data/model/        data classes que reflejan documentos de Firestore
  data/repository/   acceso a Firestore (CRUD + listeners en tiempo real vía Flow)
  data/AppContainer.kt   singleton donde se registran los repositorios
  paletas/           catálogo de paletas de color (video y web), como código
  ui/                pantallas Compose + ViewModels, una carpeta por sección
  video/             pipeline del video (escenas, timeline, renderer, encoder)
  util/              helpers de archivos (canciones, insignias, compartir)

web/src/
  main.ts            arranque, listeners de Firestore y repintado
  ventanas.ts        registro único de las ventanas de la página
  acciones.ts        el único lugar que llama a Cloud Functions
  datos.ts           tipos de los documentos + listeners
  ui/                una función por tarjeta/sección, devuelve HTML como string

functions/src/
  index.ts           exporta las funciones
  <función>.ts       una por función, con su <función>.test.ts al lado
```

## Convenciones del repo — respétalas

- **Idioma:** el código, los nombres y los comentarios están **en español**.
  Los mensajes de commit, **en inglés**. No mezcles.
- **Comentarios que explican el porqué, no el qué.** Este repo comenta
  decisiones no obvias (por qué 10.5 segundos y no 8, por qué dos banderas
  separadas en `Asistencia`, por qué la ventana activa no va en el HTML del
  menú). No agregues comentarios que repitan lo que el código ya dice, y
  cuando tomes una decisión no obvia, déjala escrita.
- **Nombres de test:** en español, describiendo el comportamiento.
  Kotlin en backticks:
  `` fun `el resumen semanal no incluye la escena de racha`() ``.

### Android

- **Repositorios:** clases planas, no interfaces (la única interfaz es
  `ClienteRepository`, por razones históricas). Subcolecciones bajo
  `clientes/{id}/...`.
- **ViewModels:** reciben sus repositorios como parámetro del constructor, con
  `AppContainer.xxx` como valor por defecto.
- **Firestore:** los `data class` necesitan constructor sin argumentos, o sea
  **valor por defecto en todos los campos**. El `id` no se guarda dentro del
  documento (se escribe con `.copy(id = "")` y se rellena al leer de `doc.id`).
- **Tests:** JUnit4, sólo para `domain/`, `paletas/` y `video/`. Los
  repositorios Firestore, las pantallas Compose y el render Canvas **no** se
  testean unitariamente — no hay precedente y requerirían instrumentación. Se
  verifican en dispositivo.

### Web

- **La página nunca escribe en Firestore.** Las reglas la dejan en solo
  lectura a propósito: toda escritura del cliente pasa por una Cloud Function,
  y `acciones.ts` es el **único** archivo que llama a `httpsCallable`.
- **`ventanas.ts` es el registro único** de qué ventanas existen. El menú
  lateral se arma de esa lista; no hay una lista de opciones paralela que se
  pueda desincronizar.
- **Las funciones de `ui/` devuelven HTML como string** y son puras: reciben
  datos, devuelven markup. Eso es lo que las hace testeables en Node sin DOM.
  Escapa todo texto que venga de Firestore (`escapar` en `ui/tarjetaDia.ts`).
- **Campos opcionales:** Firestore omite los campos que nunca se escribieron,
  así que los datos viejos llegan sin ellos. Cualquier campo agregado después
  del primer despliegue va opcional, con el comentario que diga por qué.
- **Tests:** vitest, el archivo `<módulo>.test.ts` al lado del módulo.

### Firestore

`firestore.rules` es un límite de seguridad, no configuración: léelo completo
antes de cambiarlo, y explica en un comentario por qué cada regla es como es.
`esCliente(cid)` se apoya en el claim `clienteId` que pone la función `sesion`
al canjear el token del link.

## Flujo de trabajo

El repo trabaja con specs y planes escritos, en `docs/superpowers/`:

- `specs/AAAA-MM-DD-<tema>-design.md` — el **qué** y el **porqué**
- `plans/AAAA-MM-DD-<tema>.md` — el **cómo**, tarea por tarea

Cuando te toque ejecutar un plan:

- **Lee el spec completo antes de tocar código.** El plan asume que ya lo
  leíste: dice *qué* escribir, el spec dice *por qué* está diseñado así, y
  varias decisiones parecen arbitrarias hasta que ves el motivo.
- Las tareas van **en orden**, y cada una depende de las anteriores. **Una a la
  vez**: termina una por completo, incluido su commit, antes de seguir.
- Respeta el ciclo: escribir el test que falla → **correrlo y ver que falla** →
  implementar lo mínimo → correrlo y ver que pasa → commit. Cuando el paso diga
  "Expected: FAIL", corre el comando y confírmalo. Un test que pasa antes de
  existir la implementación no está probando nada.
- Marca cada `- [ ]` como `- [x]` conforme avanzas y guarda el archivo. Así se
  ve dónde te quedaste si la sesión se corta.

**Si algo no cuadra** — una contradicción entre el spec y el código real, o un
paso que no compila como está escrito — **para y dilo**. No improvises una
solución distinta en silencio: es más barato corregir el plan que descubrir
después que la implementación se fue por otro lado.

## Commits

Uno por tarea, en inglés, con prefijo `feat:` / `fix:` / `refactor:` /
`docs:` / `chore:`, y terminando con una línea `Co-Authored-By:` con tu propia
atribución.

No hagas `push` a menos que el entrenador lo pida.
