# Ruleta para revivir la racha — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando el cliente se queda sin revives y tiene la racha rota, ofrecerle una ruleta de dos colores: si acierta se le revive la racha, si falla el mes siguiente tendrá 2 revives en vez de 3.

**Architecture:** El sorteo vive **solo** en la Cloud Function `jugarRuleta`, que valida todo de nuevo del lado del servidor y escribe un único documento `ruletas/{clienteId}_{AAAA-MM}`. Ese documento responde las dos preguntas del sistema: *¿ya jugó este mes?* (existe el de este mes) y *¿está castigado?* (el del mes anterior tiene `gano:false`). El cupo sigue siendo **derivado**, sin contadores. En la web, el modal vive en su propio nodo `#ruleta` fuera de la zona que `pintar()` rehace en cada snapshot.

**Tech Stack:** TypeScript + Vite + vitest (web), Firebase Functions v2 + firebase-admin (servidor), Kotlin + Jetpack Compose (app del entrenador), Firestore.

**Spec:** [`docs/superpowers/specs/2026-09-18-ruleta-revivir-racha-design.md`](../specs/2026-09-18-ruleta-revivir-racha-design.md)

**Rama:** `feature/ruleta-revivir-racha`. **No se mezcla a `main` hasta terminar la Tarea 12**: todos los clientes tienen su web funcionando hoy.

## Global Constraints

- **`MAXIMO_POR_MES = 3`**, y el castigo resta **1**, con piso en 2. El castigo **no se acumula**.
- **`PROBABILIDAD_GANAR = 0.7`**, constante del servidor. **Nunca** se manda al navegador ni se escribe en ningún archivo de `web/`.
- **La ruleta se dibuja mitad y mitad** aunque el sorteo sea 70/30. Decisión consciente, anotada como riesgo aceptado en el spec.
- **Una tirada por cliente por mes**, gane o pierda.
- **Colores de la ruleta:** `var(--primario)` y `var(--ambar)`. **Nunca** `--verde` ni `--rojo`: en el calendario ya significan "asistió" y "faltó".
- **Los tests de `web/` corren en Node sin jsdom.** Toda función que se pruebe debe devolver un string de HTML o un número, nunca tocar `document`. Lo que toca el DOM va en módulos aparte, sin test.
- **Nombres en español**, comentarios en español, y comentarios que expliquen *por qué*, no *qué*. Es el estilo de todo el repo.
- **Las reglas de Firestore autorizan por el id del documento, nunca por `resource.data`**, para las colecciones cuyo documento puede no existir. Ver entrada 23 de `docs/backlog.md`.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `web/src/tirada.ts` | **nuevo.** El dato `Tirada` y el castigo derivado. Puro, sin Firebase. |
| `web/src/cupo.ts` | modificar: el castigo entra en el cálculo. |
| `web/src/datos.ts` | modificar: `observarTirada` para este mes y el anterior. |
| `web/src/acciones.ts` | modificar: el binding de `jugarRuleta`. |
| `web/src/ui/ruleta.ts` | **nuevo.** Estado del modal + HTML puro + listeners. |
| `web/src/ui/ruletaGiro.ts` | **nuevo.** `anguloDestino()` (puro, probado) + la animación que toca el DOM. |
| `web/src/ui/accionFalta.ts` | modificar: los dos estados nuevos de la tarjeta. |
| `web/src/main.ts` | modificar: el nodo `#ruleta` fuera de la zona repintada. |
| `web/src/estilos.css` | modificar: overlay, tarjeta del modal, ruleta, animaciones. |
| `functions/src/reglasRuleta.ts` | **nuevo.** Elegibilidad y sorteo. Puro, sin Firestore. |
| `functions/src/jugarRuleta.ts` | **nuevo.** El cableado con Firestore. |
| `functions/src/index.ts` | modificar: exportarla. |
| `functions/package.json` | modificar: vitest. |
| `firestore.rules` | modificar: `ruletas`, autorizada por id. |
| `app/.../domain/CupoRevivesCalculator.kt` | modificar: el castigo como parámetro. |
| `app/.../data/repository/RuletaRepository.kt` | **nuevo.** Lee la tirada de un mes. |
| `app/.../ui/clientes/ClienteDetailViewModel.kt` | modificar: el castigo del mes anterior. |
| `app/.../ui/clientes/ClienteDetailScreen.kt` | modificar: el máximo real y el motivo. |

---

### Task 1: El dato de la tirada y el castigo derivado

**Files:**
- Create: `web/src/tirada.ts`
- Test: `web/src/tirada.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `interface Tirada { mes: string; color: string; gano: boolean; fecha: string }`, `mesAnterior(mes: string): string`, `castigoDelMes(tiradaMesAnterior: Tirada | null): number`.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/tirada.test.ts
import { describe, expect, it } from "vitest";
import { castigoDelMes, mesAnterior, type Tirada } from "./tirada";

const tirada = (campos: Partial<Tirada> = {}): Tirada => ({
  mes: "2026-08",
  color: "primario",
  gano: false,
  fecha: "2026-08-20",
  ...campos,
});

describe("mesAnterior", () => {
  it("retrocede un mes dentro del mismo año", () => {
    expect(mesAnterior("2026-09")).toBe("2026-08");
  });

  // Enero es el único caso donde restar uno al número del mes no basta.
  it("cruza el año en enero", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
  });

  it("rellena el cero a la izquierda", () => {
    expect(mesAnterior("2026-10")).toBe("2026-09");
  });
});

describe("castigoDelMes", () => {
  it("sin tirada el mes anterior no hay castigo", () => {
    expect(castigoDelMes(null)).toBe(0);
  });

  it("haber ganado el mes anterior no castiga", () => {
    expect(castigoDelMes(tirada({ gano: true }))).toBe(0);
  });

  it("haber perdido el mes anterior cuesta un revive", () => {
    expect(castigoDelMes(tirada({ gano: false }))).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/tirada.test.ts`
Expected: FAIL — `Failed to resolve import "./tirada"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/tirada.ts

/**
 * La tirada de ruleta de un cliente en un mes. Hay a lo más una: el id del documento es
 * `{clienteId}_{AAAA-MM}`, así que "una tirada por mes" lo garantiza Firestore y no una
 * validación que se pueda olvidar.
 *
 * GEMELO: `Tirada` en `functions/src/reglasRuleta.ts` y `Tirada` en Kotlin.
 */
export interface Tirada {
  mes: string;
  color: string;
  gano: boolean;
  fecha: string;
}

/** [mes] en formato `AAAA-MM`. Devuelve el mes anterior en el mismo formato. */
export function mesAnterior(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  const previo = numero === 1 ? { anio: anio - 1, numero: 12 } : { anio, numero: numero - 1 };
  return `${previo.anio}-${String(previo.numero).padStart(2, "0")}`;
}

/**
 * Cuántos revives pierde el cliente este mes por haber perdido la ruleta el mes pasado.
 *
 * No se acumula: el piso es un castigo de 1. Un cliente en 0 revives permanentes es un
 * cliente al que la página ya solo le da malas noticias.
 *
 * Se calcula, no se guarda, por lo mismo que el cupo: si el documento de la ruleta se borra,
 * el castigo desaparece solo y no queda un contador viejo que nadie mira.
 */
export function castigoDelMes(tiradaMesAnterior: Tirada | null): number {
  return tiradaMesAnterior !== null && !tiradaMesAnterior.gano ? 1 : 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/tirada.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/tirada.ts web/src/tirada.test.ts
git commit -m "feat: el dato de la tirada y el castigo derivado del mes anterior"
```

---

### Task 2: El cupo deja de ser una constante (web)

**Files:**
- Modify: `web/src/cupo.ts`
- Test: `web/src/cupo.test.ts`

**Interfaces:**
- Consumes: `castigoDelMes` de la Tarea 1 (solo en el test, para armar el caso).
- Produces: `disponiblesEnElMes(asistencias, mes, castigo?: number): number`. El tercer parámetro es **opcional con valor 0** para que las llamadas existentes sigan compilando.

- [ ] **Step 1: Write the failing test**

Agregar al final de `web/src/cupo.test.ts`, **dentro** del `describe("cupo de revives", ...)` existente:

```ts
  // El castigo de la ruleta baja el máximo del mes, no lo que ya se gastó. Estos casos son
  // los que impiden que el castigo se cuele en `gastadosEnElMes`, que solo cuenta faltas.
  it("el castigo baja el maximo del mes a 2", () => {
    expect(disponiblesEnElMes([], "2026-09", 1)).toBe(2);
  });

  it("sin castigo el maximo sigue siendo 3", () => {
    expect(disponiblesEnElMes([], "2026-09", 0)).toBe(3);
  });

  it("con castigo y una gastada quedan 1", () => {
    const asistencias = [falta("2026-09-01", true)];
    expect(disponiblesEnElMes(asistencias, "2026-09", 1)).toBe(1);
  });

  it("con castigo y dos gastadas quedan 0", () => {
    const asistencias = [falta("2026-09-01", true), falta("2026-09-02", true)];
    expect(disponiblesEnElMes(asistencias, "2026-09", 1)).toBe(0);
  });

  // Regresión: la llamada sin tercer parámetro es la que hacen hoy todos los clientes que
  // nunca han jugado. Si esta se rompe, se rompe la página de todos, no la de los que juegan.
  it("sin tercer parametro se comporta como antes", () => {
    const asistencias = [falta("2026-09-01", true)];
    expect(disponiblesEnElMes(asistencias, "2026-09")).toBe(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/cupo.test.ts`
Expected: FAIL — "el castigo baja el maximo del mes a 2" espera 2 y recibe 3; el tercer argumento se ignora.

- [ ] **Step 3: Write minimal implementation**

En `web/src/cupo.ts`, reemplazar `disponiblesEnElMes` por:

```ts
/**
 * Lo que le queda al cliente este mes.
 *
 * [castigo] son los revives que perdió por fallar la ruleta el mes pasado (0 o 1). Entra como
 * parámetro y no se lee acá adentro a propósito: esta función es pura y se prueba en Node,
 * donde no hay Firestore. Quien la llama ya tiene el documento de la tirada.
 */
export function disponiblesEnElMes(
  asistencias: Asistencia[],
  mes: string,
  castigo = 0
): number {
  return Math.max(MAXIMO_POR_MES - castigo - gastadosEnElMes(asistencias, mes), 0);
}
```

Y agregar al bloque de comentario de cabecera del archivo, después del párrafo existente:

```ts
 * Desde la ruleta (2026-09-18) el máximo del mes ya no es fijo: perder la ruleta un mes le
 * quita un revive al siguiente. El castigo tampoco se guarda como número — se deduce del
 * documento `ruletas/{cliente}_{mes anterior}`, así que borrar ese documento devuelve el cupo
 * solo, igual que desmarcar una justificada.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test`
Expected: PASS — toda la suite de `web/`, incluidos los tests viejos de cupo sin tocar.

- [ ] **Step 5: Commit**

```bash
git add web/src/cupo.ts web/src/cupo.test.ts
git commit -m "feat: el castigo de la ruleta entra en el cupo mensual del cliente"
```

---

### Task 3: El gemelo Kotlin del cupo

**Files:**
- Modify: `app/src/main/java/com/osfit/app/domain/CupoRevivesCalculator.kt`
- Test: `app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt`

**Interfaces:**
- Consumes: nada.
- Produces: `CupoRevivesCalculator.disponiblesEnElMes(asistencias: List<Asistencia>, mes: String, castigo: Int = 0): Int`.

- [ ] **Step 1: Write the failing test**

Agregar dentro de la clase `CupoRevivesCalculatorTest`:

```kotlin
    // GEMELO de los casos de `cupo.test.ts`. Los mismos números, para que los dos lados no
    // se separen sin que nadie lo note.
    @Test
    fun `el castigo baja el maximo del mes a 2`() {
        assertEquals(2, CupoRevivesCalculator.disponiblesEnElMes(emptyList(), "2026-09", 1))
    }

    @Test
    fun `sin castigo el maximo sigue siendo 3`() {
        assertEquals(3, CupoRevivesCalculator.disponiblesEnElMes(emptyList(), "2026-09", 0))
    }

    @Test
    fun `con castigo y dos gastadas quedan 0`() {
        val asistencias = listOf(
            Asistencia(fecha = "2026-09-01", asistio = false, justificada = true, justificadaPorCliente = true),
            Asistencia(fecha = "2026-09-02", asistio = false, justificada = true, justificadaPorCliente = true)
        )
        assertEquals(0, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09", 1))
    }

    @Test
    fun `sin tercer parametro se comporta como antes`() {
        val asistencias = listOf(
            Asistencia(fecha = "2026-09-01", asistio = false, justificada = true, justificadaPorCliente = true)
        )
        assertEquals(2, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09"))
    }
```

> Si la forma de construir `Asistencia` en este test no coincide con la de los casos que ya están arriba en el archivo, **usa la del archivo**: el data class tiene más campos con valores por defecto y los tests existentes ya fijaron la forma corta.

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "*CupoRevivesCalculatorTest*"`
Expected: FAIL de compilación — `disponiblesEnElMes` no acepta 3 argumentos.

- [ ] **Step 3: Write minimal implementation**

En `CupoRevivesCalculator.kt`, reemplazar `disponiblesEnElMes` por:

```kotlin
    /**
     * [castigo] son los revives que el cliente perdió por fallar la ruleta el mes pasado
     * (0 o 1). Entra como parámetro y no se lee acá: este objeto es puro y se prueba en la
     * JVM, sin Firestore. Quien lo llama ya tiene el documento de la tirada.
     */
    fun disponiblesEnElMes(asistencias: List<Asistencia>, mes: String, castigo: Int = 0): Int =
        (MAXIMO_POR_MES - castigo - gastadosEnElMes(asistencias, mes)).coerceAtLeast(0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test`
Expected: PASS — la suite completa de Kotlin.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/CupoRevivesCalculator.kt app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt
git commit -m "feat: el gemelo Kotlin del cupo tambien resta el castigo de la ruleta"
```

---

### Task 4: Las reglas de Firestore para `ruletas`

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: nada.
- Produces: la colección `ruletas` legible por su dueño y por el entrenador, escribible solo por el Admin SDK.

**Por qué la regla se escribe distinto a las de al lado:** la entrada 23 de `docs/backlog.md` documenta que `avisosFalta` deniega la lectura mientras el documento no existe, porque la regla mira `resource.data.clienteId` y con el documento ausente `resource` es `null`. En `ruletas` el documento ausente es **el caso normal** — casi ningún cliente juega —, así que autorizar por `resource.data` llenaría la consola de `permission-denied` en cada visita y mataría el listener. Se autoriza por el id, que ya lleva el `clienteId` dentro.

- [ ] **Step 1: Escribir la regla**

En `firestore.rules`, después del bloque `match /avisosFalta/{doc} { ... }`, agregar:

```
    // La ruleta: una tirada por cliente por mes, con id `{clienteId}_{AAAA-MM}`. El cliente
    // lee la suya —la necesita para saber si ya jugó y para calcular su cupo— pero escribir
    // solo lo hace la función `jugarRuleta` con el Admin SDK, que no pasa por estas reglas.
    //
    // Se autoriza por el ID y no por `resource.data`, a diferencia de las de arriba: acá el
    // documento ausente es el caso normal (casi nadie juega), y una regla que mira
    // `resource.data` no deja leer lo que no existe. Ver entrada 23 de docs/backlog.md.
    match /ruletas/{doc} {
      allow read: if esEntrenador() ||
                     doc.split('_')[0] == request.auth.token.clienteId;
      allow write: if esEntrenador();
    }
```

- [ ] **Step 2: Verificar la sintaxis con el emulador**

Run: `firebase emulators:start --only firestore`
Expected: arranca sin errores de compilación de reglas. Si `firestore.rules` tiene un error, el emulador lo dice al arrancar y no sube.

Detener el emulador con `Ctrl+C`.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: reglas de la coleccion ruletas, autorizadas por id del documento"
```

---

### Task 5: Las reglas del juego en el servidor (puro)

**Files:**
- Modify: `functions/package.json`
- Create: `functions/src/reglasRuleta.ts`
- Test: `functions/src/reglasRuleta.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `const PROBABILIDAD_GANAR = 0.7`
  - `const COLORES = ["primario", "ambar"] as const`
  - `type Color = (typeof COLORES)[number]`
  - `type MotivoRechazo = "cuenta_pausada" | "sin_falta_reparable" | "todavia_tiene_cupo" | "ya_jugo"`
  - `motivoDeRechazo(estado: EstadoParaJugar): MotivoRechazo | null`
  - `resolverTirada(apostado: Color, azar: number): { gano: boolean; color: Color }`

- [ ] **Step 1: Agregar vitest a functions**

En `functions/package.json`, agregar a `scripts`:

```json
    "test": "vitest run",
```

y a `devDependencies`:

```json
    "vitest": "^5.0.0"
```

Run: `cd functions && npm install`

> **Por qué `functions/` estrena pruebas acá y no antes:** hasta hoy sus funciones solo revalidaban lo que el cliente pedía. `jugarRuleta` es la primera que **otorga un premio** y **aplica un castigo**. Un error en el sorteo le regala revives a todos o se los quita sin motivo, y se descubre por WhatsApp.

- [ ] **Step 2: Write the failing test**

```ts
// functions/src/reglasRuleta.test.ts
import { describe, expect, it } from "vitest";
import {
  PROBABILIDAD_GANAR,
  motivoDeRechazo,
  resolverTirada,
  type EstadoParaJugar,
} from "./reglasRuleta";

const puedeJugar = (campos: Partial<EstadoParaJugar> = {}): EstadoParaJugar => ({
  activo: true,
  faltaRota: "2026-09-16",
  disponibles: 0,
  yaJugo: false,
  ...campos,
});

describe("motivoDeRechazo", () => {
  it("con todo en su lugar deja jugar", () => {
    expect(motivoDeRechazo(puedeJugar())).toBeNull();
  });

  it("rechaza la cuenta pausada", () => {
    expect(motivoDeRechazo(puedeJugar({ activo: false }))).toBe("cuenta_pausada");
  });

  it("rechaza si no hay falta reparable", () => {
    expect(motivoDeRechazo(puedeJugar({ faltaRota: null }))).toBe("sin_falta_reparable");
  });

  // El juego solo existe donde hay una pared: con cupo, el cliente revive gratis y no
  // tiene por qué arriesgar el mes que viene.
  it("rechaza si todavia le queda cupo", () => {
    expect(motivoDeRechazo(puedeJugar({ disponibles: 1 }))).toBe("todavia_tiene_cupo");
  });

  it("rechaza la segunda tirada del mes", () => {
    expect(motivoDeRechazo(puedeJugar({ yaJugo: true }))).toBe("ya_jugo");
  });

  // La cuenta pausada se revisa primero: es el único motivo que el cliente no puede
  // resolver solo, y es el mensaje que necesita leer.
  it("la cuenta pausada gana sobre los demas motivos", () => {
    expect(motivoDeRechazo(puedeJugar({ activo: false, yaJugo: true }))).toBe("cuenta_pausada");
  });
});

describe("resolverTirada", () => {
  it("cae en el color apostado cuando el azar entra en la probabilidad", () => {
    expect(resolverTirada("primario", 0)).toEqual({ gano: true, color: "primario" });
    expect(resolverTirada("ambar", 0.69)).toEqual({ gano: true, color: "ambar" });
  });

  it("cae en el otro color cuando el azar la pasa", () => {
    expect(resolverTirada("primario", 0.7)).toEqual({ gano: false, color: "ambar" });
    expect(resolverTirada("ambar", 0.99)).toEqual({ gano: false, color: "primario" });
  });

  // El 0.7 es el contrato con el entrenador y el único lugar donde vive. Si alguien lo
  // mueve sin querer, este test lo dice antes que los clientes.
  it("la probabilidad de ganar es 0.7", () => {
    expect(PROBABILIDAD_GANAR).toBe(0.7);
  });

  it("de 1000 tiradas con azar parejo gana cerca del 70 por ciento", () => {
    const ganadas = Array.from({ length: 1000 }, (_, i) =>
      resolverTirada("primario", i / 1000)
    ).filter((t) => t.gano).length;
    expect(ganadas).toBe(700);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd functions && npm test`
Expected: FAIL — `Failed to resolve import "./reglasRuleta"`.

- [ ] **Step 4: Write minimal implementation**

```ts
// functions/src/reglasRuleta.ts

/**
 * Las reglas del juego, sin Firestore y sin red: qué impide jugar, y cómo se resuelve una
 * tirada. Vive aparte de `jugarRuleta.ts` para poder probarse en Node, que es donde tiene
 * que estar probada la única función que regala premios y aplica castigos.
 */

/**
 * Cuántas veces de cada diez cae en el color que el cliente apostó.
 *
 * ESTE NÚMERO NO SALE DE `functions/`. La ruleta se dibuja mitad y mitad en la página: si el
 * navegador conociera la probabilidad, cualquiera que abra la consola sabría que está
 * cargada. Ver "Riesgo aceptado" en el spec.
 */
export const PROBABILIDAD_GANAR = 0.7;

/**
 * Los dos colores, por nombre de variable CSS y no por hex: el `primario` es el de la paleta
 * que el entrenador le eligió a cada clienta, así que su valor cambia por cliente y solo la
 * página sabe cuál es.
 */
export const COLORES = ["primario", "ambar"] as const;
export type Color = (typeof COLORES)[number];

export type MotivoRechazo =
  | "cuenta_pausada"
  | "sin_falta_reparable"
  | "todavia_tiene_cupo"
  | "ya_jugo";

export interface EstadoParaJugar {
  activo: boolean;
  /** La fecha de la falta reparable, o `null` si no hay ninguna en la ventana. */
  faltaRota: string | null;
  /** Revives que le quedan este mes. El juego solo se ofrece con esto en cero. */
  disponibles: number;
  yaJugo: boolean;
}

/**
 * El primer motivo por el que este cliente no puede jugar, o `null` si puede.
 *
 * El orden importa: la cuenta pausada va primero porque es el único motivo que el cliente no
 * puede resolver solo, y devolverle "ya jugaste" a alguien cuya cuenta está pausada lo manda
 * a esperar al mes que viene en vez de a hablar con su entrenador.
 */
export function motivoDeRechazo(estado: EstadoParaJugar): MotivoRechazo | null {
  if (!estado.activo) return "cuenta_pausada";
  if (estado.faltaRota === null) return "sin_falta_reparable";
  if (estado.disponibles > 0) return "todavia_tiene_cupo";
  if (estado.yaJugo) return "ya_jugo";
  return null;
}

/**
 * Resuelve una tirada. [azar] entra como parámetro en vez de llamar a `Math.random()` acá
 * adentro para que se pueda fijar en las pruebas: un sorteo que no se puede fijar es un
 * sorteo que no se puede probar.
 */
export function resolverTirada(apostado: Color, azar: number): { gano: boolean; color: Color } {
  const gano = azar < PROBABILIDAD_GANAR;
  const otro: Color = apostado === "primario" ? "ambar" : "primario";
  return { gano, color: gano ? apostado : otro };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd functions && npm test`
Expected: PASS — 11 tests.

- [ ] **Step 6: Commit**

```bash
git add functions/package.json functions/package-lock.json functions/src/reglasRuleta.ts functions/src/reglasRuleta.test.ts
git commit -m "feat: reglas y sorteo de la ruleta, con vitest en functions"
```

---

### Task 6: La función `jugarRuleta`

**Files:**
- Create: `functions/src/jugarRuleta.ts`
- Modify: `functions/src/index.ts`
- Test: `functions/src/jugarRuleta.test.ts`

**Interfaces:**
- Consumes: `motivoDeRechazo`, `resolverTirada`, `COLORES`, `PROBABILIDAD_GANAR` de la Tarea 5; `clienteDeLaSesion`, `db`, `hoyEnMazatlan`, `REGION` de `comun.ts`; `faltaQueRompioLaRacha` de `functions/src/faltaRompio.ts`.
- Produces:
  - La función callable `jugarRuleta`, que recibe `{ color: Color }` y devuelve `{ gano: boolean; color: Color }`.
  - `aplicarTirada(deps: DepsTirada): Promise<{ gano: boolean; color: Color }>` — el núcleo, con las escrituras inyectadas, que es lo que se prueba.

**Por qué el núcleo está separado del callable:** `onCall` necesita un `CallableRequest` real y un Firestore real. Partiéndolo en dos, lo que decide y lo que escribe se prueba con dobles en Node, y el `onCall` queda como cableado de cinco líneas que no tiene dónde esconder un bug.

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/jugarRuleta.test.ts
import { describe, expect, it, vi } from "vitest";
import { aplicarTirada, type DepsTirada } from "./jugarRuleta";

function deps(campos: Partial<DepsTirada> = {}): DepsTirada {
  return {
    estado: { activo: true, faltaRota: "2026-09-16", disponibles: 0, yaJugo: false },
    apostado: "primario",
    mes: "2026-09",
    hoy: "2026-09-18",
    azar: () => 0,
    registrarTirada: vi.fn(async () => {}),
    justificarFalta: vi.fn(async () => {}),
    ...campos,
  };
}

describe("aplicarTirada", () => {
  it("al ganar justifica la falta y registra la tirada", async () => {
    const d = deps({ azar: () => 0 });
    const resultado = await aplicarTirada(d);

    expect(resultado).toEqual({ gano: true, color: "primario" });
    expect(d.justificarFalta).toHaveBeenCalledWith("2026-09-16");
    expect(d.registrarTirada).toHaveBeenCalledWith({
      mes: "2026-09",
      color: "primario",
      gano: true,
      fecha: "2026-09-18",
    });
  });

  it("al perder registra la tirada y NO toca las asistencias", async () => {
    const d = deps({ azar: () => 0.99 });
    const resultado = await aplicarTirada(d);

    expect(resultado).toEqual({ gano: false, color: "ambar" });
    expect(d.justificarFalta).not.toHaveBeenCalled();
    expect(d.registrarTirada).toHaveBeenCalledWith({
      mes: "2026-09",
      color: "ambar",
      gano: false,
      fecha: "2026-09-18",
    });
  });

  // Rechazar tiene que ser TOTAL: ni tirada registrada ni falta justificada. Un rechazo que
  // igual consume la tirada del mes es peor que no ofrecer el juego.
  it("rechaza con un motivo cuando no se puede jugar", async () => {
    const d = deps({ estado: { activo: true, faltaRota: null, disponibles: 0, yaJugo: false } });
    await expect(aplicarTirada(d)).rejects.toThrow("sin_falta_reparable");
    expect(d.registrarTirada).not.toHaveBeenCalled();
    expect(d.justificarFalta).not.toHaveBeenCalled();
  });

  it("rechaza la segunda tirada del mes sin escribir nada", async () => {
    const d = deps({ estado: { activo: true, faltaRota: "2026-09-16", disponibles: 0, yaJugo: true } });
    await expect(aplicarTirada(d)).rejects.toThrow("ya_jugo");
    expect(d.registrarTirada).not.toHaveBeenCalled();
  });

  it("rechaza un color que no existe", async () => {
    const d = deps({ apostado: "verde" as never });
    await expect(aplicarTirada(d)).rejects.toThrow("color_invalido");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npm test`
Expected: FAIL — `Failed to resolve import "./jugarRuleta"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// functions/src/jugarRuleta.ts
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { faltaQueRompioLaRacha, type AsistenciaParaRacha } from "./faltaRompio";
import {
  COLORES,
  PROBABILIDAD_GANAR,
  motivoDeRechazo,
  resolverTirada,
  type Color,
  type EstadoParaJugar,
} from "./reglasRuleta";

/** Mismo tope que `CupoRevivesCalculator.MAXIMO_POR_MES` en Kotlin y `cupo.ts` en la web. */
const MAXIMO_POR_MES = 3;

export interface DepsTirada {
  estado: EstadoParaJugar;
  apostado: Color;
  mes: string;
  hoy: string;
  /** Inyectada para poder fijarla en las pruebas. En producción es `Math.random`. */
  azar: () => number;
  registrarTirada: (tirada: {
    mes: string;
    color: Color;
    gano: boolean;
    fecha: string;
  }) => Promise<void>;
  justificarFalta: (fecha: string) => Promise<void>;
}

/**
 * El núcleo: decide y manda escribir, sin saber qué es Firestore.
 *
 * Lanza un `Error` con el motivo como mensaje; el callable lo traduce a `HttpsError`. Así
 * esto se prueba en Node sin arrastrar `firebase-functions`.
 */
export async function aplicarTirada(deps: DepsTirada): Promise<{ gano: boolean; color: Color }> {
  if (!COLORES.includes(deps.apostado)) throw new Error("color_invalido");

  const motivo = motivoDeRechazo(deps.estado);
  if (motivo !== null) throw new Error(motivo);

  const resultado = resolverTirada(deps.apostado, deps.azar());

  // La tirada se registra SIEMPRE y primero: es lo que consume la oportunidad del mes. Si se
  // registrara después de justificar, una falla entre las dos escrituras le dejaría al
  // cliente el premio y la tirada intacta.
  await deps.registrarTirada({
    mes: deps.mes,
    color: resultado.color,
    gano: resultado.gano,
    fecha: deps.hoy,
  });

  if (resultado.gano) {
    // `faltaRota` no puede ser null acá: `motivoDeRechazo` ya devolvió `sin_falta_reparable`.
    await deps.justificarFalta(deps.estado.faltaRota as string);
  }

  return resultado;
}

const CODIGO_HTTP: Record<string, "failed-precondition" | "already-exists" | "permission-denied"> = {
  cuenta_pausada: "permission-denied",
  sin_falta_reparable: "failed-precondition",
  todavia_tiene_cupo: "failed-precondition",
  ya_jugo: "already-exists",
  color_invalido: "failed-precondition",
};

/**
 * La ruleta: el cliente sin cupo y con la racha rota apuesta a un color. Si acierta se le
 * justifica la falta sin gastar cupo; si falla, el mes siguiente tendrá 2 revives en vez de 3.
 *
 * TODO lo que manda la página se revalida acá. Igual que `revivirRacha` no confía en la fecha
 * que le mandan, esta no confía en "te juro que no tengo vidas": el cupo y la falta rota se
 * recalculan sobre el historial real.
 */
export const jugarRuleta = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);
  const datos = request.data as { color?: unknown } | undefined;
  const apostado = datos?.color as Color;

  const firestore = db();
  const hoy = hoyEnMazatlan();
  const mes = hoy.slice(0, 7);

  const clienteSnap = await firestore.collection("clientes").doc(clienteId).get();
  const activo = clienteSnap.get("activo") === true;

  const todas = await firestore.collection("asistencias").where("clienteId", "==", clienteId).get();
  const asistencias: (AsistenciaParaRacha & { justificadaPorCliente: boolean })[] = todas.docs.map(
    (d) => ({
      fecha: typeof d.get("fecha") === "string" ? (d.get("fecha") as string) : "",
      asistio: d.get("asistio") === true,
      justificada: d.get("justificada") === true,
      justificadaPorCliente: d.get("justificadaPorCliente") === true,
    })
  );

  // El cupo se cuenta igual que en `revivirRacha`, sobre las asistencias. El castigo del mes
  // anterior NO entra acá: el juego se ofrece cuando `disponibles` es 0, y con castigo el cupo
  // llega a 0 antes, no después — restarlo dos veces no cambia el cero.
  const gastados = asistencias.filter(
    (a) => a.justificadaPorCliente && a.justificada && a.fecha.startsWith(`${mes}-`)
  ).length;
  const disponibles = Math.max(MAXIMO_POR_MES - gastados, 0);

  const refTirada = firestore.collection("ruletas").doc(`${clienteId}_${mes}`);
  const yaJugo = (await refTirada.get()).exists;

  try {
    return await aplicarTirada({
      estado: {
        activo,
        faltaRota: faltaQueRompioLaRacha(asistencias, hoy),
        disponibles,
        yaJugo,
      },
      apostado,
      mes,
      hoy,
      azar: Math.random,
      // `create()` y no `set()`: si el documento ya existe la escritura falla sola. Es lo que
      // hace atómico el "una tirada por mes" contra dos toques simultáneos desde dos
      // teléfonos, que la lectura de `yaJugo` de arriba no puede evitar por sí sola.
      registrarTirada: async (tirada) => {
        try {
          await refTirada.create({ clienteId, ...tirada });
        } catch {
          throw new Error("ya_jugo");
        }
      },
      justificarFalta: async (fecha) => {
        const existente = todas.docs.find((d) => d.get("fecha") === fecha);
        // `ganadaEnRuleta` y NO `justificadaPorCliente`: si se marcara como del cliente,
        // `gastadosEnElMes` la contaría como un revive usado y el premio se cobraría a sí
        // mismo.
        if (existente) {
          await existente.ref.update({ justificada: true, ganadaEnRuleta: true });
        } else {
          await firestore.collection("asistencias").add({
            id: "",
            clienteId,
            fecha,
            asistio: false,
            justificada: true,
            ganadaEnRuleta: true,
            diaRutinaRealizado: null,
            nota: "",
            horaLlegada: null,
            horaSalida: null,
            duracionMinutos: null,
          });
        }
      },
    });
  } catch (error) {
    const motivo = (error as Error).message;
    const codigo = CODIGO_HTTP[motivo];
    if (codigo) throw new HttpsError(codigo, motivo);
    throw error;
  }
});
```

En `functions/src/index.ts`, agregar:

```ts
export { jugarRuleta } from "./jugarRuleta";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npm test && npm run build`
Expected: PASS — 16 tests en total, y el build de TypeScript sin errores.

- [ ] **Step 5: Commit**

```bash
git add functions/src/jugarRuleta.ts functions/src/jugarRuleta.test.ts functions/src/index.ts
git commit -m "feat: la funcion jugarRuleta, con el sorteo y las escrituras separadas"
```

---

### Task 7: La plomería de la web — datos y acción

**Files:**
- Modify: `web/src/datos.ts`
- Modify: `web/src/acciones.ts`

**Interfaces:**
- Consumes: `Tirada` de la Tarea 1.
- Produces:
  - `observarTirada(clienteId: string, mes: string, alCambiar: (t: Tirada | null) => void)`
  - `jugarRuleta` callable: `{ color: string }` → `{ gano: boolean; color: string }`

No lleva test: `datos.ts` y `acciones.ts` son cableado con el SDK de Firebase y hoy tampoco los cubre ningún test. Lo que sí tienen es forma probada — el tipo `Tirada` de la Tarea 1.

- [ ] **Step 1: Agregar el observador**

En `web/src/datos.ts`, agregar el import del tipo arriba:

```ts
import type { Tirada } from "./tirada";
```

Agregar además el campo nuevo a la interfaz `Asistencia`, después de `justificadaPorCliente`:

```ts
  /**
   * La justificó el cliente ganando la ruleta. Deliberadamente SEPARADA de
   * `justificadaPorCliente`: si compartieran bandera, `gastadosEnElMes` contaría el premio
   * como un revive usado y el premio se cobraría a sí mismo.
   *
   * Opcional por la razón de siempre: Firestore omite los campos que nunca se escribieron.
   */
  ganadaEnRuleta?: boolean;
```

y la función al final del archivo:

```ts
/**
 * La tirada de ruleta de un mes, o `null` si no jugó. Se observa para dos cosas: saber si ya
 * gastó su tirada de este mes, y saber si el mes pasado perdió (lo que le quita un revive).
 *
 * Lo normal es que el documento NO exista: casi nadie juega. Por eso la regla de `ruletas`
 * autoriza por el id del documento y no por `resource.data` — ver entrada 23 de
 * `docs/backlog.md`, donde esto mismo llenaba la consola de `permission-denied` en
 * `avisosFalta` y mataba el listener en cada carga.
 */
export function observarTirada(
  clienteId: string,
  mes: string,
  alCambiar: (t: Tirada | null) => void
) {
  return onSnapshot(doc(db, "ruletas", `${clienteId}_${mes}`), (snap) => {
    alCambiar(snap.exists() ? (snap.data() as Tirada) : null);
  });
}
```

- [ ] **Step 2: Agregar el binding de la acción**

En `web/src/acciones.ts`, cambiar el comentario de cabecera de "Las tres escrituras" a "Las cuatro escrituras", y agregar al final:

```ts
/**
 * La ruleta. Manda el color apostado y recibe en cuál cayó.
 *
 * El servidor decide el resultado: acá no hay ni un `Math.random()` que valga, porque un
 * sorteo hecho en el navegador se gana siempre desde la consola.
 */
export const jugarRuleta = httpsCallable<
  { color: string },
  { gano: boolean; color: string }
>(functions, "jugarRuleta");
```

- [ ] **Step 3: Verificar que compila**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add web/src/datos.ts web/src/acciones.ts
git commit -m "feat: observar la tirada del mes y llamar a jugarRuleta desde la web"
```

---

### Task 8: El ángulo de la ruleta

**Files:**
- Create: `web/src/ui/ruletaGiro.ts`
- Test: `web/src/ui/ruletaGiro.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `const GRADOS_POR_SECTOR = 180`
  - `anguloDestino(color: "primario" | "ambar", azar: number): number`
  - `frenar(rueda: HTMLElement, color, azar): number` — toca el DOM, sin test.
  - `girarLibre(rueda: HTMLElement): void` — toca el DOM, sin test.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/ui/ruletaGiro.test.ts
import { describe, expect, it } from "vitest";
import { anguloDestino } from "./ruletaGiro";

/**
 * El sector `primario` ocupa [0,180) y el `ambar` [180,360). El puntero está arriba, así que
 * el ángulo que devuelve esto es dónde tiene que quedar la rueda para que el puntero caiga
 * dentro del sector pedido.
 */
describe("anguloDestino", () => {
  it("el primario cae en la primera mitad", () => {
    expect(anguloDestino("primario", 0)).toBeGreaterThanOrEqual(0);
    expect(anguloDestino("primario", 0.999)).toBeLessThan(180);
  });

  it("el ambar cae en la segunda mitad", () => {
    expect(anguloDestino("ambar", 0)).toBeGreaterThanOrEqual(180);
    expect(anguloDestino("ambar", 0.999)).toBeLessThan(360);
  });

  // Si siempre cayera clavada en el mismo grado, se notaría que el dibujo obedece a un dato.
  it("dos tiradas del mismo color aterrizan en puntos distintos", () => {
    expect(anguloDestino("primario", 0.1)).not.toBe(anguloDestino("primario", 0.9));
  });

  // Los bordes son donde el puntero queda ambiguo: nunca debe aterrizar exactamente ahí.
  it("nunca aterriza pegada al borde del sector", () => {
    const margen = 10;
    expect(anguloDestino("primario", 0)).toBeGreaterThanOrEqual(margen);
    expect(anguloDestino("primario", 1)).toBeLessThanOrEqual(180 - margen);
    expect(anguloDestino("ambar", 0)).toBeGreaterThanOrEqual(180 + margen);
    expect(anguloDestino("ambar", 1)).toBeLessThanOrEqual(360 - margen);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/ruletaGiro.test.ts`
Expected: FAIL — `Failed to resolve import "./ruletaGiro"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/ui/ruletaGiro.ts

/**
 * El giro de la ruleta: la parte pura (dónde tiene que aterrizar) y la parte que toca el DOM
 * (cómo llega hasta ahí). Separadas porque los tests de este repo corren en Node sin jsdom.
 */

/** Dos colores, media vuelta cada uno. La ruleta se dibuja mitad y mitad (ver el spec). */
export const GRADOS_POR_SECTOR = 180;

/** Margen en grados para no aterrizar pegada al borde, donde el puntero queda ambiguo. */
const MARGEN = 10;

/** Milisegundos de giro libre antes de empezar a frenar, aunque el servidor responda antes. */
export const MINIMO_GIRO_LIBRE_MS = 800;

/** Vueltas completas que dura el frenado. Tres es lo que absorbe la corrección sin que se vea. */
export const VUELTAS_DE_FRENADO = 3;

/** Duración del frenado. La curva de salida hace que las últimas vueltas sean las lentas. */
export const MS_DE_FRENADO = 4000;

/**
 * El ángulo final, dentro del sector del color que mandó el servidor.
 *
 * [azar] entra como parámetro (0 a 1) en vez de llamar a `Math.random()` acá para poder
 * probarlo. No decide nada del resultado: el color ya viene decidido, esto solo elige en qué
 * punto de ese medio círculo se detiene, para que dos tiradas del mismo color no se vean
 * idénticas.
 */
export function anguloDestino(color: "primario" | "ambar", azar: number): number {
  const inicio = color === "primario" ? 0 : GRADOS_POR_SECTOR;
  const util = GRADOS_POR_SECTOR - MARGEN * 2;
  return inicio + MARGEN + azar * util;
}

/** El ángulo en el que está la rueda AHORA, leído de la matriz de transformación calculada. */
function anguloActual(rueda: HTMLElement): number {
  const matriz = new DOMMatrixReadOnly(getComputedStyle(rueda).transform);
  const grados = (Math.atan2(matriz.b, matriz.a) * 180) / Math.PI;
  return (grados + 360) % 360;
}

/** Fase 1: rotación pareja e infinita, desde el instante en que el cliente toca "Jugar". */
export function girarLibre(rueda: HTMLElement): void {
  rueda.style.transition = "none";
  rueda.classList.add("girando");
}

/**
 * Fase 2: frena hasta [color]. Devuelve los milisegundos que va a tardar.
 *
 * Lee el ángulo real del instante del relevo en vez de asumirlo: si se asumiera, la rueda
 * pegaría un salto visible justo en el momento en que el cliente más la está mirando. Y frena
 * a lo largo de VUELTAS_DE_FRENADO completas, de modo que la corrección hacia el sector
 * ganador queda absorbida dentro de las vueltas y es imperceptible.
 */
export function frenar(rueda: HTMLElement, color: "primario" | "ambar", azar: number): number {
  const desde = anguloActual(rueda);
  const hasta = desde + VUELTAS_DE_FRENADO * 360 + ((anguloDestino(color, azar) - desde + 360) % 360);

  rueda.classList.remove("girando");
  rueda.style.transform = `rotate(${desde}deg)`;
  // Fuerza el recálculo: sin esto el navegador agrupa las dos escrituras y la transición
  // arranca desde el ángulo viejo, que es exactamente el salto que se quiere evitar.
  void rueda.offsetWidth;
  rueda.style.transition = `transform ${MS_DE_FRENADO}ms cubic-bezier(0.17, 0.67, 0.2, 1)`;
  rueda.style.transform = `rotate(${hasta}deg)`;
  return MS_DE_FRENADO;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/ui/ruletaGiro.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/ruletaGiro.ts web/src/ui/ruletaGiro.test.ts
git commit -m "feat: el angulo y el frenado de la ruleta, sin que se note el reencaminado"
```

---

### Task 9: El modal de la ruleta

**Files:**
- Create: `web/src/ui/ruleta.ts`
- Test: `web/src/ui/ruleta.test.ts`

**Interfaces:**
- Consumes: `jugarRuleta` de la Tarea 7; `anguloDestino`, `girarLibre`, `frenar`, `MINIMO_GIRO_LIBRE_MS` de la Tarea 8.
- Produces:
  - `abrirRuleta(): void`, `ruletaAbierta(): boolean`
  - `modalRuleta(): string` — HTML puro, probado
  - `conectarRuleta(repintarPagina: () => void): void`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/ui/ruleta.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { abrirRuleta, cerrarRuleta, elegirColor, modalRuleta, marcarResultado } from "./ruleta";

beforeEach(() => cerrarRuleta());

describe("modalRuleta", () => {
  it("cerrada no pinta nada", () => {
    expect(modalRuleta()).toBe("");
  });

  it("abierta pinta la propuesta con el costo y el premio", () => {
    abrirRuleta();
    const html = modalRuleta();
    expect(html).toContain("Te propongo un juego");
    expect(html).toContain("te revivo tu racha");
    expect(html).toContain("2 oportunidades para revivir en vez de 3");
    expect(html).toContain("¿Quieres jugar?");
  });

  it("abierta ofrece la salida sin costo", () => {
    abrirRuleta();
    expect(modalRuleta()).toContain(`id="ruleta-cerrar"`);
  });

  // Tocar "Jugar" ES la apuesta. Sin color elegido no puede apostarse por accidente.
  it("Jugar esta deshabilitado hasta elegir color", () => {
    abrirRuleta();
    expect(modalRuleta()).toMatch(/id="ruleta-jugar"[^>]*disabled/);
    elegirColor("primario");
    expect(modalRuleta()).not.toMatch(/id="ruleta-jugar"[^>]*disabled/);
  });

  it("la tirada de prueba siempre esta disponible y se rotula como falsa", () => {
    abrirRuleta();
    expect(modalRuleta()).toContain(`id="ruleta-prueba"`);
    marcarResultado({ tipo: "prueba", color: "ambar" });
    expect(modalRuleta()).toContain("esta no cuenta");
  });

  // Que un toque impaciente convierta un ensayo en la apuesta real seria el peor fallo
  // posible de esta pantalla.
  it("durante una prueba girando, Jugar queda deshabilitado", () => {
    abrirRuleta();
    elegirColor("primario");
    marcarResultado({ tipo: "girando-prueba" });
    expect(modalRuleta()).toMatch(/id="ruleta-jugar"[^>]*disabled/);
  });

  it("al perder nombra el costo, no solo dice que perdio", () => {
    abrirRuleta();
    marcarResultado({ tipo: "perdio", color: "primario" });
    const html = modalRuleta();
    expect(html).toContain("2 revives en vez de 3");
    expect(html).not.toMatch(/^Perdiste\.?$/);
  });

  it("al ganar lo dice y no menciona castigo", () => {
    abrirRuleta();
    marcarResultado({ tipo: "gano", color: "primario" });
    const html = modalRuleta();
    expect(html).toContain("Has revivido tu racha");
    expect(html).not.toContain("en vez de 3");
  });

  it("mientras gira no dibuja la salida: la apuesta ya esta cobrada", () => {
    abrirRuleta();
    marcarResultado({ tipo: "girando-real" });
    expect(modalRuleta()).not.toContain(`id="ruleta-cerrar"`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/ruleta.test.ts`
Expected: FAIL — `Failed to resolve import "./ruleta"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/ui/ruleta.ts
import { jugarRuleta } from "../acciones";
import { MINIMO_GIRO_LIBRE_MS, frenar, girarLibre } from "./ruletaGiro";

/**
 * El modal de la ruleta: la propuesta, la elección de color, el giro y el acuse.
 *
 * Vive en su propio nodo `#ruleta`, fuera de `#contenido`. No es un capricho de orden: la
 * página rehace el `innerHTML` de `#contenido` en CADA snapshot de Firestore, y una ruleta
 * girando ahí dentro se moriría a media tirada en cuanto el entrenador marcara una
 * asistencia. Es el mismo motivo por el que el saludo y los videos ya viven fuera.
 */

export type Color = "primario" | "ambar";

type Fase =
  | { tipo: "propuesta" }
  | { tipo: "girando-real" }
  | { tipo: "girando-prueba" }
  | { tipo: "gano"; color: Color }
  | { tipo: "perdio"; color: Color }
  | { tipo: "prueba"; color: Color }
  | { tipo: "error"; texto: string };

interface Estado {
  abierta: boolean;
  color: Color | null;
  fase: Fase;
}

const estado: Estado = { abierta: false, color: null, fase: { tipo: "propuesta" } };

export function abrirRuleta(): void {
  estado.abierta = true;
  estado.color = null;
  estado.fase = { tipo: "propuesta" };
}

export function cerrarRuleta(): void {
  estado.abierta = false;
  estado.color = null;
  estado.fase = { tipo: "propuesta" };
}

export function ruletaAbierta(): boolean {
  return estado.abierta;
}

/** Exportadas para los tests: son los tres cambios de estado que el HTML refleja. */
export function elegirColor(color: Color): void {
  estado.color = color;
}

export function marcarResultado(fase: Fase): void {
  estado.fase = fase;
}

const NOMBRE: Record<Color, string> = { primario: "morado", ambar: "ámbar" };

const girando = (fase: Fase) => fase.tipo === "girando-real" || fase.tipo === "girando-prueba";

/** El acuse de cada desenlace. El de perder NOMBRA el costo: "perdiste" a secas no informa. */
function acuse(fase: Fase): string {
  switch (fase.tipo) {
    case "gano":
      return `<p class="aviso-ok">Cayó en ${NOMBRE[fase.color]}. ¡Has revivido tu racha!</p>`;
    case "perdio":
      return `<p class="aviso-error">Cayó en ${NOMBRE[fase.color]}. El próximo mes tendrás
              2 revives en vez de 3.</p>`;
    case "prueba":
      return `<p class="accion-nota">Cayó en ${NOMBRE[fase.color]}. Tirada de prueba — esta no
              cuenta.</p>`;
    case "error":
      return `<p class="aviso-error">${fase.texto}</p>`;
    default:
      return "";
  }
}

export function modalRuleta(): string {
  if (!estado.abierta) return "";

  const terminada = estado.fase.tipo === "gano" || estado.fase.tipo === "perdio";
  const enJuego = girando(estado.fase);
  const jugarBloqueado = estado.color === null || enJuego || terminada;

  const eleccion = (["primario", "ambar"] as Color[])
    .map(
      (c) => `<button class="ruleta-ficha ${c} ${estado.color === c ? "elegida" : ""}"
                       id="ruleta-color-${c}" ${enJuego || terminada ? "disabled" : ""}
                       aria-label="Apostar al ${NOMBRE[c]}"></button>`
    )
    .join("");

  // La ✕ no se dibuja mientras gira: cerrar a media tirada dejaría al cliente sin saber qué
  // pasó con una apuesta que el servidor ya cobró.
  const salida = enJuego
    ? ""
    : `<button id="ruleta-cerrar" class="ruleta-x" aria-label="Cerrar">✕</button>`;

  const botones = terminada
    ? `<button id="ruleta-listo" class="boton">Listo</button>`
    : `<div class="fila-botones">
         <button id="ruleta-prueba" class="boton secundario" ${enJuego ? "disabled" : ""}>
           Tirada de prueba
         </button>
         <button id="ruleta-jugar" class="boton" ${jugarBloqueado ? "disabled" : ""}>
           ${estado.fase.tipo === "girando-real" ? "Girando…" : "Jugar"}
         </button>
       </div>`;

  return `
    <div class="ruleta-fondo">
      <div class="ruleta-caja" role="dialog" aria-modal="true" aria-label="Te propongo un juego">
        ${salida}
        <p class="confirmar-titulo">Te propongo un juego.</p>
        <p class="accion-nota">
          Si adivinas en qué color caerá la ruleta, te revivo tu racha. Si no le atinas, el
          próximo mes tendrás solo 2 oportunidades para revivir en vez de 3.
        </p>
        <p class="ruleta-pregunta">¿Quieres jugar?</p>
        <div class="ruleta-fichas">${eleccion}</div>
        <div class="ruleta-marco">
          <div class="ruleta-puntero"></div>
          <div class="ruleta-rueda" id="ruleta-rueda"></div>
        </div>
        ${acuse(estado.fase)}
        ${botones}
      </div>
    </div>`;
}

/** Traduce el código de la `HttpsError` a algo que el cliente pueda hacer algo con ello. */
function textoDeError(codigo: string | undefined): string {
  if (codigo === "functions/already-exists") return "Ya jugaste tu tirada de este mes.";
  if (codigo === "functions/permission-denied")
    return "Tu cuenta está pausada. Habla con tu entrenador.";
  if (codigo === "functions/failed-precondition") return "Ya no hay nada que revivir.";
  return "No pudimos girar la ruleta. Inténtalo otra vez en un momento.";
}

/**
 * Se vuelve a llamar en cada repintado del nodo `#ruleta`, porque `innerHTML` tira los
 * listeners anteriores — igual que en `accionFalta.ts`.
 */
export function conectarRuleta(repintar: () => void): void {
  if (!estado.abierta) return;

  const rueda = () => document.querySelector<HTMLElement>("#ruleta-rueda");

  for (const c of ["primario", "ambar"] as Color[]) {
    document.querySelector(`#ruleta-color-${c}`)?.addEventListener("click", () => {
      elegirColor(c);
      repintar();
    });
  }

  document.querySelector("#ruleta-cerrar")?.addEventListener("click", () => {
    cerrarRuleta();
    repintar();
  });

  document.querySelector("#ruleta-listo")?.addEventListener("click", () => {
    cerrarRuleta();
    repintar();
  });

  document.querySelector("#ruleta-prueba")?.addEventListener("click", () => {
    const color: Color = Math.random() < 0.5 ? "primario" : "ambar";
    marcarResultado({ tipo: "girando-prueba" });
    repintar();
    const r = rueda();
    if (!r) return;
    girarLibre(r);
    // La prueba no toca el servidor: el color lo decide el navegador y no tiene ninguna
    // relación con el sorteo real, que vive entero en la función.
    const ms = frenar(r, color, Math.random());
    setTimeout(() => {
      marcarResultado({ tipo: "prueba", color });
      repintar();
    }, ms);
  });

  document.querySelector("#ruleta-jugar")?.addEventListener("click", async () => {
    const apostado = estado.color;
    if (apostado === null || girando(estado.fase)) return;

    marcarResultado({ tipo: "girando-real" });
    repintar();
    const r = rueda();
    if (r) girarLibre(r);

    // El giro libre dura un mínimo fijo aunque el servidor responda antes: así el frenado
    // siempre tiene la misma forma y la duración de la espera no delata el resultado.
    const espera = new Promise((listo) => setTimeout(listo, MINIMO_GIRO_LIBRE_MS));

    try {
      const [respuesta] = await Promise.all([jugarRuleta({ color: apostado }), espera]);
      const { gano, color } = respuesta.data;
      const ms = r ? frenar(r, color as Color, Math.random()) : 0;
      setTimeout(() => {
        marcarResultado({ tipo: gano ? "gano" : "perdio", color: color as Color });
        repintar();
      }, ms);
    } catch (error) {
      marcarResultado({
        tipo: "error",
        texto: textoDeError((error as { code?: string }).code),
      });
      repintar();
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/ui/ruleta.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/ruleta.ts web/src/ui/ruleta.test.ts
git commit -m "feat: el modal de la ruleta, con su eleccion de color y su tirada de prueba"
```

---

### Task 10: Los estados nuevos de la tarjeta de revivir

**Files:**
- Modify: `web/src/ui/accionFalta.ts`
- Test: `web/src/ui/accionFalta.test.ts` (**nuevo**)

**Interfaces:**
- Consumes: `disponiblesEnElMes` (Tarea 2), `castigoDelMes`/`Tirada` (Tarea 1), `abrirRuleta` (Tarea 9).
- Produces: `tarjetaRevivir(cliente, hoy, asistencias, tiradaEsteMes: Tirada | null, tiradaMesAnterior: Tirada | null): string` y `conectarAccionFalta(hoy, asistencias, repintar)` sin cambio de firma.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/ui/accionFalta.test.ts
import { describe, expect, it } from "vitest";
import type { Asistencia, Cliente } from "../datos";
import type { Tirada } from "../tirada";
import { tarjetaRevivir } from "./accionFalta";

const HOY = "2026-09-18"; // viernes
const cliente = (activo = true): Cliente =>
  ({ nombre: "Ana", activo, rutinaAsignada: null, ultimoDia: null,
     ultimoDiaFecha: null, ultimoDiaEsAncla: false } as Cliente);

/** Historial con la falta del jueves 17 y presencia el resto: rompe la racha y es reparable. */
const conFaltaRota = (gastadas: number): Asistencia[] => [
  { fecha: "2026-09-01", asistio: true, justificada: false },
  { fecha: "2026-09-17", asistio: false, justificada: false },
  ...Array.from({ length: gastadas }, (_, i) => ({
    fecha: `2026-09-0${i + 2}`,
    asistio: false,
    justificada: true,
    justificadaPorCliente: true,
  })),
];

const tirada = (campos: Partial<Tirada> = {}): Tirada =>
  ({ mes: "2026-08", color: "primario", gano: false, fecha: "2026-08-20", ...campos });

describe("tarjetaRevivir", () => {
  // REGRESIÓN: este es el camino que usan TODOS los clientes hoy, no solo los que juegan.
  it("con cupo disponible sigue ofreciendo el revive normal", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(0), null, null);
    expect(html).toContain("Revivir mi racha");
    expect(html).not.toContain("Leer propuesta");
  });

  it("sin cupo y sin haber jugado ofrece la propuesta", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(3), null, null);
    expect(html).toContain("Te quedaste sin vidas");
    expect(html).toContain("Leer propuesta");
    expect(html).not.toContain("Revivir mi racha");
  });

  it("sin cupo y habiendo jugado ya no ofrece nada", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(3), tirada({ mes: "2026-09" }), null);
    expect(html).not.toContain("Leer propuesta");
    expect(html).toContain("Y tu tirada");
  });

  it("la cuenta pausada no recibe la propuesta", () => {
    const html = tarjetaRevivir(cliente(false), HOY, conFaltaRota(3), null, null);
    expect(html).not.toContain("Leer propuesta");
    expect(html).toContain("pausada");
  });

  it("sin falta rota no dibuja nada", () => {
    const sanas: Asistencia[] = [
      { fecha: "2026-09-16", asistio: true, justificada: false },
      { fecha: "2026-09-17", asistio: true, justificada: false },
    ];
    expect(tarjetaRevivir(cliente(), HOY, sanas, null, null)).toBe("");
  });

  // Sin esta frase el cliente ve un número raro y no sabe por qué.
  it("el mes castigado explica por que le quedan 2", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(0), null, tirada({ gano: false }));
    expect(html).toContain("Te quedan 2 este mes");
    expect(html).toContain("perdiste la ruleta el mes pasado");
  });

  it("haber ganado el mes pasado no castiga", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(0), null, tirada({ gano: true }));
    expect(html).toContain("Te quedan 3 este mes");
    expect(html).not.toContain("perdiste la ruleta");
  });

  // Con castigo, el cupo se agota en 2 y la propuesta debe aparecer ahí, no en 3.
  it("con castigo y dos gastadas ya ofrece la propuesta", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(2), null, tirada({ gano: false }));
    expect(html).toContain("Leer propuesta");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/accionFalta.test.ts`
Expected: FAIL — `tarjetaRevivir` acepta 3 argumentos y no dibuja la propuesta.

- [ ] **Step 3: Write minimal implementation**

En `web/src/ui/accionFalta.ts`:

1. Agregar los imports:

```ts
import { castigoDelMes, type Tirada } from "../tirada";
import { abrirRuleta } from "./ruleta";
```

2. Reemplazar `cuantosQuedan` por:

```ts
/**
 * "Te quedan 2 este mes." / "Te queda 1 este mes."
 *
 * En un mes castigado dice además por qué: sin esa frase el cliente ve un número que no
 * cuadra con los 3 que se le prometieron y no tiene forma de saber de dónde salió.
 */
function cuantosQuedan(disponibles: number, castigado: boolean): string {
  const base = disponibles === 1 ? "Te queda 1 este mes." : `Te quedan ${disponibles} este mes.`;
  return castigado ? `${base} (perdiste la ruleta el mes pasado)` : base;
}
```

y actualizar la llamada dentro de `confirmacion()` a `cuantosQuedan(disponibles, false)` — el diálogo de confirmación habla del gasto, no del castigo, y ahí la coletilla estorbaría.

3. Reemplazar la firma y el cuerpo de `tarjetaRevivir`:

```ts
/**
 * "Revivir mi racha", en su propia tarjeta debajo de la racha y el promedio.
 *
 * Desde la ruleta (2026-09-18) esta tarjeta tiene dos estados más, y la regla que los ordena
 * es que **el juego solo existe donde antes había una pared**: sin cupo, con la racha rota y
 * la cuenta activa. Con cupo no cambia nada, que es el camino de todos los clientes.
 */
export function tarjetaRevivir(
  cliente: Cliente,
  hoy: string,
  asistencias: Asistencia[],
  tiradaEsteMes: Tirada | null,
  tiradaMesAnterior: Tirada | null
): string {
  if (esFinDeSemana(hoy)) return "";

  const rota = faltaQueRompioLaRacha(asistencias, hoy);
  if (rota === null && estado.exito !== "revivir") return "";

  const castigo = castigoDelMes(tiradaMesAnterior);
  const disponibles = disponiblesEnElMes(asistencias, hoy.slice(0, 7), castigo);
  const sinCupo = disponibles === 0;
  const bloqueado = !cliente.activo || sinCupo || estado.enVuelo;

  // La propuesta: sin cupo, con la cuenta activa y sin haber jugado este mes.
  const ofreceJuego = sinCupo && cliente.activo && tiradaEsteMes === null && rota !== null;

  const cuerpo =
    estado.pendiente !== null
      ? confirmacion(disponibles)
      : estado.exito === "revivir"
        ? ACUSE_REVIVIR
        : ofreceJuego
          ? `<p class="accion-nota">💔 Te quedaste sin vidas para revivir tu racha… pero te
               tengo una propuesta.</p>
             <button id="falta-propuesta" class="boton">Leer propuesta</button>`
          : `<button id="falta-revivir" class="boton secundario" ${bloqueado ? "disabled" : ""}>
               💔 Revivir mi racha
             </button>
             <p class="accion-nota">Repara tu falta del ${escapar(enPalabras(rota as string))}.</p>
             ${
               !cliente.activo
                 ? `<p class="accion-nota">Tu cuenta está pausada. Habla con tu entrenador.</p>`
                 : sinCupo
                   ? `<p class="accion-nota">Ya usaste tus revives de este mes. Y tu tirada.</p>`
                   : `<p class="accion-nota">${cuantosQuedan(disponibles, castigo > 0)}</p>`
             }`;

  const error =
    estado.error?.origen === "revivir"
      ? `<p class="aviso-error">${escapar(estado.error.texto)}</p>`
      : "";

  return `<div class="tarjeta">${error}${cuerpo}</div>`;
}
```

4. En `conectarAccionFalta`, agregar antes del listener de `#falta-revivir`:

```ts
  document.querySelector("#falta-propuesta")?.addEventListener("click", () => {
    abrirRuleta();
    repintar();
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test`
Expected: PASS — la suite completa, incluida la regresión "con cupo disponible sigue ofreciendo el revive normal".

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/accionFalta.ts web/src/ui/accionFalta.test.ts
git commit -m "feat: la tarjeta ofrece la ruleta cuando el cliente se queda sin vidas"
```

---

### Task 11: El modal en pantalla — estilos y cableado

**Files:**
- Modify: `web/src/estilos.css`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: `modalRuleta`, `conectarRuleta`, `ruletaAbierta` (Tarea 9); `observarTirada` (Tarea 7); `mesAnterior` (Tarea 1); `tarjetaRevivir` con la firma nueva (Tarea 10).
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Los estilos**

Agregar al final de `web/src/estilos.css`:

```css
/* La ruleta. El modal va en primer plano y lo demás queda visible pero apagado. */
.ruleta-fondo {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(18, 18, 18, 0.8);
  backdrop-filter: blur(4px);
}
.ruleta-caja {
  position: relative;
  background: var(--superficie-alta);
  border-radius: 20px;
  padding: 20px 18px;
  width: 100%;
  max-width: 360px;
  text-align: center;
}
.ruleta-x {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: 0;
  color: var(--texto-tenue);
  font-size: 18px;
  cursor: pointer;
}
.ruleta-pregunta { font-weight: 800; margin: 14px 0 10px; }
.ruleta-fichas { display: flex; gap: 14px; justify-content: center; margin-bottom: 16px; }
.ruleta-ficha {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
}
.ruleta-ficha.primario { background: var(--primario); }
.ruleta-ficha.ambar { background: var(--ambar); }
.ruleta-ficha.elegida { border-color: var(--texto); }
.ruleta-ficha:disabled { cursor: default; }

.ruleta-marco { position: relative; width: 200px; height: 200px; margin: 0 auto 14px; }
/* El puntero es fijo y la rueda es la que gira, como una ruleta de verdad. */
.ruleta-puntero {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 9px solid transparent;
  border-right: 9px solid transparent;
  border-top: 14px solid var(--texto);
  z-index: 1;
}
/* Mitad y mitad: la ruleta se dibuja justa aunque el sorteo no lo sea (ver el spec). */
.ruleta-rueda {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(var(--primario) 0deg 180deg, var(--ambar) 180deg 360deg);
}
.ruleta-rueda.girando { animation: ruleta-libre 0.7s linear infinite; }
@keyframes ruleta-libre {
  to { transform: rotate(360deg); }
}

/* Sin giro para quien pidió menos movimiento: el resultado llega igual, con un fundido. */
@media (prefers-reduced-motion: reduce) {
  .ruleta-rueda.girando { animation: none; }
  .ruleta-rueda { transition: opacity 200ms linear !important; }
}
```

- [ ] **Step 2: El cableado en main.ts**

En `web/src/main.ts`:

1. Agregar los imports:

```ts
import { observarTirada } from "./datos";
import { mesAnterior, type Tirada } from "./tirada";
import { modalRuleta, conectarRuleta } from "./ui/ruleta";
```

y agregar `observarTirada` a la lista de imports de `./datos` que ya existe arriba en vez de duplicar la línea.

2. Junto a las demás variables de estado de `arrancar()`, agregar:

```ts
  let tiradaEsteMes: Tirada | null = null;
  let tiradaMesAnterior: Tirada | null = null;
```

3. En `prepararEstructura`, cambiar la línea del `innerHTML` a:

```ts
    app.innerHTML =
      `${saludo(nombre)}<div id="contenido"></div><div id="videos"></div><div id="ruleta"></div>`;
```

4. Agregar, antes de `function pintar()`:

```ts
  /**
   * La ruleta se repinta APARTE, por lo mismo que el saludo y los videos: `pintar()` rehace el
   * `innerHTML` de `#contenido` en cada snapshot de Firestore, y una rueda a media vuelta se
   * moriría en cuanto el entrenador marcara una asistencia. Acá el nodo solo se toca cuando
   * cambia el estado del propio modal.
   */
  function pintarRuleta(): void {
    const caja = document.querySelector<HTMLElement>("#ruleta");
    if (!caja) return;
    caja.innerHTML = modalRuleta();
    conectarRuleta(pintarRuleta);
  }
```

5. Dentro de `pintar()`, cambiar la llamada a `tarjetaRevivir`:

```ts
      ${tarjetaRevivir(cliente, hoy, asistencias, tiradaEsteMes, tiradaMesAnterior)}
```

y agregar `pintarRuleta();` justo después de `pintarVideos();`.

6. Junto a los demás observadores, al final de `arrancar()`:

```ts
  observarTirada(clienteId, hoy.slice(0, 7), (t) => { tiradaEsteMes = t; pintar(); });
  observarTirada(clienteId, mesAnterior(hoy.slice(0, 7)), (t) => {
    tiradaMesAnterior = t;
    pintar();
  });
```

- [ ] **Step 3: Verificar que compila y que la suite sigue verde**

Run: `cd web && npx tsc --noEmit && npm test`
Expected: sin errores de tipos; toda la suite en PASS.

- [ ] **Step 4: Verlo en el navegador**

Run: `cd web && npm run dev`

Abrir la página con el link de una clienta de pruebas. Con cupo disponible, la tarjeta de revivir debe verse **exactamente como antes**. Detener con `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add web/src/estilos.css web/src/main.ts
git commit -m "feat: el modal de la ruleta en primer plano, fuera de la zona que se repinta"
```

---

### Task 12: El castigo en la app del entrenador

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/repository/RuletaRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`

**Interfaces:**
- Consumes: `CupoRevivesCalculator.disponiblesEnElMes(..., castigo)` de la Tarea 3.
- Produces: `RuletaRepository.observarTirada(clienteId, mes): Flow<Tirada?>`.

- [ ] **Step 1: El repositorio**

```kotlin
// app/src/main/java/com/osfit/app/data/repository/RuletaRepository.kt
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * La tirada de ruleta de un cliente en un mes, si jugó.
 *
 * GEMELO: `observarTirada` en `web/src/datos.ts`.
 *
 * El entrenador solo la lee: quien escribe es la Cloud Function `jugarRuleta`. Si la app
 * pudiera escribir acá, el castigo del cliente dependería de qué pantalla se abrió primero.
 */
data class Tirada(
    val mes: String = "",
    val color: String = "",
    val gano: Boolean = false,
    val fecha: String = ""
)

class RuletaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    fun observarTirada(clienteId: String, mes: String): Flow<Tirada?> = callbackFlow {
        val registro = db.collection("ruletas").document("${clienteId}_$mes")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.toObject(Tirada::class.java))
            }
        awaitClose { registro.remove() }
    }
}
```

- [ ] **Step 2: El ViewModel**

En `ClienteDetailViewModel.kt`:

1. Agregar los imports `com.osfit.app.data.repository.RuletaRepository`, `com.osfit.app.data.repository.Tirada` y `kotlinx.coroutines.flow.combine` (si no está ya).

2. Junto a los demás repositorios de la clase, agregar:

```kotlin
    private val ruletaRepository = RuletaRepository()
```

3. Agregar, antes de `revivesDisponibles`:

```kotlin
    /** El mes de hoy y el anterior, en la zona del gimnasio, en formato `AAAA-MM`. */
    private val mesActual = SincronizadorDiaWeb.hoy().substring(0, 7)
    private val mesPrevio = run {
        val (anio, numero) = mesActual.split("-").map { it.toInt() }
        if (numero == 1) "${anio - 1}-12" else "$anio-${"%02d".format(numero - 1)}"
    }

    /**
     * La tirada del mes pasado. Si existe y la perdió, este mes tiene un revive menos.
     *
     * Se lee acá y no dentro de `CupoRevivesCalculator` porque el calculador es puro y se
     * prueba en la JVM, sin Firestore.
     */
    private val tiradaMesPrevio: StateFlow<Tirada?> =
        ruletaRepository.observarTirada(clienteId, mesPrevio)
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
```

4. Reemplazar `revivesDisponibles` por:

```kotlin
    /**
     * Revives que le quedan al cliente este mes, incluido el castigo de la ruleta.
     *
     * El mes sale de la zona del gimnasio y no del dispositivo: la Cloud Function cuenta el
     * cupo en esa zona, y si el entrenador contara en otro mes vería un número distinto al de
     * la página del cliente — justo la discusión que este dato existe para zanjar.
     */
    val revivesDisponibles: StateFlow<Int> =
        combine(asistenciasDelCliente, tiradaMesPrevio) { asistencias, tirada ->
            val castigo = if (tirada != null && !tirada.gano) 1 else 0
            CupoRevivesCalculator.disponiblesEnElMes(asistencias, mesActual, castigo)
        }.stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5000),
            CupoRevivesCalculator.MAXIMO_POR_MES
        )

    /** El máximo de este mes: 3, o 2 si perdió la ruleta el mes pasado. */
    val revivesMaximo: StateFlow<Int> = tiradaMesPrevio
        .map { tirada ->
            CupoRevivesCalculator.MAXIMO_POR_MES - (if (tirada != null && !tirada.gano) 1 else 0)
        }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5000),
            CupoRevivesCalculator.MAXIMO_POR_MES
        )

    /** El mes en que perdió, para poder decir POR QUÉ le quedan menos. */
    val mesQuePerdioLaRuleta: StateFlow<String?> = tiradaMesPrevio
        .map { tirada -> if (tirada != null && !tirada.gano) tirada.mes else null }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
```

- [ ] **Step 3: La pantalla**

En `ClienteDetailScreen.kt`:

1. Junto a donde se recolecta `revivesDisponibles`, recolectar los dos nuevos:

```kotlin
    val revivesMaximo by viewModel.revivesMaximo.collectAsState()
    val mesPerdio by viewModel.mesQuePerdioLaRuleta.collectAsState()
```

2. Reemplazar el `Text` de la línea ~413 por:

```kotlin
                        Text(
                            buildString {
                                append("Revives: $revivesDisponibles de $revivesMaximo disponibles este mes")
                                // Decir POR QUÉ: si la app del entrenador y la del cliente
                                // muestran números distintos sin explicación, el reclamo por
                                // WhatsApp le llega a él.
                                mesPerdio?.let { append(" (perdió la ruleta en $it)") }
                            },
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 8.dp)
                        )
```

Si `CupoRevivesCalculator` deja de usarse en este archivo, quitar su import.

- [ ] **Step 4: Verificar**

Run: `./gradlew test && ./gradlew assembleDebug`
Expected: la suite en PASS y el APK compila.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/repository/RuletaRepository.kt app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt
git commit -m "feat: la app del entrenador muestra el cupo real y por que bajo"
```

---

### Task 13: Verificación antes de producción

**Files:**
- Modify: `docs/backlog.md`

**Nada de esto se mezcla a `main` hasta que este checklist esté recorrido.** Todos los clientes tienen su web funcionando hoy.

- [ ] **Step 1: La suite completa, los tres proyectos**

```bash
cd web && npm test && npx tsc --noEmit
cd ../functions && npm test && npm run build
cd .. && ./gradlew test
```

Expected: los tres en PASS. **Pegar la salida real en el commit de esta tarea**, no resumirla.

- [ ] **Step 2: El emulador, con los cinco estados de la tarjeta**

Arrancar: `firebase emulators:start` y `cd web && npm run dev`.

Recorrer, con una clienta de pruebas, y marcar cada uno:

- [ ] **Con cupo (3 de 3), racha rota:** sale "💔 Revivir mi racha". **No** sale la propuesta. *(Es la regresión que importa: es lo que ven todas las clientas hoy.)*
- [ ] **Sin cupo, sin haber jugado:** sale "Te quedaste sin vidas… Leer propuesta".
- [ ] **La ✕ cierra** sin gastar nada, y "Leer propuesta" vuelve a abrir.
- [ ] **"Jugar" está muerto** hasta tocar un color.
- [ ] **Tirada de prueba:** gira, dice "esta no cuenta", no escribe nada en `ruletas`, y se puede repetir.
- [ ] **Durante una prueba girando, "Jugar" está deshabilitado.**
- [ ] **Jugar y ganar:** la rueda frena en el color apostado **sin saltos visibles**, dice "Has revivido tu racha", y al cerrar la tarjeta de revivir ya no está.
- [ ] **Jugar y perder:** el acuse nombra el costo ("2 revives en vez de 3").
- [ ] **Segunda tirada el mismo mes:** la tarjeta ya no ofrece el botón. Llamar al callable a mano desde la consola devuelve `already-exists`.
- [ ] **Cuenta pausada:** no se ofrece la propuesta.
- [ ] **La consola no tiene ni un `permission-denied`** en una clienta que nunca ha jugado. *(Es la trampa de la entrada 23; si sale, la regla de `ruletas` quedó mirando `resource.data`.)*

- [ ] **Step 3: El mes castigado**

Con el emulador, crear a mano `ruletas/{clienteId}_{mes anterior}` con `gano: false` y verificar:

- [ ] La web dice "Te quedan 2 este mes (perdiste la ruleta el mes pasado)".
- [ ] La app del entrenador dice "Revives: 2 de 2 disponibles este mes (perdió la ruleta en …)".
- [ ] Borrar ese documento devuelve el cupo a 3 en los dos lados **sin tocar nada más**. *(Es el principio de "se cuenta, no se guarda".)*

- [ ] **Step 4: Anotar lo que quede pendiente**

Agregar al final de `docs/backlog.md` una entrada nueva con lo que haya quedado sin verificar (por ejemplo, lo que necesite una clienta real en día hábil), siguiendo el formato de las entradas que ya están.

- [ ] **Step 5: Commit**

```bash
git add docs/backlog.md docs/superpowers/plans/2026-09-18-ruleta-revivir-racha.md
git commit -m "docs: verificacion de la ruleta antes de produccion"
```

- [ ] **Step 6: Desplegar y mezclar**

Solo cuando todo lo de arriba esté marcado:

```bash
cd functions && npm run deploy
cd .. && firebase deploy --only firestore:rules
cd web && npm run build
```

Y entonces sí, mezclar `feature/ruleta-revivir-racha` a `main`.

> **El orden importa:** las reglas y la función van **antes** que el bundle de la web. Si el bundle sale primero, una clienta puede tocar "Leer propuesta" contra una función que todavía no existe.
