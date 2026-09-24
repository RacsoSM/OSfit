# Ranking de rachas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Darle contenido a la ventana "Ranking" de la web del cliente: un top de clientes por racha actual (solo activos) y por racha histórica (todos), calculado por una Cloud Function callable.

**Architecture:** Una función `obtenerRanking` (Admin SDK) lee `clientes` y `asistencias`, calcula las dos rachas con un gemelo TS de `RachaCalculator` y devuelve dos listas ya ordenadas con solo puesto, nombre, racha y `esTuyo`. La web la llama cada vez que se entra a la ventana y pinta una tarjeta pura con un control segmentado Actual/Histórica.

**Tech Stack:** Firebase Functions v2 (`onCall`, TypeScript, commonjs), Firebase Admin SDK, web con Vite + TypeScript + Firebase JS SDK, pruebas con vitest en ambos proyectos.

**Spec:** `docs/superpowers/specs/2026-09-24-ranking-rachas-design.md`

## Global Constraints

- Reglas de racha idénticas a `RachaCalculator` (Kotlin): solo días hábiles (lun–vie); cuentan `asistio || justificada`; día de gracia: hoy hábil sin registro no rompe la racha.
- `actual` incluye solo clientes con `activo === true` (ausente o no booleano cuenta como `false`); `historica` incluye a todos.
- Orden: racha descendente, luego nombre con `localeCompare(..., "es")`. Empates comparten puesto (10, 10, 8 → 1, 1, 3). Racha 0 sí aparece.
- La respuesta solo lleva `{ puesto, nombre, racha, esTuyo }`: ni ids ni asistencias al navegador.
- Sin cambios en `firestore.rules` ni `firestore.indexes.json`.
- `functions/` y `web/` son proyectos npm separados: no se importan entre sí; los tipos se declaran en ambos.
- En `web/`, `acciones.ts` es el único archivo que llama a `httpsCallable`.
- La fecha de hoy en el servidor sale de `hoyEnMazatlan()` (`functions/src/comun.ts`), nunca del navegador.
- Todo nombre se pinta con `escapar()` (`web/src/ui/tarjetaDia.ts`).
- Estilo del repo: identificadores y comentarios en español; en `functions/` los comentarios van sin acentos (como el resto de ese proyecto); las copias duplicadas llevan comentario `GEMELO`.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Cliente sin ninguna asistencia → aparece con racha 0 en ambas listas, al fondo (test en Task 2).
- Dos documentos de asistencia con la misma fecha (uno asistido y otro no) → la fecha cuenta una sola vez y no rompe ni duplica la racha (test en Task 1).
- Asistencias cuyo `clienteId` ya no existe en `clientes` (cliente borrado) → se ignoran, no crean filas fantasma (test en Task 2).
- Cliente con `nombre` ausente o no string → aparece como "Sin nombre" en vez de tronar el ordenamiento (test en Task 2).
- Nombre con `<`, `&` o comillas → se pinta escapado, no como HTML (test en Task 3).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `functions/src/rachas.ts` | Crear | Cálculo puro de racha actual y más larga (gemelo de `RachaCalculator`). |
| `functions/src/rachas.test.ts` | Crear | Pruebas del cálculo. |
| `functions/src/ranking.ts` | Crear | `armarRanking` (puro) y la callable `obtenerRanking`. |
| `functions/src/ranking.test.ts` | Crear | Pruebas de `armarRanking`. |
| `functions/src/index.ts` | Modificar | Exportar `obtenerRanking`. |
| `web/src/datos.ts` | Modificar | Tipos `FilaRanking` y `Ranking`. |
| `web/src/acciones.ts` | Modificar | `obtenerRanking` callable. |
| `web/src/ui/tarjetaRanking.ts` | Crear | Tarjeta pura + estado de pestaña + `conectarRanking`. |
| `web/src/ui/tarjetaRanking.test.ts` | Crear | Pruebas de la tarjeta. |
| `web/src/estilos.css` | Modificar | Estilos del segmentado y filas. |
| `web/src/ventanas.ts` | Modificar | `ranking` en `DatosCliente`, ventana con `pintar`. |
| `web/src/ventanas.test.ts` | Modificar | Reflejar que Ranking ya no es "próximamente". |
| `web/src/main.ts` | Modificar | Estado del ranking, carga al entrar a la ventana, conexión de clics. |

---

### Task 1: Cálculo de rachas en el servidor

**Files:**
- Create: `functions/src/rachas.ts`
- Test: `functions/src/rachas.test.ts`

**Interfaces:**
- Consumes: `AsistenciaParaRacha` de `functions/src/faltaRompio.ts` (`{ fecha: string; asistio: boolean; justificada: boolean }`).
- Produces:
  - `fechasQueCuentan(asistencias: AsistenciaParaRacha[]): Set<string>`
  - `rachaActual(cuentan: Set<string>, hoy: string): number`
  - `rachaMasLarga(cuentan: Set<string>): number`

- [ ] **Step 1: Write the failing test**

`functions/src/rachas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fechasQueCuentan, rachaActual, rachaMasLarga } from "./rachas";

const vino = (fecha: string) => ({ fecha, asistio: true, justificada: false });
const falto = (fecha: string) => ({ fecha, asistio: false, justificada: false });
const justificada = (fecha: string) => ({ fecha, asistio: false, justificada: true });

const cuentan = (...a: { fecha: string; asistio: boolean; justificada: boolean }[]) =>
  fechasQueCuentan(a);

describe("fechasQueCuentan", () => {
  it("toma asistidas y justificadas, no las faltas", () => {
    expect([...cuentan(vino("2026-09-08"), justificada("2026-09-09"), falto("2026-09-10"))].sort())
      .toEqual(["2026-09-08", "2026-09-09"]);
  });

  // Review Focus: dos documentos del mismo dia no duplican ni rompen.
  it("una fecha repetida cuenta una sola vez aunque uno de los registros sea falta", () => {
    const set = cuentan(vino("2026-09-08"), falto("2026-09-08"), vino("2026-09-08"));
    expect([...set]).toEqual(["2026-09-08"]);
  });
});

describe("rachaActual", () => {
  // 2026-09-08 martes, 09 miercoles, 10 jueves, 11 viernes, 14 lunes
  it("cuenta dias habiles seguidos", () => {
    expect(rachaActual(cuentan(vino("2026-09-08"), vino("2026-09-09"), vino("2026-09-10")), "2026-09-10")).toBe(3);
  });

  it("una falta corta la racha", () => {
    expect(rachaActual(cuentan(vino("2026-09-08"), vino("2026-09-10")), "2026-09-10")).toBe(1);
  });

  it("una justificada mantiene la racha", () => {
    expect(rachaActual(cuentan(vino("2026-09-08"), justificada("2026-09-09"), vino("2026-09-10")), "2026-09-10")).toBe(3);
  });

  it("el fin de semana ni suma ni corta", () => {
    expect(rachaActual(cuentan(vino("2026-09-11"), vino("2026-09-14")), "2026-09-14")).toBe(2);
  });

  it("hoy habil sin registro todavia no corta (dia de gracia)", () => {
    expect(rachaActual(cuentan(vino("2026-09-08"), vino("2026-09-09")), "2026-09-10")).toBe(2);
  });

  it("sin fechas es 0", () => {
    expect(rachaActual(new Set(), "2026-09-10")).toBe(0);
  });
});

describe("rachaMasLarga", () => {
  it("encuentra la corrida mas larga aunque no sea la ultima", () => {
    const set = cuentan(
      vino("2026-09-01"), vino("2026-09-02"), vino("2026-09-03"), vino("2026-09-04"), // mar-vie: 4
      vino("2026-09-08"), vino("2026-09-09") // falta el lunes 07: corrida de 2
    );
    expect(rachaMasLarga(set)).toBe(4);
  });

  it("el fin de semana no corta la corrida", () => {
    expect(rachaMasLarga(cuentan(vino("2026-09-10"), vino("2026-09-11"), vino("2026-09-14")))).toBe(3);
  });

  it("las justificadas cuentan", () => {
    expect(rachaMasLarga(cuentan(vino("2026-09-08"), justificada("2026-09-09"), vino("2026-09-10")))).toBe(3);
  });

  it("sin fechas es 0", () => {
    expect(rachaMasLarga(new Set())).toBe(0);
  });

  it("nunca es menor que la actual para el mismo historial", () => {
    const set = cuentan(vino("2026-09-08"), vino("2026-09-09"), vino("2026-09-10"));
    expect(rachaMasLarga(set)).toBeGreaterThanOrEqual(rachaActual(set, "2026-09-10"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/rachas.test.ts`
Expected: FAIL, `Failed to resolve import "./rachas"`.

- [ ] **Step 3: Write minimal implementation**

`functions/src/rachas.ts`:

```ts
import type { AsistenciaParaRacha } from "./faltaRompio";

/**
 * Racha actual y racha mas larga de un cliente, para el ranking.
 *
 * GEMELO: `RachaCalculator` en Kotlin (`calcularRachaActual` y `calcularRachaMasLarga`) y
 * `rachaActual` en `web/src/racha.ts`. Si cambia la regla en uno, cambia en los demas. Se
 * duplica porque `functions/` y `web/` son proyectos npm separados y el ranking lo calcula el
 * servidor: la pagina solo puede leer sus propias asistencias.
 *
 * Las fechas son strings ISO pasadas por un Date al mediodia UTC solo para mover dias, igual
 * que en `faltaRompio.ts`: el mediodia evita que un corrimiento de zona cambie el dia.
 */

function esDiaHabil(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return dia !== 0 && dia !== 6;
}

function moverDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Las justificadas ("soborno") valen igual que una asistencia para la racha. */
export function fechasQueCuentan(asistencias: AsistenciaParaRacha[]): Set<string> {
  return new Set(asistencias.filter((a) => a.asistio || a.justificada).map((a) => a.fecha));
}

export function rachaActual(cuentan: Set<string>, hoy: string): number {
  let fecha = hoy;
  // Dia de gracia: si hoy es habil y todavia no hay registro, no corta la racha.
  if (esDiaHabil(fecha) && !cuentan.has(fecha)) fecha = moverDias(fecha, -1);

  let racha = 0;
  // Tope de seguridad, igual que en la web: un dato raro no debe colgar la funcion.
  for (let i = 0; i < 3650; i++) {
    if (esDiaHabil(fecha)) {
      if (!cuentan.has(fecha)) break;
      racha++;
    }
    fecha = moverDias(fecha, -1);
  }
  return racha;
}

/** La corrida mas larga de dias habiles contados, del primer al ultimo registro. */
export function rachaMasLarga(cuentan: Set<string>): number {
  if (cuentan.size === 0) return 0;
  const fechas = [...cuentan].sort();
  const fin = fechas[fechas.length - 1];
  let mejor = 0;
  let actual = 0;
  for (let fecha = fechas[0]; fecha <= fin; fecha = moverDias(fecha, 1)) {
    if (!esDiaHabil(fecha)) continue;
    if (cuentan.has(fecha)) {
      actual++;
      if (actual > mejor) mejor = actual;
    } else {
      actual = 0;
    }
  }
  return mejor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/rachas.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/rachas.ts functions/src/rachas.test.ts
git commit -m "feat(functions): calculo de racha actual y mas larga para el ranking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `armarRanking` y la callable `obtenerRanking`

**Files:**
- Create: `functions/src/ranking.ts`
- Test: `functions/src/ranking.test.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `fechasQueCuentan`, `rachaActual`, `rachaMasLarga` de `./rachas` (Task 1); `REGION`, `clienteDeLaSesion`, `db`, `hoyEnMazatlan` de `./comun`.
- Produces:
  - `interface FilaRanking { puesto: number; nombre: string; racha: number; esTuyo: boolean }`
  - `interface Ranking { actual: FilaRanking[]; historica: FilaRanking[] }`
  - `interface ClienteParaRanking { id: string; nombre: string; activo: boolean }`
  - `interface AsistenciaParaRanking { clienteId: string; fecha: string; asistio: boolean; justificada: boolean }`
  - `armarRanking(clientes: ClienteParaRanking[], asistencias: AsistenciaParaRanking[], clienteId: string, hoy: string): Ranking`
  - callable `obtenerRanking` (sin argumentos) → `Ranking`, exportada en `index.ts`.

- [ ] **Step 1: Write the failing test**

`functions/src/ranking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { armarRanking, type AsistenciaParaRanking, type ClienteParaRanking } from "./ranking";

const HOY = "2026-09-10"; // jueves

const cliente = (id: string, nombre: string, activo = true): ClienteParaRanking => ({ id, nombre, activo });

/** `dias` dias habiles seguidos terminando ayer (miercoles 09), asi la racha actual es `dias`. */
function racha(clienteId: string, dias: number): AsistenciaParaRanking[] {
  const habiles = ["2026-09-09", "2026-09-08", "2026-09-07", "2026-09-04", "2026-09-03", "2026-09-02", "2026-09-01"];
  return habiles.slice(0, dias).map((fecha) => ({ clienteId, fecha, asistio: true, justificada: false }));
}

describe("armarRanking", () => {
  it("ordena por racha descendente", () => {
    const r = armarRanking(
      [cliente("a", "Ana"), cliente("b", "Beto"), cliente("c", "Carla")],
      [...racha("a", 2), ...racha("b", 5), ...racha("c", 3)],
      "a",
      HOY
    );
    expect(r.actual.map((f) => [f.puesto, f.nombre, f.racha])).toEqual([
      [1, "Beto", 5],
      [2, "Carla", 3],
      [3, "Ana", 2],
    ]);
  });

  it("los empates comparten puesto y van en orden alfabetico", () => {
    const r = armarRanking(
      [cliente("z", "Zoe"), cliente("a", "Ana"), cliente("m", "Mario")],
      [...racha("z", 3), ...racha("a", 3), ...racha("m", 1)],
      "m",
      HOY
    );
    expect(r.actual.map((f) => [f.puesto, f.nombre])).toEqual([
      [1, "Ana"],
      [1, "Zoe"],
      [3, "Mario"],
    ]);
  });

  it("los inactivos quedan fuera de la actual y dentro de la historica", () => {
    const r = armarRanking(
      [cliente("a", "Ana"), cliente("x", "Xime", false)],
      [...racha("a", 1), ...racha("x", 4)],
      "a",
      HOY
    );
    expect(r.actual.map((f) => f.nombre)).toEqual(["Ana"]);
    expect(r.historica.map((f) => [f.puesto, f.nombre, f.racha])).toEqual([
      [1, "Xime", 4],
      [2, "Ana", 1],
    ]);
  });

  it("la historica usa la corrida mas larga, no la actual", () => {
    const asistencias: AsistenciaParaRanking[] = [
      // mar 01 a vie 04: 4 seguidos; falta lun 07; mie 09: 1
      ...["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-09"].map((fecha) => ({
        clienteId: "a", fecha, asistio: true, justificada: false,
      })),
    ];
    const r = armarRanking([cliente("a", "Ana")], asistencias, "a", HOY);
    expect(r.actual[0].racha).toBe(1); // mie 09 cuenta; el martes 08 falta y corta
    expect(r.historica[0].racha).toBe(4);
  });

  it("marca solo la fila de quien pide", () => {
    const r = armarRanking([cliente("a", "Ana"), cliente("b", "Beto")], [...racha("a", 1), ...racha("b", 2)], "a", HOY);
    expect(r.actual.filter((f) => f.esTuyo).map((f) => f.nombre)).toEqual(["Ana"]);
    expect(r.historica.filter((f) => f.esTuyo).map((f) => f.nombre)).toEqual(["Ana"]);
  });

  // Review Focus: sin asistencias aparece con 0, al fondo.
  it("un cliente sin asistencias aparece con racha 0 al fondo", () => {
    const r = armarRanking([cliente("n", "Nuevo"), cliente("a", "Ana")], racha("a", 2), "n", HOY);
    expect(r.actual.map((f) => [f.puesto, f.nombre, f.racha])).toEqual([
      [1, "Ana", 2],
      [2, "Nuevo", 0],
    ]);
    expect(r.historica.at(-1)).toEqual({ puesto: 2, nombre: "Nuevo", racha: 0, esTuyo: true });
  });

  // Review Focus: asistencias de un cliente borrado no crean filas.
  it("ignora asistencias de clientes que ya no existen", () => {
    const r = armarRanking([cliente("a", "Ana")], [...racha("a", 1), ...racha("borrado", 5)], "a", HOY);
    expect(r.historica.map((f) => f.nombre)).toEqual(["Ana"]);
  });

  it("sin clientes devuelve listas vacias", () => {
    expect(armarRanking([], [], "a", HOY)).toEqual({ actual: [], historica: [] });
  });

  it("las filas solo llevan puesto, nombre, racha y esTuyo", () => {
    const r = armarRanking([cliente("a", "Ana")], racha("a", 1), "a", HOY);
    expect(Object.keys(r.actual[0]).sort()).toEqual(["esTuyo", "nombre", "puesto", "racha"]);
  });
});
```

Y en el mismo archivo, para la normalización de documentos de Firestore (Review Focus: nombre ausente):

```ts
import { clienteDesdeDoc, asistenciaDesdeDoc } from "./ranking";

describe("normalizacion de documentos", () => {
  it("un cliente sin nombre queda como 'Sin nombre' y sin activo cuenta como inactivo", () => {
    expect(clienteDesdeDoc("a", {})).toEqual({ id: "a", nombre: "Sin nombre", activo: false });
    expect(clienteDesdeDoc("b", { nombre: 42, activo: "si" })).toEqual({ id: "b", nombre: "Sin nombre", activo: false });
    expect(clienteDesdeDoc("c", { nombre: "Caro", activo: true })).toEqual({ id: "c", nombre: "Caro", activo: true });
  });

  it("una asistencia sin fecha o sin clienteId se descarta", () => {
    expect(asistenciaDesdeDoc({ clienteId: "a", asistio: true })).toBeNull();
    expect(asistenciaDesdeDoc({ fecha: "2026-09-08", asistio: true })).toBeNull();
    expect(asistenciaDesdeDoc({ clienteId: "a", fecha: "2026-09-08", asistio: true })).toEqual({
      clienteId: "a", fecha: "2026-09-08", asistio: true, justificada: false,
    });
  });
});
```

(Poner el `import` junto al primero, arriba del archivo.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/ranking.test.ts`
Expected: FAIL, `Failed to resolve import "./ranking"`.

- [ ] **Step 3: Write minimal implementation**

`functions/src/ranking.ts`:

```ts
import { onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { fechasQueCuentan, rachaActual, rachaMasLarga } from "./rachas";

/**
 * El ranking de rachas que ve la web del cliente. Ver
 * `docs/superpowers/specs/2026-09-24-ranking-rachas-design.md`.
 *
 * Lo calcula el servidor porque las reglas solo dejan que cada cliente lea sus propias
 * asistencias, y abrirlas para esto expondria el historial completo de los demas. Aca se lee
 * todo con el Admin SDK y al navegador solo viaja lo que se pinta.
 */

export interface FilaRanking {
  puesto: number;
  nombre: string;
  racha: number;
  esTuyo: boolean;
}

export interface Ranking {
  /** Solo clientes activos. */
  actual: FilaRanking[];
  /** Todos, activos e inactivos: el salon de la fama. */
  historica: FilaRanking[];
}

export interface ClienteParaRanking {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface AsistenciaParaRanking {
  clienteId: string;
  fecha: string;
  asistio: boolean;
  justificada: boolean;
}

/** `activo` ausente o de tipo raro cuenta como inactivo: sale de la actual, sigue en la historica. */
export function clienteDesdeDoc(id: string, datos: Record<string, unknown>): ClienteParaRanking {
  const nombre = typeof datos.nombre === "string" && datos.nombre.trim() !== "" ? datos.nombre : "Sin nombre";
  return { id, nombre, activo: datos.activo === true };
}

export function asistenciaDesdeDoc(datos: Record<string, unknown>): AsistenciaParaRanking | null {
  if (typeof datos.clienteId !== "string" || typeof datos.fecha !== "string") return null;
  return {
    clienteId: datos.clienteId,
    fecha: datos.fecha,
    asistio: datos.asistio === true,
    justificada: datos.justificada === true,
  };
}

/**
 * Racha descendente y, dentro de un empate, alfabetico para que la lista no baile entre
 * aperturas. Los empates comparten puesto, igual que `calcularRanking` en Kotlin:
 * 10, 10, 8 -> 1, 1, 3.
 */
function ordenar(filas: Omit<FilaRanking, "puesto">[]): FilaRanking[] {
  const ordenadas = [...filas].sort((a, b) => b.racha - a.racha || a.nombre.localeCompare(b.nombre, "es"));
  let puesto = 0;
  return ordenadas.map((f, i) => {
    if (i === 0 || f.racha !== ordenadas[i - 1].racha) puesto = i + 1;
    return { puesto, nombre: f.nombre, racha: f.racha, esTuyo: f.esTuyo };
  });
}

export function armarRanking(
  clientes: ClienteParaRanking[],
  asistencias: AsistenciaParaRanking[],
  clienteId: string,
  hoy: string
): Ranking {
  const porCliente = new Map<string, AsistenciaParaRanking[]>();
  for (const a of asistencias) {
    const lista = porCliente.get(a.clienteId);
    if (lista) lista.push(a);
    else porCliente.set(a.clienteId, [a]);
  }

  const actual: Omit<FilaRanking, "puesto">[] = [];
  const historica: Omit<FilaRanking, "puesto">[] = [];
  for (const c of clientes) {
    const cuentan = fechasQueCuentan(porCliente.get(c.id) ?? []);
    const esTuyo = c.id === clienteId;
    if (c.activo) actual.push({ nombre: c.nombre, racha: rachaActual(cuentan, hoy), esTuyo });
    historica.push({ nombre: c.nombre, racha: rachaMasLarga(cuentan), esTuyo });
  }
  return { actual: ordenar(actual), historica: ordenar(historica) };
}

/**
 * Solo lectura: no escribe nada. Se piden las dos colecciones completas una vez cada una; para
 * un gimnasio son pocas lecturas. Si algun dia pesa, la mejora es cachear el resultado unos
 * minutos (ver el spec).
 */
export const obtenerRanking = onCall({ region: REGION }, async (request): Promise<Ranking> => {
  const clienteId = clienteDeLaSesion(request);
  const firestore = db();
  const [clientesSnap, asistenciasSnap] = await Promise.all([
    firestore.collection("clientes").get(),
    firestore.collection("asistencias").get(),
  ]);
  const clientes = clientesSnap.docs.map((d) => clienteDesdeDoc(d.id, d.data()));
  const asistencias = asistenciasSnap.docs
    .map((d) => asistenciaDesdeDoc(d.data()))
    .filter((a): a is AsistenciaParaRanking => a !== null);
  return armarRanking(clientes, asistencias, clienteId, hoyEnMazatlan());
});
```

En `functions/src/index.ts`, agregar al final:

```ts
export { obtenerRanking } from "./ranking";
```

- [ ] **Step 4: Run tests and build**

Run: `cd functions && npx vitest run && npm run build`
Expected: toda la suite PASS (incluidas las 11 nuevas de `ranking.test.ts`) y `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add functions/src/ranking.ts functions/src/ranking.test.ts functions/src/index.ts
git commit -m "feat(functions): callable obtenerRanking con racha actual e historica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tarjeta del ranking en la web

**Files:**
- Modify: `web/src/datos.ts` (al final del archivo)
- Modify: `web/src/acciones.ts`
- Create: `web/src/ui/tarjetaRanking.ts`
- Test: `web/src/ui/tarjetaRanking.test.ts`
- Modify: `web/src/estilos.css` (al final del archivo)

**Interfaces:**
- Consumes: `escapar` de `./tarjetaDia`; la forma `Ranking` que devuelve la callable de Task 2.
- Produces:
  - En `datos.ts`: `interface FilaRanking { puesto: number; nombre: string; racha: number; esTuyo: boolean }`, `interface Ranking { actual: FilaRanking[]; historica: FilaRanking[] }`.
  - En `acciones.ts`: `obtenerRanking: HttpsCallable<Record<string, never>, Ranking>`.
  - En `tarjetaRanking.ts`:
    - `type EstadoRanking = { estado: "cargando" } | { estado: "listo"; datos: Ranking } | { estado: "error" }`
    - `type PestanaRanking = "actual" | "historica"`
    - `tarjetaRanking(estado: EstadoRanking, pestana?: PestanaRanking): string` (sin `pestana` usa la elegida en el módulo)
    - `conectarRanking(repintar: () => void, reintentar: () => void): void`
    - `elegirPestanaRanking(p: PestanaRanking): void` (exportada para pruebas y para `conectarRanking`)

- [ ] **Step 1: Write the failing test**

`web/src/ui/tarjetaRanking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FilaRanking, Ranking } from "../datos";
import { tarjetaRanking, type EstadoRanking } from "./tarjetaRanking";

const fila = (puesto: number, nombre: string, racha: number, esTuyo = false): FilaRanking =>
  ({ puesto, nombre, racha, esTuyo });

const datos: Ranking = {
  actual: [fila(1, "Ana", 23), fila(2, "Carlos", 18), fila(2, "Diana", 18), fila(4, "María", 12, true), fila(5, "Pepe", 0)],
  historica: [fila(1, "Xime", 40), fila(2, "María", 30, true)],
};
const listo: EstadoRanking = { estado: "listo", datos };

/** Lo que dice cada fila, en orden: [puesto o medalla, nombre, racha]. */
function filas(html: string): string[][] {
  return [...html.matchAll(
    /class="ranking-puesto">([^<]*)<\/span>\s*<span class="ranking-nombre">([^<]*)<\/span>\s*<span class="ranking-racha">🔥 (\d+)</g
  )].map((m) => [m[1], m[2], m[3]]);
}

describe("tarjetaRanking", () => {
  it("pinta la actual con medallas por puesto y numero desde el 4", () => {
    expect(filas(tarjetaRanking(listo, "actual"))).toEqual([
      ["🥇", "Ana", "23"],
      ["🥈", "Carlos", "18"],
      ["🥈", "Diana", "18"],
      ["4", "Tú · María", "12"],
      ["5", "Pepe", "0"],
    ]);
  });

  it("pinta la historica cuando esa es la pestana", () => {
    expect(filas(tarjetaRanking(listo, "historica"))).toEqual([
      ["🥇", "Xime", "40"],
      ["🥈", "Tú · María", "30"],
    ]);
  });

  it("marca la pestana activa en el segmentado", () => {
    const html = tarjetaRanking(listo, "historica");
    expect(html).toMatch(/class="segmento activo" data-pestana="historica" aria-selected="true"/);
    expect(html).toMatch(/class="segmento" data-pestana="actual" aria-selected="false"/);
  });

  it("resalta solo la fila propia", () => {
    const html = tarjetaRanking(listo, "actual");
    expect(html.match(/ranking-fila tuya/g)?.length).toBe(1);
  });

  it("cargando muestra el esqueleto y el segmentado", () => {
    const html = tarjetaRanking({ estado: "cargando" }, "actual");
    expect(html).toContain("ranking-esqueleto");
    expect(html).toContain(`data-pestana="actual"`);
  });

  it("error muestra el mensaje y el boton de reintentar", () => {
    const html = tarjetaRanking({ estado: "error" }, "actual");
    expect(html).toContain("No pudimos cargar el ranking");
    expect(html).toContain(`id="ranking-reintentar"`);
  });

  it("una lista vacia muestra el estado vacio", () => {
    const html = tarjetaRanking({ estado: "listo", datos: { actual: [], historica: [] } }, "actual");
    expect(html).toContain("Todavía no hay rachas");
    expect(filas(html)).toEqual([]);
  });

  // Review Focus: nombres con HTML se escapan.
  it("escapa los nombres", () => {
    const html = tarjetaRanking(
      { estado: "listo", datos: { actual: [fila(1, `<b>Ana</b> & "Co"`, 3)], historica: [] } },
      "actual"
    );
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Co&quot;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/tarjetaRanking.test.ts`
Expected: FAIL, `Failed to resolve import "./tarjetaRanking"`.

- [ ] **Step 3: Write minimal implementation**

Al final de `web/src/datos.ts`:

```ts
/**
 * Lo que devuelve la función `obtenerRanking`. GEMELO de los tipos de
 * `functions/src/ranking.ts`: son proyectos npm separados y no se importan entre sí.
 */
export interface FilaRanking {
  puesto: number;
  nombre: string;
  racha: number;
  esTuyo: boolean;
}

export interface Ranking {
  /** Solo clientes activos. */
  actual: FilaRanking[];
  /** Todos, activos e inactivos. */
  historica: FilaRanking[];
}
```

En `web/src/acciones.ts`:
1. Agregar `import type { Ranking } from "./datos";` debajo de los imports actuales.
2. Cambiar el comentario de cabecera: donde dice `Las cuatro escrituras que puede hacer el cliente.` poner `Las llamadas a funciones que puede hacer el cliente: cuatro escrituras y la lectura del ranking.`
3. Agregar al final:

```ts
/**
 * El ranking de rachas. Es una lectura, pero pasa por una función porque necesita las
 * asistencias de todos, y las reglas solo le dejan al cliente leer las suyas.
 */
export const obtenerRanking = httpsCallable<Record<string, never>, Ranking>(
  functions,
  "obtenerRanking"
);
```

`web/src/ui/tarjetaRanking.ts`:

```ts
import type { FilaRanking, Ranking } from "../datos";
import { escapar } from "./tarjetaDia";

/**
 * La ventana Ranking: el top de rachas, actual e histórica. Ver
 * `docs/superpowers/specs/2026-09-24-ranking-rachas-design.md`.
 */

export type EstadoRanking =
  | { estado: "cargando" }
  | { estado: "listo"; datos: Ranking }
  | { estado: "error" };

export type PestanaRanking = "actual" | "historica";

/**
 * La pestaña elegida vive en el módulo y no en el DOM, por lo mismo que el estado de
 * `accionDia`: `pintar()` rehace `#contenido` en cada snapshot de Firestore, y la clienta que
 * está mirando la histórica no debe volver a la actual porque el entrenador marcó una
 * asistencia.
 */
let pestanaElegida: PestanaRanking = "actual";

export function elegirPestanaRanking(p: PestanaRanking): void {
  pestanaElegida = p;
}

const MEDALLAS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function segmentado(activa: PestanaRanking): string {
  const boton = (id: PestanaRanking, texto: string) => {
    const on = id === activa;
    return `<button class="segmento${on ? " activo" : ""}" data-pestana="${id}" aria-selected="${on}" role="tab">${texto}</button>`;
  };
  return `<div class="segmentos" role="tablist">${boton("actual", "Racha actual")}${boton("historica", "Histórica")}</div>`;
}

/** Por puesto y no por posición en la lista: un empate en el 2 comparte la de plata. */
function fila(f: FilaRanking): string {
  const nombre = f.esTuyo ? `Tú · ${escapar(f.nombre)}` : escapar(f.nombre);
  return `
      <li class="ranking-fila${f.esTuyo ? " tuya" : ""}">
        <span class="ranking-puesto">${MEDALLAS[f.puesto] ?? f.puesto}</span>
        <span class="ranking-nombre">${nombre}</span>
        <span class="ranking-racha">🔥 ${f.racha}</span>
      </li>`;
}

function cuerpo(estado: EstadoRanking, pestana: PestanaRanking): string {
  if (estado.estado === "cargando") {
    return `<div class="ranking-esqueleto">${"<div></div>".repeat(5)}</div>`;
  }
  if (estado.estado === "error") {
    return `
      <div class="vacio" style="padding: 14px 8px">
        <div class="vacio-emoji">📡</div>
        <p><strong>No pudimos cargar el ranking</strong></p>
        <button class="boton" id="ranking-reintentar">Reintentar</button>
      </div>`;
  }
  const lista = pestana === "actual" ? estado.datos.actual : estado.datos.historica;
  if (lista.length === 0) {
    return `
      <div class="vacio" style="padding: 14px 8px">
        <div class="vacio-emoji">🏆</div>
        <p><strong>Todavía no hay rachas</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">Aparecerán en cuanto haya asistencias.</p>
      </div>`;
  }
  return `<ol class="ranking-lista">${lista.map(fila).join("")}</ol>`;
}

export function tarjetaRanking(estado: EstadoRanking, pestana: PestanaRanking = pestanaElegida): string {
  return `
    <div class="tarjeta ranking">
      ${segmentado(pestana)}
      ${cuerpo(estado, pestana)}
    </div>`;
}

/**
 * Se vuelve a colgar en cada repintado: `innerHTML` tira los listeners junto con los nodos.
 * Cambiar de pestaña no llama a la función: las dos listas ya llegaron juntas.
 */
export function conectarRanking(repintar: () => void, reintentar: () => void): void {
  document.querySelectorAll<HTMLElement>(".ranking [data-pestana]").forEach((b) => {
    b.addEventListener("click", () => {
      elegirPestanaRanking(b.dataset.pestana === "historica" ? "historica" : "actual");
      repintar();
    });
  });
  document.querySelector("#ranking-reintentar")?.addEventListener("click", reintentar);
}
```

Al final de `web/src/estilos.css`:

```css
/* Ranking de rachas. El segmentado y la fila propia usan la paleta de la clienta; lo demás,
   las superficies neutras de siempre. */
.segmentos {
  display: flex; gap: 4px; padding: 4px; margin-bottom: 12px;
  background: var(--superficie-alta); border-radius: 12px;
}
.segmento {
  flex: 1; border: 0; border-radius: 9px; padding: 8px 6px;
  background: transparent; color: var(--texto-tenue);
  font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
}
.segmento.activo { background: var(--primario); color: var(--sobre-primario); }
.ranking-lista { list-style: none; margin: 0; padding: 0; }
.ranking-fila {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 8px; border-radius: 10px;
}
.ranking-fila + .ranking-fila { margin-top: 2px; }
.ranking-fila.tuya { background: var(--primario-oscuro); color: #fff; font-weight: 600; }
.ranking-puesto { width: 28px; text-align: center; font-variant-numeric: tabular-nums; color: var(--texto-tenue); }
.ranking-fila.tuya .ranking-puesto { color: inherit; }
.ranking-nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ranking-racha { font-variant-numeric: tabular-nums; white-space: nowrap; }
.ranking-esqueleto div {
  height: 40px; border-radius: 10px; background: var(--superficie-alta);
}
.ranking-esqueleto div + div { margin-top: 6px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/ui/tarjetaRanking.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/datos.ts web/src/acciones.ts web/src/ui/tarjetaRanking.ts web/src/ui/tarjetaRanking.test.ts web/src/estilos.css
git commit -m "feat(web): tarjeta del ranking de rachas con segmentado actual/historica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Conectar la ventana Ranking

**Files:**
- Modify: `web/src/ventanas.ts`
- Modify: `web/src/ventanas.test.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: `tarjetaRanking`, `conectarRanking`, `EstadoRanking` de `./ui/tarjetaRanking` (Task 3); `obtenerRanking` de `./acciones` (Task 3).
- Produces: `DatosCliente.ranking: EstadoRanking`; la ventana `ranking` sin `proximamente` y con `pintar`.

- [ ] **Step 1: Update the tests (failing)**

En `web/src/ventanas.test.ts`:

1. En la función `datos()`, agregar `ranking: { estado: "cargando" },` a los campos por defecto:

```ts
function datos(campos: Partial<DatosCliente> = {}): DatosCliente {
  return {
    cliente, hoy: HOY, asistencias: conFaltaRota, mesVisible: "2026-09", yaAviso: false,
    medallas: [], logros: [], tiradaEsteMes: null, tiradaMesAnterior: null,
    ranking: { estado: "cargando" }, ...campos,
  };
}
```

2. Reemplazar el test `"Ranking y Ajustes son las que están por venir"` por:

```ts
  it("Ajustes es la única que está por venir", () => {
    expect(VENTANAS.filter((v) => v.proximamente).map((v) => v.id)).toEqual(["ajustes"]);
  });
```

3. Reemplazar el test `"las que están por venir dicen Muy pronto"` por:

```ts
  it("Ajustes dice Muy pronto", () => {
    expect(contenidoDe(ventana("ajustes"), datos())).toContain("Muy pronto");
  });

  it("Ranking pinta la tarjeta del ranking con lo que haya llegado", () => {
    const html = contenidoDe(ventana("ranking"), datos({
      ranking: { estado: "listo", datos: { actual: [{ puesto: 1, nombre: "Ana", racha: 5, esTuyo: true }], historica: [] } },
    }));
    expect(html).not.toContain("Muy pronto");
    expect(html).toContain("Tú · Ana");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ventanas.test.ts`
Expected: FAIL: "Ajustes es la única que está por venir" (recibe `["ranking","ajustes"]`) y "Ranking pinta la tarjeta" (contiene "Muy pronto").

- [ ] **Step 3: Implement in `ventanas.ts`**

1. Agregar el import: `import { tarjetaRanking, type EstadoRanking } from "./ui/tarjetaRanking";`
2. En `interface DatosCliente`, agregar al final: 

```ts
  /** Lo último que devolvió `obtenerRanking`; lo carga `main.ts` al entrar a la ventana. */
  ranking: EstadoRanking;
```

3. Reemplazar la entrada de ranking en `VENTANAS`:

```ts
  {
    id: "ranking", titulo: "Ranking", icono: "🏆", grupo: "principal",
    pintar: (d) => tarjetaRanking(d.ranking),
  },
```

- [ ] **Step 4: Implement in `main.ts`**

1. Imports: agregar `import { obtenerRanking } from "./acciones";` y `import { conectarRanking, type EstadoRanking } from "./ui/tarjetaRanking";`.

2. Junto a las demás variables de estado en `arrancar()` (después de `let tiradaMesAnterior: Tirada | null = null;`):

```ts
  let ranking: EstadoRanking = { estado: "cargando" };
  /** Número del último pedido: una respuesta de un pedido viejo no pisa a la más nueva. */
  let pedidoRanking = 0;

  /**
   * Pide el ranking cada vez que se entra a la ventana: no hay listener que lo mantenga al día,
   * así que entrar es refrescar. Si ya había datos se siguen mostrando mientras llega la
   * respuesta, y si el refresco falla también se quedan: una lista de hace un rato sirve más
   * que una pantalla de error. No repinta al arrancar: quien lo llama ya está pintando.
   */
  function cargarRanking(): void {
    const pedido = ++pedidoRanking;
    if (ranking.estado === "error") ranking = { estado: "cargando" };
    obtenerRanking({}).then(
      (r) => {
        if (pedido !== pedidoRanking) return;
        ranking = { estado: "listo", datos: r.data };
        pintar();
      },
      () => {
        if (pedido !== pedidoRanking) return;
        if (ranking.estado !== "listo") ranking = { estado: "error" };
        pintar();
      }
    );
  }
```

3. En `pintar()`, justo después de `const activa = ventana(ventanaActiva());`, agregar:

```ts
    // Al entrar a Ranking se pide antes de pintar, así un error viejo ya sale como "cargando".
    if (activa.id === "ranking" && activa.id !== ventanaPintada) cargarRanking();
```

4. En `pintar()`, en la llamada a `contenidoDe`, agregar `ranking` al objeto:

```ts
    contenido.innerHTML = contenidoDe(activa, {
      cliente, hoy, asistencias, mesVisible, yaAviso, medallas, logros,
      tiradaEsteMes, tiradaMesAnterior, ranking,
    });
```

5. En `pintar()`, justo antes de `if (activa.id !== "inicio") return;`, agregar:

```ts
    if (activa.id === "ranking") {
      conectarRanking(pintar, () => {
        cargarRanking();
        pintar();
      });
      return;
    }
```

- [ ] **Step 5: Run full web suite and build**

Run: `cd web && npx vitest run && npm run build`
Expected: toda la suite PASS y `tsc && vite build` sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/ventanas.ts web/src/ventanas.test.ts web/src/main.ts
git commit -m "feat(web): la ventana Ranking carga y pinta el top de rachas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Verificación manual y despliegue (con confirmación)

**Files:** ninguno.

- [ ] **Step 1: Verificar ambas suites y builds**

Run: `cd functions && npx vitest run && npm run build` y `cd web && npx vitest run && npm run build`
Expected: todo PASS, sin errores de compilación.

- [ ] **Step 2: Pedir confirmación al usuario antes de desplegar**

Desplegar publica cambios en producción: no se hace sin un "sí" explícito. Orden obligatorio (la función antes que la web):

```bash
firebase deploy --only functions:obtenerRanking
firebase deploy --only hosting
```

- [ ] **Step 3: Prueba manual en el teléfono o navegador**

Con un link de cliente real: abrir el menú → Ranking. Comprobar: se ve "cargando" y luego la lista; la fila propia resaltada con el color de su paleta; el segmentado cambia a Histórica sin volver a cargar; salir y volver a entrar refresca; empates comparten medalla.
