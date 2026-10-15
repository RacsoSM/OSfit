# El camino de la Fuerza Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un camino tipo Duolingo por músculo, en la web de la clienta: paradas de doble progresión (peso × reps) con el ejercicio de su mejor marca, hasta Élite, con las paradas de rango marcadas. Se abre desde una tarjeta en Inicio con los músculos de su día, celebra en el resumen y al abrir, y lo cumplido no se pierde.

**Architecture:** Dos datos nuevos: el campo `equipo` en el banco (decide el incremento) y la colección `clientes/{cid}/marcas/{ejercicioId}` con la **frontera** de sus series de siempre (las que ninguna otra supera en peso y reps a la vez), que escribe solo el servidor al registrar, editar y borrar. El camino en sí no se guarda: la web lo calcula con un módulo puro (`web/src/camino.ts`) a partir de la frontera, el banco y su perfil. Ventana nueva `camino`, subventana de Inicio.

**Tech Stack:** Cloud Functions v2 (TypeScript, vitest), reglas de Firestore, web Vite + TypeScript (vitest), scripts Node con Admin SDK.

**Spec:** `docs/superpowers/specs/2026-10-15-camino-de-la-fuerza-design.md`. **Léelo completo antes de empezar.** Este plan dice qué escribir; el spec dice por qué.

## Global Constraints

- **Contexto con graphify primero** (`CLAUDE.md`): `graphify query` antes de buscar a ciegas. **No regenerar, restaurar ni commitear `graphify-out/`.**
- **Funciones: desplegar siempre por nombre** (`--only functions:<a>,functions:<b>`). Un `--only functions` a secas intenta borrar `guardarEstilo`, que vive en Firebase pero no en el código.
- **Desplegar y correr scripts que escriben en Firestore requieren confirmación del entrenador.** Cada script trae `--prueba` (solo muestra) y se corre así primero.
- **Incrementos (Δ) por equipo, en kg:** barra 2.5, mancuerna 2.5 (por mancuerna, tope 37.5), máquina 4.5, polea 4.5; sin `equipo`, 2.5. Corporal: +1 rep.
- **Rango de reps:** 8–12; **12–20** cuando el músculo del camino es `pantorrilla` o `abdomen`.
- **Parada cumplida = dominancia:** alguna serie de la frontera con `peso ≥ p` y `reps ≥ r`. Nunca por 1RM.
- **El nivel de una parada usa el cálculo de siempre** (`unoRm`, `pesoParaFuerza`, `factorPeso`, `factorEdad`, `nivelDe` de `web/src/fuerza.ts`). Nada de fórmulas nuevas de fuerza.
- **Gemelos con prueba de igualdad** entre `functions/src` y `web/src` (como `functions/src/fuerza.ts`): el test de functions importa el de la web y compara.
- **Las bajadas de dropset (`caidas`) no cuentan** para marcas, igual que para la fuerza.
- Campos nuevos opcionales en la web (Firestore omite los que nunca se escribieron).
- Estilos con los tokens de cada tema (`var(--primario)`, etc.), sin colores fijos: se revisa en los 6 estilos.
- Commits en inglés con prefijo y las líneas de atribución de la sesión. Un commit por task, push al cerrar cada una, en la rama de la sesión. A `main` solo cuando el entrenador lo pida.

## Review Focus

- La frontera: mezclar es idempotente, conserva solo las no dominadas, e ignora `caidas` y series sin peso en ejercicios de peso (Task 2).
- Editar o borrar una sesión con un peso equivocado deja la frontera como si nunca hubiera existido (Task 3).
- La escalera: orden de doble progresión, inicio redondeado, tope de mancuernas, 12–20 en pantorrilla y abdomen, corporales solo reps, fin en Élite (Task 5).
- Una parada saltada se ve cumplida; la actual es la primera no cumplida (Task 5).
- El camino no retrocede cuando la marca sale de las 8 semanas (Task 5: el cálculo nunca mira la ventana).
- Sin marcas, sin peso o sin sexo: cada caso con su mensaje (Tasks 5 y 7).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `functions/scripts/proponerEquipo.mjs` (+ `.test.mjs`) | Crear | Propone `equipo` por ejercicio y escribe la lista para revisar; con `--cargar` la sube. |
| `docs/camino-fuerza/equipo.md` | Crear (generado) | La lista para que el entrenador la revise. |
| `functions/semilla/ejercicios.json` | Modificar | `equipo` en cada ejercicio, para que no se pierda al recargar el banco. |
| `web/src/datos.ts` | Modificar | `EjercicioBanco.equipo?`, tipo `Marca`, `observarMarcas`. |
| `web/src/marcas.ts` (+ test) | Crear | Frontera pura: `mezclarFrontera`, `fronteraDeSesiones`. |
| `functions/src/marcas.ts` (+ test) | Crear | Gemelo de la frontera + `actualizarMarcas` / `recalcularMarcas` (Firestore). |
| `functions/src/registrarSesion.ts` | Modificar | Llamar a las marcas en registrar, editar y borrar. |
| `firestore.rules` | Modificar | `match /marcas/{doc}`. |
| `functions/scripts/armarMarcas.mjs` | Crear | Respaldo inicial de las marcas de todas. |
| `web/src/camino.ts` (+ test) | Crear | Escalera, paradas, ejercicio del camino, músculos de hoy. |
| `web/src/ui/camino.ts` (+ test) | Crear | Ventana del camino y tarjeta de Inicio (HTML + listeners). |
| `web/src/ventanas.ts`, `web/src/navegacion.ts`, `web/src/main.ts` | Modificar | Ventana `camino`, `PADRE`, datos y conexión. |
| `web/src/resumen.ts`, `web/src/ui/registro.ts` | Modificar | "¡Parada cumplida!" en el resumen. |
| `web/src/estilos.css` (+ los `estilo*.css` que haga falta) | Modificar | Camino, nodos, franja "Hoy". |
| `docs/backlog-2.md` | Modificar | Estado al terminar. |

---

## Task 1: `equipo` en el banco

**Files:** `functions/scripts/proponerEquipo.mjs`, `functions/scripts/proponerEquipo.test.mjs`, `docs/camino-fuerza/equipo.md`, `functions/semilla/ejercicios.json`, `web/src/datos.ts`.

- [ ] **Step 1: Test de la propuesta.** En `proponerEquipo.test.mjs`, `proponerEquipo(ej)` con:
  - `tipo: "corporal"` → `"corporal"`.
  - `pesoPorMancuerna: true` o nombre/id con "mancuerna" → `"mancuerna"`.
  - id o nombre con "polea" o "cuerda" → `"polea"`.
  - id o nombre con "maquina"/"máquina", "prensa", "hack", "smith", "pec deck", "jalon"/"jalón" → `"maquina"`.
  - "barra", "press-banca", "sentadilla", "peso muerto", "dominadas lastradas" → `"barra"`.
  - Lo demás → `null` (va a la lista como "sin propuesta").
  Corre `node --test scripts/proponerEquipo.test.mjs` y verifica que falla.
- [ ] **Step 2: Implementar** `proponerEquipo` (exportada, pura) y el script:
  - Lee `ejercicios` de Firestore (para tener `pesoPorMancuerna`, que no está en la semilla) con el Admin SDK, como `cargarEstandares.mjs`.
  - Escribe `docs/camino-fuerza/equipo.md`: tabla `id | nombre | equipo propuesto | Δ`, agrupada por equipo, con "sin propuesta" arriba.
  - `--cargar`: escribe `equipo` con `merge` en cada `ejercicios/{id}` (las filas que digan `null` no se tocan) y lo agrega a `functions/semilla/ejercicios.json`.
  Corre el test y verifica que pasa.
- [ ] **Step 3: Generar la lista** con `node scripts/proponerEquipo.mjs` y **pedirle al entrenador que la revise** (en especial "sin propuesta"). Aplicar sus correcciones a mano en un mapa `CORRECCIONES` dentro del script.
- [ ] **Step 4: Web.** `EjercicioBanco.equipo?: "barra" | "mancuerna" | "maquina" | "polea" | "corporal"` en `web/src/datos.ts`, con su comentario. `npx tsc --noEmit`.
- [ ] **Step 5: Cargar** con `--cargar` **solo con el visto bueno del entrenador**. Commit: `feat: exercise bank knows each exercise's equipment (for the strength path's increments)`.

## Task 2: La frontera (pura, gemela)

**Files:** `web/src/marcas.ts`, `web/src/marcas.test.ts`, `functions/src/marcas.ts`, `functions/src/marcas.test.ts`.

```ts
export interface SerieMarca { peso: number | null; reps: number; fecha: string; }
/** Las series no superadas: ninguna otra tiene peso ≥ y reps ≥ con una de las dos mayor. */
export function mezclarFrontera(frontera: readonly SerieMarca[], nuevas: readonly SerieMarca[]): SerieMarca[];
/** Frontera de un ejercicio desde cero, con todas sus sesiones. */
export function fronteraDeSesiones(ejercicioId: string, sesiones: readonly { fecha: string; ejercicios: { ejercicioId: string; series: { reps: number; peso: number | null }[] }[] }[]): SerieMarca[];
```

- [ ] **Step 1: Tests (web)**, que fallen primero:
  - Una serie dominada no entra; una que domina saca a las que supera.
  - Empates exactos (mismo peso y reps): se queda la **más vieja** (la fecha en que lo logró por primera vez).
  - Idempotente: mezclar la misma lista dos veces da lo mismo.
  - Orden de salida estable: por peso descendente, luego reps descendente.
  - `peso: null` (corporales) compara solo reps.
  - `reps < 1` o `peso` negativo se ignoran.
  - `fronteraDeSesiones` ignora otros ejercicios y no mira `caidas`.
- [ ] **Step 2: Implementar** `web/src/marcas.ts`. Tests en verde.
- [ ] **Step 3: Gemelo** `functions/src/marcas.ts` (copia de las dos funciones puras) y `functions/src/marcas.test.ts` que importa `../../web/src/marcas` y compara resultados en una batería de casos (como `fuerza.test.ts`).
- [ ] **Step 4:** `npx tsc --noEmit` y `npx vitest run` en `web/` y `functions/`. Commit: `feat: best-sets frontier, shared by server and web`.

## Task 3: El servidor guarda las marcas

**Files:** `functions/src/marcas.ts`, `functions/src/registrarSesion.ts`, `firestore.rules`.

- [ ] **Step 1: Firestore en `marcas.ts`:**
  - `inicioDeEscalera(peso, equipo)`: múltiplo de Δ hacia abajo, mínimo Δ; `0` en corporales. Pura, con test (20.7 kg barra → 20; 3 kg mancuerna → 2.5; 10 kg polea → 9).
  - `actualizarMarcas(clienteId, ejercicios, fecha, banco)`: por ejercicio con `tipo` peso o corporal, lee `clientes/{cid}/marcas/{ejercicioId}`, mezcla y escribe `{ ejercicioId, inicio, frontera, actualizado }`. `inicio` solo se fija si no existe. En una transacción por ejercicio.
  - `recalcularMarcas(clienteId, ejercicioIds, banco)`: lee **todas** las sesiones de la clienta, rehace la frontera de esos ejercicios con `fronteraDeSesiones` y escribe; si queda vacía, borra el doc. `inicio` se recalcula desde la serie más vieja que quede.
- [ ] **Step 2: Conectar** en `registrarSesion.ts`:
  - `registrarSesion`: después de guardar, `actualizarMarcas(...)` con `.catch(console.error)`, como la duración (si falla, el entrenamiento ya está guardado).
  - `editarSesion`: leer los ejercicios de antes, guardar, y `recalcularMarcas` con la unión de ids de antes y de ahora.
  - `borrarSesion`: leer los ejercicios antes de borrar y `recalcularMarcas` con sus ids.
- [ ] **Step 3: Reglas**, dentro de `match /clientes/{cid}`:
  ```
  match /marcas/{doc} {
    allow read: if esEntrenador() || esCliente(cid);
    allow write: if esEntrenador();
  }
  ```
- [ ] **Step 4:** `npx tsc --noEmit`, `npx vitest run` en `functions/`. Commit: `feat: the server keeps each client's all-time best sets per exercise`.

## Task 4: Respaldo inicial

**Files:** `functions/scripts/armarMarcas.mjs`.

- [ ] **Step 1:** Script con el Admin SDK que, por cada clienta, lee todas sus sesiones y el banco, y escribe `marcas` con `fronteraDeSesiones` e `inicioDeEscalera` (importados del build de `functions/lib`). `--prueba` imprime por clienta cuántos ejercicios y series de frontera saldrían, sin escribir.
- [ ] **Step 2:** Correr con `--prueba` y mostrar el resultado al entrenador. Correr de verdad **solo con su visto bueno y después de desplegar Task 3** (si no, una sesión registrada entre el respaldo y el despliegue quedaría fuera). Commit: `feat: script to build the best-sets of existing sessions`.

## Task 5: El cálculo del camino (puro)

**Files:** `web/src/camino.ts`, `web/src/camino.test.ts`.

```ts
export const DELTA: Record<Equipo, number> = { barra: 2.5, mancuerna: 2.5, maquina: 4.5, polea: 4.5, corporal: 0 };
export const TOPE_MANCUERNA = 37.5;
export function rangoReps(musculo: string): [number, number];          // [8,12] o [12,20]
export interface Parada { peso: number | null; reps: number; nivel: number; estado: "cumplida" | "actual" | "bloqueada"; rango?: number /* índice de RANGOS */ }
export interface Camino { musculo: string; ejercicio: { id: string; nombre: string }; paradas: Parada[]; actual: number /* índice */; fin: "elite" | "tope-mancuerna" }
export function ejercicioDelCamino(musculo, marcas, banco, perfil): string | null;
export function caminoDe(musculo, marcas, banco, perfil): Camino | { sin: "marcas" | "perfil" };
export function musculosDeHoy(dia: DiaRutina | null, banco, indice): string[];
```

`perfil` = `{ sexo, pesoCorporal (ya con pesoParaFuerza), edad }`.

- [ ] **Step 1: Tests**, que fallen primero:
  - **Escalera de peso:** inicio 20, barra, músculo pecho → `20×8, 20×9 … 20×12, 22.5×8 …`.
  - **Pantorrilla:** `p×12 … p×20, (p+Δ)×12`.
  - **Polea:** sube de 4.5.
  - **Mancuerna:** termina en `37.5 × tope` con `fin: "tope-mancuerna"` si no llegó a Élite antes.
  - **Corporal:** solo reps, `+1`, desde su primera marca.
  - **Fin en Élite:** la última parada es la primera con `nivel ≥ RANGOS[RANGOS.length-1].desde`; tope de seguridad de 400 paradas.
  - **Cumplidas por dominancia**, incluida una parada saltada; `actual` es la primera no cumplida; si todas están cumplidas, `actual` es la última.
  - **Paradas de rango:** `rango` solo en la primera parada que alcanza cada rango por encima del nivel de la primera parada.
  - **El nivel de una parada** coincide con lo que daría `fuerzaPorMusculo` para esa serie (mismo factor de peso, grasa y edad).
  - **`ejercicioDelCamino`:** entre los ejercicios con `musculos[m] === 1`, estándares y marcas, el de mayor nivel con su mejor serie de siempre; empate → el de marca más reciente. Ignora la ventana de 8 semanas.
  - **Sin marcas** → `{ sin: "marcas" }`; **sin sexo o peso** → `{ sin: "perfil" }`.
  - **`musculosDeHoy`:** principales de los ejercicios del día, en orden de la rutina, sin repetir; `[]` en descanso o sin rutina.
- [ ] **Step 2: Implementar** reutilizando `unoRm`, `nivelDe`, `factorPeso`, `factorEdad` de `fuerza.ts` (exportar lo que haga falta, sin cambiar su comportamiento) y el índice del banco (`claveBanco`) para los nombres de la rutina.
- [ ] **Step 3:** tests y `tsc` en verde. Commit: `feat: strength path calculation (double progression up to Élite)`.

## Task 6: Las marcas llegan a la web

**Files:** `web/src/datos.ts`, `web/src/main.ts`, `web/src/ventanas.ts`.

- [ ] **Step 1:** `observarMarcas(clienteId, alCambiar)` en `datos.ts` con el patrón de `observarSesiones` (`escuchar("marcas", …)`, toda la subcolección). Tipo `Marca = { ejercicioId; inicio; frontera: SerieMarca[] }`.
- [ ] **Step 2:** En `main.ts`, `let marcas: Marca[] | null = null`, suscribirse junto a sesiones y pasarlo en `datos`; `DatosCliente.marcas?: Marca[] | null`.
- [ ] **Step 3:** `tsc` y tests. Commit: `feat: web listens to the client's best sets`.

## Task 7: Ventana del camino

**Files:** `web/src/ui/camino.ts`, `web/src/ui/camino.test.ts`, `web/src/ventanas.ts`, `web/src/navegacion.ts`, `web/src/main.ts`, `web/src/estilos.css`.

- [ ] **Step 1: Navegación.** `IdVentana` suma `"camino"`; entrada en `VENTANAS` con `titulo: "El camino de la Fuerza"`, `grupo: "sub"`; `PADRE` suma `camino: "inicio"`. Ajustar los tests de `ventanas.test.ts` y `navegacion.test.ts` que listan ventanas.
- [ ] **Step 2: Tests de la vista** (`ventanaCamino(datos)` devuelve HTML), que fallen primero:
  - Franja "Hoy" con una mini tarjeta por músculo de hoy y su parada actual; la elegida con `aria-pressed="true"`.
  - Fila "Otros" con el resto de los músculos con camino o sin marcas.
  - Nodos con clase por estado (`cumplida`, `actual`, `bloqueada`) y los de rango con `insigniaRango`.
  - El nodo actual lleva `id="camino-actual"` y el objetivo con el ejercicio.
  - Sin marcas: "Registra un ejercicio de {músculo} para empezar tu camino" y los ejercicios del banco que lo trabajan como principal (los de su rutina primero).
  - Sin perfil: el mismo aviso que Músculos.
  - Mancuerna al tope: el mensaje de "las mancuernas más pesadas del gimnasio".
- [ ] **Step 3: Implementar.** Estado del módulo (músculo elegido) fuera del HTML, como `comparar.ts`, para que un snapshot no lo cambie. `abrirCamino(musculo)` para que Inicio abra en uno. Listener delegado: tocar mini tarjeta o chip cambia de músculo; deslizar a los lados (patrón de `deslizarRegistro.ts`) pasa al siguiente o anterior. Después de pintar al abrir o cambiar de músculo, `document.getElementById("camino-actual")?.scrollIntoView({ block: "center" })`.
- [ ] **Step 4: Estilos.** Camino vertical con zigzag (desplazamiento horizontal alterno de los nodos), línea entre nodos, nodo actual más grande con anillo en `--primario`; bloqueados con opacidad. Revisar con Playwright (`executablePath: /opt/pw-browsers/chromium`) a 390 px en los 6 estilos.
- [ ] **Step 5:** `tsc` y tests. Commit: `feat: strength path window, one muscle at a time with today's strip`.

## Task 8: Tarjeta en Inicio

**Files:** `web/src/ui/camino.ts`, `web/src/ventanas.ts`, `web/src/main.ts`, tests.

- [ ] **Step 1: Tests:** `tarjetaCamino(datos)` muestra una fila por músculo de hoy con "Músculo · Ejercicio  peso × reps"; en descanso o sin rutina, la de su músculo más avanzado; sin marcas en ninguno, una invitación a registrar; sin perfil, no se pinta. Cada fila lleva `data-camino="<músculo>"` y hay un "Ver mi camino".
- [ ] **Step 2:** Implementar y ponerla en `inicio()` de `ventanas.ts` debajo de la tarjeta del día. En `main.ts`, el click en `[data-camino]` llama `abrirCamino(m)` y `abrirVentana("camino")`.
- [ ] **Step 3:** `tsc`, tests y captura en Playwright. Commit: `feat: today's strength path stops on Inicio`.

## Task 9: Celebración

**Files:** `web/src/resumen.ts`, `web/src/ui/registro.ts`, `web/src/ui/camino.ts`, tests.

- [ ] **Step 1: Resumen.** `armarResumen` recibe `marcasAntes` y calcula, con `mezclarFrontera` sobre las series del envío, las paradas cumplidas de más por músculo (`caminoDe` antes y después). Nuevo campo `paradas: { musculo; nombre; subio: number; siguiente: Parada }[]`. Test con un envío que cumple 2 paradas de pecho.
- [ ] **Step 2:** `vistaResumen` pinta "¡Parada cumplida!" con una fila por músculo ("Pecho: +2 paradas. Siguiente: 27.5 kg × 10") y un botón "Ver mi camino".
- [ ] **Step 3: Al abrir el camino.** Guardar por músculo el índice actual visto en `localStorage` (`osfit.camino.visto`, en try/catch). Si el actual es mayor que el visto, las paradas entre ambos llevan la clase `recien` (animación corta de ✓ y desbloqueo, con `prefers-reduced-motion` respetado) y luego se actualiza lo visto.
- [ ] **Step 4:** `tsc`, tests y captura. Commit: `feat: celebrate completed path stops in the summary and on the path`.

## Task 10: Despliegue y cierre

- [ ] **Step 1:** Con el visto bueno del entrenador: merge a `main`, `firebase deploy --only firestore:rules,functions:registrarSesion,functions:editarSesion,functions:borrarSesion,hosting`.
- [ ] **Step 2:** Correr `armarMarcas.mjs` (Task 4) de verdad.
- [ ] **Step 3:** Verificar con una clienta real (en `--prueba` o leyendo sus marcas) que su camino de pecho arranca donde corresponde.
- [ ] **Step 4:** Backlog 2, punto 13: `✅ HECHO (fecha)` con un resumen. Commit: `docs: strength path done`.
