# Prompt de contexto: video de resumen con estilos y Mancu

> Pegar este documento al inicio de una sesión nueva (o decir "lee
> `docs/superpowers/notes/2026-10-02-contexto-sesion-mancu.md`"). Resume todo lo decidido y construido
> hasta el 2026-10-02 para continuar sin re-explorar.

## Quién y cómo

- El usuario es el **entrenador** de un gimnasio y único usuario de la app OSfit (Android, Kotlin +
  Compose). Habla **español**; responde y comenta código en español como el resto del repo.
- **Regla de oro del repo** (`CLAUDE.md` / `AGENTS.md`): para entender el proyecto, consultar primero
  el grafo de graphify (`graphify-out/graph.json`, `GRAPH_REPORT.md`; no está versionado). No hay CLI
  ni skill de graphify instalados: se lee `GRAPH_REPORT.md` o se busca en `graph.json` con `node`.
  Si no basta, decirlo y sugerir `/graphify . --update` (el grafo no incluye aún las piezas Mancu).
- **Commit/push solo cuando lo pide.** El usuario ya autorizó y pidió commit + push a `main` el
  2026-10-02. Los commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (los
  de Codex con `Co-Authored-By: Codex <noreply@openai.com>`).
- El usuario **prueba en su celular** (un 24069PC21G, serie `aacd1448`, por USB). Lo visual solo se
  juzga ahí; desde aquí no se puede ver el video. Pidió **delegar la implementación a workers de
  Codex vía Orca** para gastar menos tokens, con el coordinador verificando cada resultado.
- Ya probó Mancu: **el tiempo de generación es corto** (no se llegó a registrar el número exacto; la
  tabla de `docs/superpowers/notes/2026-10-02-tiempos-generacion-video.md` sigue "pendiente").

## Qué existe ya (todo en `main`)

El video de resumen del cliente (1080×1920, 30 fps, MediaCodec, canvas de software) ahora admite
**estilos elegibles por quincena**:

| Estilo | id | Descripción |
|---|---|---|
| Blobs | `blobs` | El original: fondo negro con blobs difusos, usa la `Paleta` del periodo. **Por defecto.** |
| Mancu | `mancu` | Papel crema, sol amarillo, mascota disco de 20 kg. Colores fijos (ignora la paleta). |

- Se elige en **Configuración de video** (por quincena). Persistencia: `configVideo/{rangoInicio}` en
  Firestore con `{ paletaId, estiloId }`, escritos con `SetOptions.merge()` (no se pisan). Docs viejos
  sin `estiloId` se leen como `blobs`; ids desconocidos también.
- **Solo el resumen quincenal admite estilo** (`EstilosVideo.paraResumen`); semanal y mensual siempre
  usan Blobs (el `rangoInicio` de un mensual coincide con el de la 1ª quincena).
- El contenido no cambia entre estilos: mismas escenas, orden, datos, textos (vienen de
  `TextosEscena`) y duraciones (`TimelineResumen`, intocable).

### Mapa de archivos (`app/src/main/java/com/osfit/app/video/`)

- **Comunes:** `EscenaResumen` (modelo), `TimelineResumen` (duraciones + ventana de transición de
  600 ms), `ResumenVideoGenerator` (lee `configDe`, elige estilo, loguea tiempos), `ResumenVideoEncoder`,
  `TextosEscena` (redacción compartida), `MaquinaEscribir`, `EstiloVideo` (`EstilosVideo`),
  `RendererVideo` (interfaz), `FabricaRendererVideo`.
- **Blobs (no tocar):** `RendererBlobs` → `ResumenFrameRenderer` (object, ~1000 líneas), `FondoBlobRenderer`,
  `BlobsGeometria`. Unos helpers de `ResumenFrameRenderer` se pasaron de `private` a `internal` para
  que Mancu los reutilice (curvas de la medalla, posiciones de logros); sin cambio de comportamiento.
- **Mancu:** `RendererMancu` (clase; arma fondo + escena + nube), `FondoPapelRenderer`, `MancuDibujo`
  + `PoseMancu` (el personaje), `MancuAnimacion` (funciones puras: rebote, parpadeo, saltoEntrada,
  squash, progresoNube…), `GeometriaMancu`, `TextoMancu` (kit de texto con contorno + sombra dura),
  `PaletaMancu`, `TipografiasMancu`, `ContextoEscenaMancu`, `NubeTransicionMancu`, y una clase por
  escena: `EscenaMancuSaludo/Asistencia/Tiempo/DiaFavorito/Racha/Medalla/Logros/Despedida`, con
  `InsigniaMancu`, `ComposicionPremiosMancu`, `CascadaLogrosMancu` de apoyo.
- Fuentes en `app/src/main/res/font/` (`lilita_one.ttf`, `patrick_hand.ttf`); licencias OFL en
  `docs/licencias/`.
- UI: `ui/configvideo/ConfigVideoScreen.kt` y `ConfigVideoViewModel.kt`; repo
  `data/repository/ConfigVideoRepository.kt` (`ConfigVideoGuardada`, `ConfigVideoResuelta`).

### Diseño de Mancu (decidido con el usuario)

Disco olímpico de 20 kg **gris, visto de frente, sin nariz ni agujero central**, con ojos, mejillas,
boca, brazos y piernas de manguera (guantes blancos, zapatos rojos) y "20 KG" grabado en arco abajo.
Poses: `Brazos{HOLA,ORGULLO,ESFUERZO}`, `Ojos{NORMAL,FELIZ,FUERZA,LADO}`, `Boca{SONRISA,ABIERTA,DIENTES,O}`,
flags `salto`, `sudor`, `confeti`. Proporciones y colores de referencia: prototipo HTML
`docs/superpowers/specs/assets/mancu-prototipo.html` (el dibujo Canvas lo porta literalmente).
Estética: dibujo a mano, contorno de tinta gruesa, colores planos. Paleta fija: papel `#F3E7C9`, sol
`#F7D774`, rojo `#D9412B`, tinta `#1B1512`, marrón `#5A4A40`; tipografías Lilita One (títulos) y
Patrick Hand (notas). Entre escenas: **nube de caricatura** (no crossfade).

## Documentos de referencia (leer si hace falta detalle)

- Spec: `docs/superpowers/specs/2026-10-01-video-resumen-mancu-design.md`
- Plan ejecutado: `docs/superpowers/plans/2026-10-02-video-estilos-mancu.md`
- Tiempos: `docs/superpowers/notes/2026-10-02-tiempos-generacion-video.md`
- Specs antiguas del video: `...-resumen-cliente-video-*`, `2026-09-09-configuracion-video-por-periodo-design.md`
  (habla de `PaletaVideo`; el código ya usa `Paleta`: fiarse del código).

## Estado de verificación

351 tests unitarios (JUnit, sin Robolectric) en verde; `assembleDebug` e `installDebug` correctos. Los
tests solo cubren lógica pura; **nada de lo que se dibuja se ha visto fuera del celular del usuario**.

## Siguiente trabajo pedido por el usuario

> "Mejorar las animaciones de Mancu: que no sea estático en las ventanas, que se esté moviendo, como
> cambiando entre las ventanas, jugando con los efectos y las letras."

Hoy Mancu hace entrada con salto, rebote suave, parpadeo y poses fijas por escena; los textos son
máquina de escribir; la nube es la única transición. Ideas a diseñar (preguntar al usuario cuáles
quiere antes de construir): Mancu que **viaja entre escenas** (sale arrastrando/empujando la nube,
entra desde el lado contrario), **cambio de pose a mitad de escena** (ej. mira el número, lo señala,
celebra), reacciones a los datos (puesto 1 → salta; sin asistencia → se encoge), **letras con vida**
(rebotan al aparecer, tiemblan en el dato clave, se aplastan con `squash`, caen en cascada), objetos
que lanza o toca (el número lo "empuja", confeti, destellos de tinta), squash & stretch continuo,
anticipación antes de saltar y caminatas con pasos reales. Las funciones de animación deben ser
**puras y testeadas** (`MancuAnimacion`).

**Restricciones que se mantienen:** no cambiar `TimelineResumen` (duraciones ni ventana de 600 ms)
sin avisar; textos de `TextosEscena`; no tocar Blobs; **sin objetos pesados por frame**
(`Paint`, `Path`, `RectF`, `Shader`, `Typeface`, `Bitmap`, `StaticLayout` sin cachear van como campos;
`String`, `Pair`, floats por frame están bien); el tiempo de generación debe seguir siendo corto
(medir con el log `ResumenVideo`, ver nota de tiempos).

## Cómo se trabajó (para repetirlo)

1. Spec → plan → workers de Codex por Orca → verificación independiente del coordinador.
2. **Un worker a la vez** (comparten árbol de trabajo y Gradle; un archivo a medio escribir de uno
   rompería la compilación del otro). Cada worker recibe un spec autocontenido (ver
   `docs/superpowers/notes/orca/ejemplo-spec-worker.txt`: Target, Change, Constraints, Ownership,
   Acceptance) y entrega con `worker_done`.
3. **Tras cada worker, el coordinador verifica por su cuenta:** `./gradlew testDebugUnitTest
   assembleDebug --offline --rerun-tasks -q`, suma de resultados en
   `app/build/test-results/testDebugUnitTest/*.xml`, `git diff` de lo que no debía tocarse
   (ejemplo: Blobs, `TimelineResumen`, tests existentes), y greps de asignaciones por frame.
4. Commit por tarea del worker; push solo si el usuario lo pide.

### Orca/Codex: trampas conocidas (Windows)

- CLI: `orca` (en el PATH). Run actual de la sesión: `run_1bb8698e65f2` (crear uno nuevo si ya no
  existe). Flujo: `orca orchestration run-create` → `worker-start --spec … --agent codex --worktree
  current` → `check --wait --types worker_done,escalation,question` → responder preguntas con `reply`
  → `check --ack <delivery>` → `worker-release --dispatch <id>`.
- **El Enter del prompt inicial se pierde** con prompts largos: Codex lo deja como borrador
  (`[Pasted Content N chars]`) y el dispatch queda en `turn_start_unobserved`. Síntoma: el worker
  "tarda mucho" sin tocar nada (`git status` limpio, sin transcript). Solución: usar
  `docs/superpowers/notes/orca/launch-worker.sh <archivo-spec> "<título>"`, que lanza el worker y, si
  ve el borrador, envía el Enter (`orca terminal send --terminal <handle> --enter`).
- Tras 3 fallos de arranque una tarea queda `blocked`: crear otra con `task-create --spec` (el texto se
  recupera de `orca orchestration task-list --json`).
- `worker-release` puede devolver `retained` si el usuario tocó la terminal; entonces no se cierra a
  la fuerza. Hay terminales de Codex ociosas retenidas de esta sesión (las puede cerrar el usuario).
- Un aviso de actualización de Codex (0.159.3 → 0.160.0) bloqueó un arranque; se eligió "Skip until
  next version". **No** instalar la actualización sin permiso.
- `Paint.letterSpacing` existe (API 21, en em) aunque el worker dijo que no; `minSdk` es 26.
- Al dar instrucciones a los workers, aclarar que "sin objetos por frame" se refiere a objetos
  pesados; si no, sobre-ingenian cachés.

### Comandos útiles

```bash
cd /c/Users/Usuario/Desktop/osfit/OSfit
./gradlew testDebugUnitTest assembleDebug --offline --rerun-tasks -q    # verificación completa
./gradlew installDebug --offline -q                                      # instalar en el celular
export PATH="$PATH:/c/Users/Usuario/AppData/Local/Microsoft/WinGet/Packages/Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe/platform-tools"
adb devices -l
timeout 25 adb logcat -d -t 4000 -s ResumenVideo:I     # tiempos: estilo, videoMs, generacionMs, ratio
```

(`adb logcat` sin `timeout` puede colgar si el teléfono se desconecta: queda en "waiting for device".)

## Pendientes menores

- Registrar el número real de tiempo de generación Blobs vs Mancu en la nota de tiempos (el usuario
  dice que es corto; falta el dato).
- Regenerar el grafo (`/graphify . --update`) para incluir las piezas Mancu.
- Escenas sin probar a fondo: medalla y logros con imágenes propias, dona con muchos días, nombres
  largos de clientes y rankings con varios nombres.
