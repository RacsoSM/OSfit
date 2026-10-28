# Resumen mensual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ventana "Resumen mensual" en el menú ☰ de la web de la clienta. Arriba va un `<select>` con
sus meses con actividad y flechas ← →. Por mes se muestran, en este orden: portada (% de asistencia,
kg levantados, tiempo en el gym), entrenamiento, calendario, fuerza al cierre y mejores marcas. Cada
mes cerrado se congela en Firestore el día 1 y llega un push que abre ese mes.

**Architecture:**
- **Módulo de cálculo:** uno puro, `resumenMensual.ts`, con gemelo en `web/src` y `functions/src` y
  prueba de igualdad entre los dos.
- **Cierre:** `cerrarMes`, una función programada, escribe
  `clientes/{cid}/resumenesMensuales/{AAAA-MM}` con `create()`. Es idempotente y respalda los meses
  que falten. Encola el aviso en `notificaciones` con un campo nuevo, `abrir`.
- **Web:** lee la subcolección (meses cerrados) y calcula el mes en curso en vivo con el mismo
  módulo.
- **Push:** el service worker y `main.ts` abren la ventana en el mes del aviso.

**Tech Stack:** Cloud Functions v2 (TypeScript, vitest), reglas de Firestore, web Vite + TypeScript
(vitest).

**Spec:** `docs/superpowers/specs/2026-10-28-resumen-mensual-design.md`. **Léelo completo antes de
empezar.** Este plan dice qué escribir; el spec dice por qué. El diseño visual es el tablero
"Final · B + A" del canvas de diseños (2026-10-28).

## Global Constraints

- **Contexto con graphify primero** (`CLAUDE.md`): `graphify query` antes de buscar a ciegas. **No
  regenerar, restaurar ni commitear `graphify-out/`.** El grafo es anterior al merge del
  2026-10-28 (no conoce `pinta` ni sedes): si no alcanza, búsqueda normal y avisar.
- **Reusar, no reescribir:**
  - `fuerzaPorMusculo`, `rangoGeneral`, `unoRm`, `nivelDe`, `pesoParaFuerza` y `edadEn` de
    `web/src/fuerza.ts`, con sus gemelos en `functions/src/fuerza.ts`;
  - `bancoEnSede` de `sede.ts`;
  - la regla de `rachaMasLarga` (`web/src/racha.ts` / `functions/src/rachas.ts`);
  - `hoyEnMazatlan`;
  - `escapar` de `ui/tarjetaDia.ts`.
- **Gemelos con prueba de igualdad:** el test de `functions/src/resumenMensual.test.ts` importa
  `../../web/src/resumenMensual` y compara, como `functions/src/fuerza.test.ts`.
- **La página nunca escribe en Firestore.** La subcolección es de solo lectura para la clienta.
- **`ventanas.ts` es el registro único** de ventanas. Las funciones de `ui/` devuelven HTML como
  string y son puras.
- **Campos opcionales:** todo lo nuevo en documentos ya existentes (`abrir` en `notificaciones`)
  es opcional y lleva el comentario de por qué.
- **Estilos solo con tokens del tema** (`var(--primario-oscuro)`, `var(--superficie)`…), sin
  colores fijos. Se revisa en los 6 estilos.
- **Funciones: desplegar siempre por nombre**
  (`--only functions:cerrarMes,functions:enviarNotificacion`), nunca `--only functions` a secas.
- **Desplegar, cambiar reglas y disparar `cerrarMes` a mano requieren confirmación del
  entrenador.**
- Código y tests en español; commits en inglés con las líneas de atribución de la sesión. Un
  commit por task, push al cerrar cada una, en la rama de la sesión. A `main` solo cuando el
  entrenador lo pida.

## Review Focus

- El corte del mes: nada de otro mes ni posterior a hoy entra al cálculo. La fuerza de cierre usa
  `hoy` = último día del mes (Task 1).
- `cerrarMes` es idempotente: dos corridas no duplican ni cambian documentos, y el push sale solo
  para el mes recién cerrado (Task 3).
- El gemelo da exactamente lo mismo que la web (Task 2).
- Todo texto que viene de Firestore (nombres de ejercicios, día de rutina) va escapado (Task 7).
- `?abrir=` no rompe `resolverSesion` y se borra de la dirección después de usarlo (Task 9).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `web/src/resumenMensual.ts` (+ test) | Crear | Cálculo puro de un mes, lista de meses, comparación de fuerza, formatos. |
| `functions/src/resumenMensual.ts` (+ test) | Crear | Gemelo + prueba de igualdad. |
| `functions/src/cerrarMes.ts` (+ test) | Crear | Meses por generar, aviso, la función programada. |
| `functions/src/index.ts` | Modificar | Exportar `cerrarMes`. |
| `functions/src/notificaciones.ts` (+ test) | Modificar | `Aviso.abrir?` opcional. |
| `functions/src/enviarNotificacion.ts` | Modificar | Copiar `abrir` a `data`. |
| `firestore.rules` | Modificar | `match /resumenesMensuales/{doc}`. |
| `web/src/datos.ts` | Modificar | Tipo `ResumenMensualGuardado`, `observarResumenesMensuales`. |
| `web/src/ui/calendario.ts` (+ test) | Modificar | Sacar la cuadrícula del mes a una función reusable. |
| `web/src/ui/resumenMensual.ts` (+ test) | Crear | HTML de la ventana y sus listeners. |
| `web/src/ventanas.ts`, `web/src/main.ts` | Modificar | Ventana `resumenMensual`, datos, conexión, abrir desde push. |
| `web/public/sw.js` | Modificar | `notificationclick` con `abrir`. |
| `web/src/estilos.css` | Modificar | Estilos de la ventana. |

---

## Task 1: Cálculo puro del mes (web)

**Files:** Create `web/src/resumenMensual.ts`, `web/src/resumenMensual.test.ts`.

- [ ] **Step 1: Tipos.** Exportar `ResumenMensual` (la forma del spec, sin `generado`) y la entrada:

```ts
export interface EntradaResumen {
  mes: string;                 // "AAAA-MM"
  corte: string;               // último día del mes, u hoy si está en curso
  asistencias: readonly Asistencia[];
  sesiones: readonly Sesion[];
  banco: readonly EjercicioBanco[];   // ya pasado por bancoEnSede
  perfil: {
    sexo: Sexo | null; peso: number | null; porcentajeGrasa: number | null;
    anioNacimiento: number | null; nombresDias: readonly string[];
  };
}
export function resumenDelMes(e: EntradaResumen): ResumenMensual;
export function mesesConActividad(asistencias: readonly Asistencia[], sesiones: readonly Sesion[]): string[]; // desc
export function ultimoDiaDe(mes: string): string;
export function compararFuerza(actual: ResumenMensual["fuerza"], anterior: ResumenMensual["fuerza"] | null):
  Record<string, number> | null; // grupo → diferencia de nivel; null si no hay anterior
export function formatoMinutos(min: number): string;   // 1044 → "17 h 24 min"; 45 → "45 min"
export function formatoKg(kg: number): string;          // 59123 → "59,123"
```

- [ ] **Step 2: Tests que fallan primero** (`resumenMensual.test.ts`):
  - porcentaje con entreno 10, justificadas 7 y faltas 2 → 53; una `ganadaEnRuleta` cuenta como
    justificada;
  - registros de otro mes y posteriores al `corte` no cuentan;
  - `rachaMasLarga` que viene del mes anterior empieza a contar el día 1; un fin de semana sin
    registro no corta;
  - `minutos` suma solo `duracionMinutos` numéricos; `visitasConMinutos` los cuenta;
  - kg: suma `caidas`, excluye tiempo y cardio, corporal suma series y reps pero no kg;
  - `top`: empate por veces → más series → nombre; máximo 5;
  - `diaFavorito` con su nombre de `nombresDias`; `null` sin `diaRutinaRealizado`;
  - fuerza con corte al fin de mes: una sesión de hace 9 semanas no cuenta; sin peso o sin sexo
    → `fuerza: null`;
  - marcas: mejor serie por ejercicio sin `caidas`, ordenadas por nivel, máximo 5; sin estándar,
    no entra;
  - `mesesConActividad` desc y sin meses vacíos; `formatoMinutos` y `formatoKg`.
- [ ] **Step 3: Implementar.** La fuerza se calcula con `fuerzaPorMusculo(sesiones, banco, sexo,
  pesoParaFuerza(...), corte, edadEn(anio, corte))` y `rangoGeneral`. La racha usa la misma regla
  que `rachaMasLarga` aplicada solo a las fechas del mes: extraer una función `rachaMasLargaEntre`
  o filtrar las asistencias del mes antes de llamarla, sin duplicar la regla.
- [ ] **Step 4:** `cd web && npx vitest run src/resumenMensual.test.ts` en verde y `npx tsc --noEmit`.
- [ ] **Step 5: Commit** "Monthly summary: pure calculation for the client web".

## Task 2: Gemelo en functions

**Files:** Create `functions/src/resumenMensual.ts`, `functions/src/resumenMensual.test.ts`.

- [ ] **Step 1:** Copiar el cálculo sobre los tipos de functions (`SesionFuerza` ampliado con
  `nombre` y `caidas`, `EjercicioFuerza` con `nombre`), usando `nivelesPorMusculo`, `rachas.ts`,
  etc. de functions. Encabezado `GEMELO: web/src/resumenMensual.ts`.
- [ ] **Step 2: Prueba de igualdad:** los mismos datos de entrada (con pinta, corporal, dropset,
  cardio, justificadas y una racha que cruza el día 1) dan el mismo objeto en los dos.
- [ ] **Step 3:** `cd functions && npx vitest run src/resumenMensual.test.ts` y `npm run build`.
- [ ] **Step 4: Commit** "Monthly summary: functions twin with equality test".

## Task 3: `cerrarMes`

**Files:** Create `functions/src/cerrarMes.ts`, `functions/src/cerrarMes.test.ts`. Modify
`functions/src/index.ts`.

- [ ] **Step 1: Funciones puras, con test primero:**
  - `mesesPorGenerar(mesesConActividad: string[], yaGuardados: Set<string>, hoy: string): string[]`
    devuelve solo los cerrados (`< hoy.slice(0, 7)`) sin documento.
  - `mesRecienCerrado(hoy: string): string | null` devuelve el mes anterior si `hoy` es día 1, y
    `null` cualquier otro día.
  - `avisoResumen(cid, mes, r): { id, titulo, texto, abrir }` arma:
    - `id` `resumenMensual_{cid}_{mes}`;
    - `titulo` "Tu resumen de octubre ya está listo";
    - `texto` con días entrenados y kg, por ejemplo "10 días entrenados y 59,123 kg levantados".
  - Tests:
    - no regenera un mes guardado;
    - no incluye el mes en curso;
    - fuera del día 1 no hay push;
    - el día 1, el push sale solo para el mes recién cerrado y nunca para los del respaldo.
- [ ] **Step 2: La función.**
  `onSchedule({ schedule: "30 0 1 * *", timeZone: "America/Mazatlan", region: REGION })`.
  - Lee el banco y las sedes una vez.
  - Por cliente lee asistencias (`where clienteId ==`), sesiones, el perfil y los ids ya guardados
    de `resumenesMensuales`.
  - Calcula con el gemelo, con el banco en su sede.
  - Escribe cada mes con `create({ ...r, generado: FieldValue.serverTimestamp() })` y se salta si
    el documento ya existe (`YA_EXISTE`, como `programarAvisos`).
  - Si el mes es `mesRecienCerrado(hoy)`, el documento se creó en esta corrida y la clienta tiene
    `notificacionesWeb`, encola el aviso en `notificaciones` con `create()`, igual que `encolar`
    en `programarAvisos`, con `automatico: "resumenMensual"` y `abrir`.
  - Usa try/catch por clienta y un log final con cuántos meses escribió y cuántos avisos encoló.
- [ ] **Step 3:** Exportar en `index.ts`. `npx vitest run` y `npm run build`.
- [ ] **Step 4: Commit** "cerrarMes: freeze each closed month and notify".

## Task 4: El aviso trae `abrir`

**Files:** Modify `functions/src/notificaciones.ts` (+ test), `functions/src/enviarNotificacion.ts`.

- [ ] **Step 1:** `Aviso.abrir?: { ventana: string; mes?: string }`. Es opcional, con un comentario
  de por qué: los avisos del entrenador y los viejos no lo traen. `avisoDesdeDoc` lo lee solo si
  `ventana` es texto y `mes` coincide con `/^\d{4}-\d{2}$/`; si no, lo omite. Tests para un aviso
  con `abrir`, sin él y con uno malformado.
- [ ] **Step 2:** En `sendEachForMulticast`, `data` suma `abrir: JSON.stringify(aviso.abrir)`
  cuando existe. FCM solo acepta strings en `data`.
- [ ] **Step 3: Commit** "Notifications: optional abrir to open a window".

## Task 5: Reglas

**Files:** Modify `firestore.rules`.

- [ ] **Step 1:** Leer `firestore.rules` completo. Dentro de `match /clientes/{cid}`:

```
// Los escribe solo cerrarMes (Admin SDK). La clienta lee los suyos; el entrenador, todos.
match /resumenesMensuales/{doc} {
  allow read: if esEntrenador() || esCliente(cid);
  allow write: if false;
}
```

- [ ] **Step 2: Commit** "Rules: clients read their monthly summaries". El despliegue de reglas
  va en la Task 11.

## Task 6: Datos en la web

**Files:** Modify `web/src/datos.ts`, `web/src/ventanas.ts` (`DatosCliente`), `web/src/main.ts`.

- [ ] **Step 1:** Tipo `ResumenMensualGuardado = ResumenMensual & { generado?: Timestamp | null }`
  y `observarResumenesMensuales(cid, alCambiar)` sobre la subcolección, con el manejador de error
  de los demás listeners (`escuchar`).
- [ ] **Step 2:** `DatosCliente.resumenes?: ResumenMensualGuardado[] | null`. En `main.ts` se pide
  la primera vez que la ventana activa es `resumenMensual`, igual que `observarHistorial` para
  Estadísticas.
- [ ] **Step 3:** `datosResumenMensual(d)` en `ventanas.ts` arma, para la UI:
  - la lista de meses: "en curso" si `mesesConActividad` incluye el mes de hoy, más los guardados;
  - el mes elegido;
  - su resumen: el guardado, o el calculado en vivo con `resumenDelMes` con corte = hoy, banco en
    sede, perfil y nombres de días de `rutinaAsignada`;
  - la fuerza del mes anterior para comparar.
- [ ] **Step 4: Commit** "Monthly summary: data for the window".

## Task 7: La ventana (UI)

**Files:** Create `web/src/ui/resumenMensual.ts`, `web/src/ui/resumenMensual.test.ts`. Modify
`web/src/ui/calendario.ts` (+ test).

- [ ] **Step 1: Calendario reusable.** Extraer de `calendario()` la cuadrícula del mes a
  `cuadriculaMes(dias: Record<string, "e" | "j" | "f">, mes, hoy | null)`. `calendario()` la sigue
  usando y sus tests no cambian.
- [ ] **Step 2: Estado del mes elegido** en el módulo, como Registro: `mesElegido` sobrevive a los
  repintados. Funciones `elegirMes(mes)` y `reiniciarResumenMensual()`.
- [ ] **Step 3: HTML, en el orden del diseño "Final · B + A":**
  - Selector: botón ←, `<select aria-label="Mes">` y botón →. Las flechas usan `disabled` en las
    orillas. Debajo, la línea "Al 28 de octubre. Se cierra el 1 de noviembre." solo en curso.
  - Portada: "EN CURSO · AL 28" o "CERRADO", el mes en grande y tres datos: "53 %" asistencia,
    "59,123 kg" kg levantados, "17 h 24 min" tiempo en el gym. "—" donde no hay base.
  - Entrenamiento: tres cajas (kg, series, reps), "N entrenamientos registrados · Día favorito: …",
    y la lista "Lo que más hiciste".
  - Calendario: `cuadriculaMes` y una leyenda (Entrenó, Justificada, Falta).
  - Fuerza: "Rango general: Avanzado (7.06)" y la lista de músculos con su rango, el nivel y una
    barra de 0 a 8. Lleva la flecha de cambio contra el mes anterior, o la pastilla "Primer mes con
    datos".
  - Mejores marcas: título en versalitas y una lista con divisiones ("100 kg × 4", "15 reps").
  - Una sección sin datos no se pinta. Sin meses: "Todavía no hay meses que resumir".
- [ ] **Step 4: Tests:**
  - orden de las secciones;
  - flechas deshabilitadas en las orillas;
  - "en curso" y la línea de cierre solo en el mes actual;
  - secciones vacías ocultas;
  - nombres escapados;
  - formato de kg y de tiempo;
  - comparación (↑, ↓ y "Primer mes con datos").
- [ ] **Step 5: `conectarResumenMensual(repintar)`:** `change` en el select y `click` en las flechas
  llaman a `elegirMes` y repintan.
- [ ] **Step 6: Commit** "Monthly summary: the window".

## Task 8: Registro de la ventana

**Files:** Modify `web/src/ventanas.ts`, `web/src/main.ts` (+ tests de `ventanas`, `menuLateral`).

- [ ] **Step 1:** `IdVentana` suma `"resumenMensual"`. La entrada de `VENTANAS` va después de
  Estadísticas: `{ id: "resumenMensual", titulo: "Resumen mensual", icono: "", grupo: "principal",
  pintar: (d) => ventanaResumenMensual(datosResumenMensual(d)) }`.
- [ ] **Step 2:** `main.ts` conecta los listeners al pintar esa ventana, como `conectarEstadisticas`.
- [ ] **Step 3:** El test del menú confirma que sale "Resumen mensual" sin emoji, después de
  Estadísticas.
- [ ] **Step 4: Commit** "Menu: Resumen mensual window".

## Task 9: Abrir desde el push

**Files:** Modify `web/public/sw.js`, `web/src/main.ts` (+ test donde aplique).

- [ ] **Step 1:** Leer `resolverSesion` y `firebase.ts`. Confirmar que un `?abrir=…&mes=…` en la
  raíz no se toma por token. Si choca, usar otro nombre de parámetro y dejarlo escrito.
- [ ] **Step 2:** En `sw.js`, el `push` guarda `datos.abrir` en `notification.data`. En
  `notificationclick`, con `abrir`:
  - si hay una ventana abierta: `v.postMessage({ abrir })` y `v.focus()`;
  - si no: `openWindow("/?abrir=" + ventana + "&mes=" + mes)`.
- [ ] **Step 3:** En `main.ts`:
  - al arrancar, `leerAbrir(location.search)` (puro, con test) abre la ventana y elige el mes; luego
    `history.replaceState` con la dirección sin parámetros;
  - `navigator.serviceWorker.addEventListener("message", …)` hace lo mismo con la página abierta;
  - solo se aceptan ventanas que existen en `VENTANAS` y meses `AAAA-MM`.
- [ ] **Step 4: Commit** "Push: open the monthly summary on its month".

## Task 10: Estilos

**Files:** Modify `web/src/estilos.css`.

- [ ] **Step 1:** Clases con prefijo `rm-`:
  - `.rm-selector`;
  - `.rm-portada`: fondo `var(--primario-oscuro)` y texto `var(--primario-claro)` o claro;
  - `.rm-datos`, `.rm-cajas`, `.rm-barra`, `.rm-marcas li` (con `border-top`).
  - La cuadrícula reusa la de `.cal`.
  - Solo tokens. Botones de 44 px.
- [ ] **Step 2:** Revisar en los 6 estilos de paleta, en el navegador local (`npm run dev`), a
  390 px de ancho, que el contraste de la portada se lea en todos.
- [ ] **Step 3: Commit** "Monthly summary: styles".

## Task 11: Desplegar y primera corrida (con confirmación del entrenador)

- [ ] **Step 1:** Todo verde: `cd web && npx vitest run && npx tsc --noEmit` y
  `cd functions && npx vitest run && npm run build`.
- [ ] **Step 2 (confirmar antes):** `firebase deploy --only firestore:rules`.
- [ ] **Step 3 (confirmar antes):**
  `firebase deploy --only functions:cerrarMes,functions:enviarNotificacion`.
- [ ] **Step 4 (confirmar antes):** desplegar la web (hosting), como siempre.
- [ ] **Step 5 (confirmar antes):** disparar `cerrarMes` una vez a mano (correr su job de Cloud
  Scheduler) para el respaldo. Como no es día 1, no sale ningún push. Revisar en Firestore que
  cada clienta con actividad tenga sus meses cerrados, y que una segunda corrida no cambie nada.
- [ ] **Step 6:** Abrir la web como Said y Oscar: octubre "en curso", septiembre cerrado (solo
  asistencia), las flechas y el select.
- [ ] **Step 7:** El 1 de noviembre, revisar que llegó el push "Tu resumen de octubre ya está
  listo" y que abre la ventana en **octubre**, ya cerrado.
