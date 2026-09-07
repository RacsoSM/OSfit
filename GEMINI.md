# Instrucciones para Gemini — OSfit

## Tu tarea ahora

Implementar la feature **logros personales por cliente**, siguiendo estos dos
documentos:

1. **Spec (el qué y el porqué):**
   `docs/superpowers/specs/2026-09-07-logros-personales-design.md`
2. **Plan (el cómo, tarea por tarea):**
   `docs/superpowers/plans/2026-09-07-logros-personales.md`

**Lee el spec completo antes de tocar código.** El plan asume que ya lo
leíste: explica *qué* escribir, pero el spec explica *por qué* está diseñado
así, y varias decisiones parecen arbitrarias hasta que ves el motivo.

### Cómo ejecutar el plan

- Las tareas van **en orden, de la 1 a la 11**. Cada una depende de las
  anteriores.
- **Una tarea a la vez.** Termina una por completo (incluido su commit) antes
  de empezar la siguiente.
- Dentro de cada tarea, respeta el ciclo: escribir el test que falla → correrlo
  y ver que falla → implementar lo mínimo → correrlo y ver que pasa → commit.
  Cuando el paso dice "Expected: FAIL", **corre el comando y confirma que
  efectivamente falla** antes de implementar. Un test que pasa antes de existir
  la implementación es un test que no está probando nada.
- Los bloques de código del plan son literales: cópialos tal cual. Cuando el
  plan dice "copiar la estructura de `<archivo>` y adaptarla", abre ese archivo
  y síguelo — la lista de diferencias que trae el plan es exhaustiva.
- Marca cada `- [ ]` como `- [x]` conforme avanzas, y guarda el archivo del
  plan. Así queda claro dónde te quedaste si la sesión se corta.

### Si algo no cuadra

Si encuentras una contradicción entre el spec y el código real, o un paso que
no compila como está escrito: **para y dilo**, no improvises una solución
distinta en silencio. Es más barato corregir el plan que descubrir después que
la implementación se fue por otro lado.

---

## El proyecto

App Android nativa (Kotlin + Jetpack Compose) de uso personal para gestionar
clientes de gimnasio: clientes con estado de pago, calendario de asistencias
con avance automático de rutina, plantillas de rutina, control de pagos, y
**resúmenes en video** (semanal, quincenal, mensual) que el entrenador
comparte por WhatsApp con cada cliente.

Backend: Firebase (Auth silenciosa con usuario fijo + Firestore). Un solo
usuario real: el entrenador.

### Compilar y probar

```bash
./gradlew test           # tests unitarios JVM
./gradlew assembleDebug  # compilar
./gradlew installDebug   # instalar en el teléfono conectado por USB
```

Para `installDebug`, `adb devices` debe listar el teléfono como `device` (no
`unauthorized`).

**Antes de compilar por primera vez** hace falta configuración local que no
está versionada — ver `README.md`, sección "Configuración local":
`local.properties` (copiado de `local.properties.example`) y
`app/google-services.json` bajado de la consola de Firebase.

### Estructura

```
app/src/main/java/com/osfit/app/
  domain/       lógica de negocio pura, sin dependencias de Android — acá van los tests
  data/model/   data classes que reflejan documentos de Firestore
  data/repository/  acceso a Firestore (CRUD + listeners en tiempo real vía Flow)
  data/AppContainer.kt  singleton donde se registran los repositorios
  ui/           pantallas Compose + ViewModels, una carpeta por sección
  video/        pipeline de generación del video (escenas, timeline, renderer, encoder)
  util/         helpers de archivos (canciones, imágenes de insignias, compartir)
```

## Convenciones del repo — respétalas

- **Idioma:** el código, los nombres y los comentarios están **en español**.
  Los mensajes de commit, **en inglés**. No mezcles.
- **Comentarios que explican el porqué, no el qué.** Este repo comenta
  decisiones no obvias (por qué 10.5 segundos y no 8, por qué el timestamp en
  el nombre del archivo, por qué se denormaliza un campo). No agregues
  comentarios que repitan lo que el código ya dice.
- **Repositorios:** clases planas, no interfaces (la única interfaz es
  `ClienteRepository`, por razones históricas). Subcolecciones bajo
  `clientes/{id}/...`.
- **ViewModels:** reciben sus repositorios como parámetro del constructor con
  `AppContainer.xxx` como valor por defecto.
- **Firestore:** los `data class` necesitan constructor sin argumentos, o sea
  **valor por defecto en todos los campos**. El `id` no se guarda dentro del
  documento (se escribe con `.copy(id = "")` y se rellena al leer desde
  `doc.id`).
- **Tests:** JUnit4, sólo para `domain/` y `video/` (timeline y armado de
  escenas). Los repositorios Firestore, las pantallas Compose y el render
  Canvas **no** se testean unitariamente — no hay precedente en el repo y
  requerirían instrumentación. Se verifican en dispositivo.
- **Nombres de test:** en backticks y en español, describiendo el
  comportamiento:
  `` fun `el resumen semanal no incluye la escena de racha`() ``.

## Commits

Uno por tarea del plan, en inglés, con prefijo `feat:` / `fix:` / `refactor:`
/ `docs:`, y terminando con:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

(Ajusta esa línea a tu propia atribución si prefieres; lo importante es que los
commits queden atribuidos.)

No hagas `push` a menos que el entrenador lo pida.

## Contexto que te va a servir

La feature nueva es deliberadamente un **espejo del sistema de medallas** que
ya existe. Antes de empezar, vale la pena leer:

- `docs/superpowers/specs/2026-09-04-medallas-logros-design.md` — el diseño de
  las medallas, que es el modelo a copiar.
- `app/src/main/java/com/osfit/app/data/repository/MedallaRepository.kt`
- `app/src/main/java/com/osfit/app/ui/medallas/MedallasScreen.kt`
- `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt` y
  `TimelineResumen.kt`

Cuando el plan diga "igual que medallas", esos archivos son la referencia
literal.
