# Recordatorio de pago en la web del cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el entrenador pueda prender, clienta por clienta, una tarjeta en el **Inicio** de su página que diga cuántos días le quedan a su periodo de entrenamiento. La tarjeta aparece cuando faltan 2 días o menos: verde si sigue vigente (incluido el día del pago), roja si ya venció. Se queda en rojo hasta que el entrenador registre el pago.

**Architecture:** Un booleano nuevo `recordatorioPago` en `clientes/{id}`. Lo escribe la app desde un `Switch` en la pantalla **Web** de la clienta y la web lo lee junto con `fechaProximoPago`, que ya está en el mismo documento y ya llega en vivo por `observarCliente`. La web decide con una función pura (`web/src/pago.ts`) y pinta con otra (`web/src/ui/tarjetaRecordatorioPago.ts`). No hay listener nuevo, ni reglas nuevas, ni funciones nuevas.

**Tech Stack:** Android Kotlin + Jetpack Compose (Material 3) + Firestore; web Vite + TypeScript, sin framework. Pruebas: vitest (`web/`). La app no lleva tests nuevos (repositorio Firestore y pantalla Compose, ver `AGENTS.md`).

**Spec:** `docs/superpowers/specs/2026-10-07-recordatorio-pago-web-design.md`. **Léelo completo antes de empezar.** Este plan dice qué escribir; el spec dice por qué.

## Global Constraints

- **Apagado por defecto.** Si `recordatorioPago` no existe o no es `true`, no se muestra nada. En la web se compara con `=== true`, nunca por "truthy".
- **Ventana: `dias <= 2`.** Se muestra con 2, 1, 0 y cualquier negativo. Con 3 o más, nada. Coincide con el rojo de la lista de la app (`diasParaPago < 3`).
- **El día del pago (0) es vigente y va en verde**: "vence hoy". Solo `dias < 0` es vencido.
- **Las frases son exactamente las de la tabla del spec**, con singular para 1 día en las dos direcciones. Nada de "ayer" ni "en 0 días".
- **La fecha del Timestamp se pasa a día en la zona de Mazatlán**, nunca en la del navegador (misma razón que `hoyEnMazatlan`).
- **Solo informa:** sin botones, sin enlaces, sin montos. La web no escribe nada.
- **Sin cambios** en `firestore.rules` ni en `functions/`.
- Lo compartido entre Kotlin y TypeScript se marca con comentario `GEMELO`.
- Campos nuevos en la web: opcionales (Firestore omite lo que nunca se escribió).
- Kotlin: campo nuevo con valor por defecto; ViewModels con repositorio por constructor y `AppContainer.xxx` por defecto.
- Commits en inglés con prefijo (`feat:`, `docs:`…) y `Co-Authored-By:` con tu atribución. Un commit por task, push al cerrar cada una, en la rama que indique la sesión.
- **Desplegar requiere confirmación del entrenador** (hosting).

## Review Focus

- Interruptor apagado o ausente → no visible aunque falte 1 día o ya haya vencido (test en Task 2).
- Faltan 3 días → no visible; faltan 2 → visible (test en Task 2: el borde de la ventana).
- Día del pago → verde, "vence hoy" (tests en Task 2 y Task 3).
- Fecha de pago guardada a mediodía de Mazatlán → mismo día en la web, con el navegador en cualquier zona (test de `fechaEnMazatlan` en Task 1).
- Cruce de mes y de año en `diasParaPago` (test en Task 2).
- La tarjeta va **antes** que la tarjeta del día en Inicio (test en Task 4).
- Prender el interruptor en la app → la página abierta lo muestra sin recargar (verificación manual en Task 6).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `web/src/fecha.ts` | Modificar | `fechaEnMazatlan(date)`. |
| `web/src/fecha.test.ts` | Crear | Prueba de `fechaEnMazatlan`. |
| `web/src/datos.ts` | Modificar | `recordatorioPago?` y `fechaProximoPago?` en `Cliente`. |
| `web/src/pago.ts` (+ `pago.test.ts`) | Crear | Cálculo puro: días y si se muestra. GEMELO de `PagoCalculator`. |
| `web/src/ui/tarjetaRecordatorioPago.ts` (+ test) | Crear | La tarjeta como HTML. |
| `web/src/ventanas.ts` (+ test) | Modificar | La tarjeta arriba de todo en `inicio()`. |
| `web/src/estilos.css` | Modificar | Clases `.recordatorio-pago`, `.vigente`, `.vencido`. |
| `app/.../data/model/Cliente.kt` | Modificar | `recordatorioPago`. |
| `app/.../data/repository/ClienteRepository.kt` | Modificar | `actualizarRecordatorioPago`. |
| `app/.../data/repository/FirestoreClienteRepository.kt` | Modificar | Implementación con `update`. |
| `app/.../data/fake/FakeClienteRepository.kt` | Modificar | Implementación con `copy`. |
| `app/.../domain/PagoCalculator.kt` | Modificar | Solo el comentario `GEMELO`. |
| `app/.../ui/clientes/WebClienteScreen.kt` | Modificar | `WebClienteViewModel` y la fila con `Switch`. |
| `docs/backlog-2.md` | Modificar | Marcar el estado al terminar. |

`app/...` = `app/src/main/java/com/osfit/app`.

---

### Task 1: `fechaEnMazatlan` en `fecha.ts`

**Files:**
- Modify: `web/src/fecha.ts`
- Create: `web/src/fecha.test.ts`

- [ ] **Step 1: Test que falla**

`web/src/fecha.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fechaEnMazatlan } from "./fecha";

describe("fechaEnMazatlan", () => {
  it("a las 00:30 UTC todavía es el día anterior en Mazatlán (UTC-7)", () => {
    expect(fechaEnMazatlan(new Date("2026-10-09T00:30:00Z"))).toBe("2026-10-08");
  });

  it("el mediodía de Mazatlán (como guarda la app) cae en su mismo día", () => {
    expect(fechaEnMazatlan(new Date("2026-10-08T19:00:00Z"))).toBe("2026-10-08");
  });

  it("cruza el año", () => {
    expect(fechaEnMazatlan(new Date("2027-01-01T05:00:00Z"))).toBe("2026-12-31");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

```bash
cd web && npx vitest run src/fecha.test.ts
```

Esperado: falla porque `fechaEnMazatlan` no existe.

- [ ] **Step 3: Implementar**

En `web/src/fecha.ts`, refactorizar `hoyEnMazatlan` para que reutilice la nueva función:

```ts
/**
 * El día (AAAA-MM-DD) que es `fecha` en la zona del gimnasio. Lo usa el recordatorio de pago
 * para pasar `fechaProximoPago` a día: con la zona del navegador, una clienta de viaje vería un
 * vencimiento distinto del que ve el entrenador.
 */
export function fechaEnMazatlan(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/** Fecha de hoy en formato ISO (AAAA-MM-DD) según la zona del gimnasio. */
export function hoyEnMazatlan(): string {
  return fechaEnMazatlan(new Date());
}
```

- [ ] **Step 4: Correr los tests**

```bash
cd web && npx vitest run src/fecha.test.ts && npm test
```

Esperado: todo verde.

- [ ] **Step 5: Commit**

```bash
git add web/src/fecha.ts web/src/fecha.test.ts
git commit -m "feat(web): add fechaEnMazatlan helper"
```

---

### Task 2: Cálculo puro (`pago.ts`) y campos en `Cliente`

**Files:**
- Modify: `web/src/datos.ts`
- Create: `web/src/pago.ts`, `web/src/pago.test.ts`

- [ ] **Step 1: Campos nuevos en `Cliente`**

En `web/src/datos.ts`, agregar `Timestamp` al import de tipos de Firestore:

```ts
import type { FirestoreError, Timestamp } from "firebase/firestore";
```

Y al final de `interface Cliente`, después de `paletaWeb?`:

```ts
  /**
   * Si el entrenador le prendió la tarjeta "Tu periodo vence en X días". Opcional por la razón
   * de siempre: Firestore omite los campos que nunca se escribieron, y ausente es "no".
   */
  recordatorioPago?: boolean;
  /** Cuándo vence su periodo. Lo escribe la app al registrar un pago; puede no existir. */
  fechaProximoPago?: Timestamp | null;
```

- [ ] **Step 2: Tests que fallan**

`web/src/pago.test.ts`. El Timestamp se simula con un objeto que solo tiene `toDate()`, que es lo único que usa `pago.ts`; así el test no depende del SDK.

```ts
import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { Cliente } from "./datos";
import { diasParaPago, recordatorioPago } from "./pago";

const HOY = "2026-10-08";

/** Mediodía de Mazatlán (19:00 UTC), que es como `AsignarProximoPagoDialog` guarda la fecha. */
function pagoEl(dia: string): Timestamp {
  return { toDate: () => new Date(`${dia}T19:00:00Z`) } as Timestamp;
}

function cliente(campos: Partial<Cliente> = {}): Cliente {
  return {
    nombre: "Ana", activo: true, rutinaAsignada: null,
    ultimoDia: null, ultimoDiaFecha: null, ultimoDiaEsAncla: false,
    ...campos,
  };
}

describe("diasParaPago", () => {
  it("cuenta los días que faltan", () => {
    expect(diasParaPago("2026-10-10", HOY)).toBe(2);
  });

  it("es 0 el mismo día y negativo cuando ya pasó", () => {
    expect(diasParaPago(HOY, HOY)).toBe(0);
    expect(diasParaPago("2026-10-05", HOY)).toBe(-3);
  });

  it("cruza fin de mes", () => {
    expect(diasParaPago("2026-11-01", "2026-10-30")).toBe(2);
  });

  it("cruza fin de año", () => {
    expect(diasParaPago("2027-01-01", "2026-12-31")).toBe(1);
  });

  it("no se descuadra con el cambio de horario de otros países", () => {
    // Fechas UTC puras: el 1 de noviembre de 2026 EE. UU. cambia de horario.
    expect(diasParaPago("2026-11-03", "2026-10-31")).toBe(3);
  });
});

describe("recordatorioPago", () => {
  it("con el interruptor ausente no se ve, aunque falte 1 día", () => {
    expect(recordatorioPago(cliente({ fechaProximoPago: pagoEl("2026-10-09") }), HOY))
      .toEqual({ visible: false });
  });

  it("con el interruptor apagado no se ve, aunque ya haya vencido", () => {
    const c = cliente({ recordatorioPago: false, fechaProximoPago: pagoEl("2026-10-01") });
    expect(recordatorioPago(c, HOY)).toEqual({ visible: false });
  });

  it("sin fecha de pago no se ve", () => {
    expect(recordatorioPago(cliente({ recordatorioPago: true }), HOY)).toEqual({ visible: false });
    expect(recordatorioPago(cliente({ recordatorioPago: true, fechaProximoPago: null }), HOY))
      .toEqual({ visible: false });
  });

  it("con 3 días todavía no se ve", () => {
    const c = cliente({ recordatorioPago: true, fechaProximoPago: pagoEl("2026-10-11") });
    expect(recordatorioPago(c, HOY)).toEqual({ visible: false });
  });

  it.each([
    ["2026-10-10", 2],
    ["2026-10-09", 1],
    ["2026-10-08", 0],
  ])("pago el %s: visible con %i días y vigente", (dia, dias) => {
    const c = cliente({ recordatorioPago: true, fechaProximoPago: pagoEl(dia) });
    expect(recordatorioPago(c, HOY)).toEqual({ visible: true, dias, vencido: false });
  });

  it("ya vencido: visible y vencido, por más días que pasen", () => {
    const c = cliente({ recordatorioPago: true, fechaProximoPago: pagoEl("2026-09-28") });
    expect(recordatorioPago(c, HOY)).toEqual({ visible: true, dias: -10, vencido: true });
  });
});
```

- [ ] **Step 3: Correrlos y ver que fallan**

```bash
cd web && npx vitest run src/pago.test.ts
```

Esperado: falla porque `./pago` no existe.

- [ ] **Step 4: Implementar**

`web/src/pago.ts`:

```ts
import type { Cliente } from "./datos";
import { fechaEnMazatlan } from "./fecha";

/**
 * El recordatorio de pago de la página: cuántos días le quedan a su periodo y si se muestra.
 * Spec: `docs/superpowers/specs/2026-10-07-recordatorio-pago-web-design.md`.
 *
 * GEMELO: `PagoCalculator.diasParaProximoPago` en Kotlin. Si cambia allá, cambia acá.
 */

/** Se muestra con esta cantidad de días o menos. Coincide con el rojo de la lista de la app (< 3). */
const DIAS_VENTANA = 2;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Días entre `hoy` y la fecha de pago, ambas AAAA-MM-DD. Negativo = ya venció.
 *
 * Se resta como fechas UTC a medianoche: ninguna de las dos tiene hora, y así ningún cambio de
 * horario puede dejar un día de 23 horas que el redondeo convierta en cero.
 */
export function diasParaPago(fechaPago: string, hoy: string): number {
  return Math.round((Date.parse(`${fechaPago}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / MS_POR_DIA);
}

export type RecordatorioPago =
  | { visible: false }
  | { visible: true; dias: number; vencido: boolean };

export function recordatorioPago(cliente: Cliente, hoy: string): RecordatorioPago {
  if (cliente.recordatorioPago !== true || !cliente.fechaProximoPago) return { visible: false };
  const dias = diasParaPago(fechaEnMazatlan(cliente.fechaProximoPago.toDate()), hoy);
  if (dias > DIAS_VENTANA) return { visible: false };
  // El día del pago (0) sigue vigente: el periodo vence ese día, todavía no se pasó.
  return { visible: true, dias, vencido: dias < 0 };
}
```

- [ ] **Step 5: Correr los tests y el typecheck**

```bash
cd web && npx vitest run src/pago.test.ts && npm test && npx tsc --noEmit
```

Esperado: todo verde, sin errores de tipos.

- [ ] **Step 6: GEMELO del lado Kotlin**

En `app/.../domain/PagoCalculator.kt`, agregar encima de `object PagoCalculator`:

```kotlin
/**
 * GEMELO: `diasParaPago` / `recordatorioPago` en `web/src/pago.ts`. Si cambia acá, cambia allá.
 */
```

(Solo el comentario. No se cambia la lógica de la app.)

- [ ] **Step 7: Commit**

```bash
git add web/src/datos.ts web/src/pago.ts web/src/pago.test.ts app/src/main/java/com/osfit/app/domain/PagoCalculator.kt
git commit -m "feat(web): compute payment reminder visibility"
```

---

### Task 3: La tarjeta (`tarjetaRecordatorioPago.ts`) y sus estilos

**Files:**
- Create: `web/src/ui/tarjetaRecordatorioPago.ts`, `web/src/ui/tarjetaRecordatorioPago.test.ts`
- Modify: `web/src/estilos.css`

- [ ] **Step 1: Tests que fallan**

`web/src/ui/tarjetaRecordatorioPago.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tarjetaRecordatorioPago } from "./tarjetaRecordatorioPago";

describe("tarjetaRecordatorioPago", () => {
  it("no pinta nada si no es visible", () => {
    expect(tarjetaRecordatorioPago({ visible: false })).toBe("");
  });

  it.each([
    [2, "Tu periodo de entrenamiento vence en 2 días"],
    [1, "Tu periodo de entrenamiento vence en 1 día"],
    [0, "Tu periodo de entrenamiento vence hoy"],
  ])("%i días: verde, \"%s\"", (dias, frase) => {
    const html = tarjetaRecordatorioPago({ visible: true, dias, vencido: false });
    expect(html).toContain(frase);
    expect(html).toContain("recordatorio-pago vigente");
    expect(html).not.toContain("vencido");
  });

  it.each([
    [-1, "Tu periodo de entrenamiento venció hace 1 día"],
    [-5, "Tu periodo de entrenamiento venció hace 5 días"],
  ])("%i días: rojo, \"%s\"", (dias, frase) => {
    const html = tarjetaRecordatorioPago({ visible: true, dias, vencido: true });
    expect(html).toContain(frase);
    expect(html).toContain("recordatorio-pago vencido");
    expect(html).not.toContain("vigente");
  });

  it("nunca dice \"ayer\" ni \"en 0 días\"", () => {
    const todos = [2, 1, 0, -1, -2].map((dias) =>
      tarjetaRecordatorioPago({ visible: true, dias, vencido: dias < 0 })).join("");
    expect(todos).not.toContain("ayer");
    expect(todos).not.toContain("en 0");
    expect(todos).not.toContain("hace -");
  });
});
```

- [ ] **Step 2: Correrlos y ver que fallan**

```bash
cd web && npx vitest run src/ui/tarjetaRecordatorioPago.test.ts
```

- [ ] **Step 3: Implementar**

`web/src/ui/tarjetaRecordatorioPago.ts`:

```ts
import type { RecordatorioPago } from "../pago";

/**
 * La tarjeta "Tu periodo de entrenamiento vence en X días" de Inicio. Solo informa: sin botones
 * ni montos. Va verde mientras el periodo sigue vigente (incluido el día del pago) y roja cuando
 * ya venció; se queda roja hasta que el entrenador registre el pago y se mueva la fecha.
 *
 * Solo lleva números, así que no hay nada de Firestore que escapar.
 */
export function tarjetaRecordatorioPago(r: RecordatorioPago): string {
  if (!r.visible) return "";
  const clase = r.vencido ? "vencido" : "vigente";
  return `
    <div class="tarjeta recordatorio-pago ${clase}" role="status">
      <p class="recordatorio-pago-texto">${frase(r.dias)}</p>
    </div>`;
}

/** "En 0 días" y "en -3 días" se leen como un error: hoy y vencido tienen su propia frase. */
function frase(dias: number): string {
  const base = "Tu periodo de entrenamiento";
  if (dias === 0) return `${base} vence hoy`;
  if (dias > 0) return `${base} vence en ${conUnidad(dias)}`;
  return `${base} venció hace ${conUnidad(-dias)}`;
}

function conUnidad(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}
```

- [ ] **Step 4: Estilos**

En `web/src/estilos.css`, justo después de las reglas de `.tarjeta` / `.tarjeta-titulo`:

```css
/* Recordatorio de pago. Usa --verde y --rojo para que cada estilo (neón, cómic, pixel, sakura,
   minimalista) lo tiña con los suyos sin reglas extra. */
.recordatorio-pago { color: #fff; }
.recordatorio-pago.vigente { background: var(--verde); }
.recordatorio-pago.vencido { background: var(--rojo); }
.recordatorio-pago-texto { margin: 0; font-weight: 700; font-size: 16px; line-height: 1.3; }
```

Revisar en el navegador (Task 6) que en **neón** (`--verde: #3dff8e`, muy claro) el texto blanco se lea. Si no se lee, agregar en `estiloNeon.css`:

```css
.recordatorio-pago.vigente { color: #0b0b0b; }
```

- [ ] **Step 5: Correr los tests**

```bash
cd web && npm test
```

- [ ] **Step 6: Commit**

```bash
git add web/src/ui/tarjetaRecordatorioPago.ts web/src/ui/tarjetaRecordatorioPago.test.ts web/src/estilos.css web/src/estiloNeon.css
git commit -m "feat(web): add payment reminder card"
```

---

### Task 4: Ponerla arriba de todo en Inicio

**Files:**
- Modify: `web/src/ventanas.ts`, `web/src/ventanas.test.ts`

- [ ] **Step 1: Tests que fallan**

En `web/src/ventanas.test.ts`, dentro de `describe("la ventana Inicio", …)`, agregar (la fecha se simula igual que en `pago.test.ts`; importar `Timestamp` como tipo):

```ts
  it("el recordatorio de pago va arriba de todo, antes de la tarjeta del día", () => {
    const conRecordatorio = {
      ...cliente,
      recordatorioPago: true,
      fechaProximoPago: { toDate: () => new Date("2026-09-19T19:00:00Z") } as Timestamp,
    } as Cliente;
    const h = contenidoDe(ventana("inicio"), datos({ cliente: conRecordatorio }));
    const aviso = h.indexOf("Tu periodo de entrenamiento vence en 1 día");
    const dia = h.indexOf("Todavía no tienes rutina");
    expect(aviso).toBeGreaterThan(-1);
    expect(aviso).toBeLessThan(dia);
  });

  it("sin el interruptor no aparece", () => {
    expect(html).not.toContain("recordatorio-pago");
  });
```

Import nuevo al inicio del archivo:

```ts
import type { Timestamp } from "firebase/firestore";
```

- [ ] **Step 2: Correrlos y ver que falla el primero**

```bash
cd web && npx vitest run src/ventanas.test.ts
```

- [ ] **Step 3: Implementar**

En `web/src/ventanas.ts`, imports:

```ts
import { recordatorioPago } from "./pago";
import { tarjetaRecordatorioPago } from "./ui/tarjetaRecordatorioPago";
```

En `inicio()`, primera línea del `return`, y ajustar el comentario de la función:

```ts
/**
 * Lo que hoy es "hoy": el recordatorio de pago (si toca), el día con sus dos acciones, la
 * racha, revivirla y el calendario, en ese orden. El recordatorio va primero porque es lo único
 * de la página con fecha límite; abajo del calendario nadie lo vería. Cada acción vive junto al
 * dato del que habla: cambiar el día y avisar que hoy no se puede van dentro de la tarjeta del
 * día; revivir la racha va debajo de la racha.
 */
function inicio(d: DatosCliente): string {
  ...
  return `
      ${tarjetaRecordatorioPago(recordatorioPago(d.cliente, d.hoy))}
      ${tarjetaDia(d.cliente, d.hoy, acciones, d.asistencias)}
      ...
```

No hace falta tocar `main.ts`: `d.cliente` ya llega en vivo desde `observarCliente`, así que prender o apagar el interruptor repinta solo.

- [ ] **Step 4: Correr todo**

```bash
cd web && npm test && npm run build
```

Esperado: tests verdes y build sin errores.

- [ ] **Step 5: Commit**

```bash
git add web/src/ventanas.ts web/src/ventanas.test.ts
git commit -m "feat(web): show payment reminder at the top of Inicio"
```

---

### Task 5: App — campo, repositorio e interruptor en la pantalla Web

**Files:**
- Modify: `app/.../data/model/Cliente.kt`, `app/.../data/repository/ClienteRepository.kt`, `app/.../data/repository/FirestoreClienteRepository.kt`, `app/.../data/fake/FakeClienteRepository.kt`, `app/.../ui/clientes/WebClienteScreen.kt`

- [ ] **Step 1: Modelo**

En `Cliente.kt`, después de `tieneAccesoWeb`, agregando la coma en la línea anterior:

```kotlin
    // Si la web le muestra la tarjeta "Tu periodo vence en X días". Apagado por defecto: el
    // entrenador lo prende solo para las clientas a las que quiere recordarles el pago.
    val recordatorioPago: Boolean = false
```

- [ ] **Step 2: Repositorio**

En `ClienteRepository.kt`, junto a `actualizarActivo`:

```kotlin
    /** Prende o apaga la tarjeta de recordatorio de pago en la web de la clienta. */
    suspend fun actualizarRecordatorioPago(clienteId: String, activo: Boolean)
```

En `FirestoreClienteRepository.kt`, después de `actualizarActivo`:

```kotlin
    override suspend fun actualizarRecordatorioPago(clienteId: String, activo: Boolean) {
        coleccion.document(clienteId).update("recordatorioPago", activo).await()
    }
```

En `FakeClienteRepository.kt`, después de `actualizarActivo`:

```kotlin
    override suspend fun actualizarRecordatorioPago(clienteId: String, activo: Boolean) {
        actualizarCliente(clienteId) { it.copy(recordatorioPago = activo) }
    }
```

Buscar otras implementaciones de `ClienteRepository` (fakes de tests incluidos) que dejen de compilar:

```bash
grep -rln ": ClienteRepository" app/src
```

y agregarles el mismo método.

- [ ] **Step 3: ViewModel**

En `WebClienteScreen.kt`, arriba del composable, siguiendo el patrón de `PaletaWebClienteViewModel`:

```kotlin
class WebClienteViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository
) : ViewModel() {

    private val _cliente = MutableStateFlow<Cliente?>(null)
    val cliente: StateFlow<Cliente?> = _cliente

    init {
        viewModelScope.launch {
            // Un error de red deja el interruptor apagado y deshabilitado (cliente null); el
            // resto de la pantalla, que solo navega, se sigue pudiendo usar.
            clienteRepository.observarCliente(clienteId)
                .catch { }
                .collect { _cliente.value = it }
        }
    }

    fun cambiarRecordatorioPago(activo: Boolean) {
        // Optimista, como la paleta: el interruptor se mueve al tocar y el listener confirma.
        _cliente.value = _cliente.value?.copy(recordatorioPago = activo)
        viewModelScope.launch {
            runCatching { clienteRepository.actualizarRecordatorioPago(clienteId, activo) }
        }
    }
}
```

- [ ] **Step 4: La fila con el `Switch`**

En `WebClienteScreen`, obtener el ViewModel y el estado:

```kotlin
    val viewModel: WebClienteViewModel = viewModel(
        factory = viewModelFactory { initializer { WebClienteViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
```

Después del `items(secciones.chunked(2)) { … }`, agregar:

```kotlin
            // No es una sección de la rejilla: un sí/no no navega a ningún lado.
            item {
                FilaRecordatorioPago(
                    activo = cliente?.recordatorioPago == true,
                    tieneFechaPago = cliente?.fechaProximoPago != null,
                    habilitado = cliente != null,
                    onCambiar = viewModel::cambiarRecordatorioPago
                )
            }
```

Y el composable privado al final del archivo:

```kotlin
@Composable
private fun FilaRecordatorioPago(
    activo: Boolean,
    tieneFechaPago: Boolean,
    habilitado: Boolean,
    onCambiar: (Boolean) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(Icons.Filled.Notifications, contentDescription = null)
            Column(modifier = Modifier.weight(1f)) {
                Text("Recordatorios de pago", style = MaterialTheme.typography.titleMedium)
                Text(
                    // Sin fecha, prenderlo no muestra nada; se dice para que no parezca roto.
                    if (tieneFechaPago) "Muestra en su inicio cuántos días le quedan cuando faltan 2 o menos."
                    else "Sin fecha de pago registrada: no se mostrará nada todavía.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Switch(checked = activo, onCheckedChange = onCambiar, enabled = habilitado)
        }
    }
}
```

Imports nuevos: `androidx.compose.foundation.layout.Column`, `androidx.compose.material.icons.filled.Notifications`, `androidx.compose.material3.Card`, `androidx.compose.material3.Icon`, `androidx.compose.material3.Switch`, `androidx.compose.runtime.collectAsState`, `androidx.compose.runtime.getValue`, `androidx.compose.ui.Alignment`, `androidx.lifecycle.ViewModel`, `androidx.lifecycle.viewModelScope`, `androidx.lifecycle.viewmodel.compose.viewModel`, `androidx.lifecycle.viewmodel.initializer`, `androidx.lifecycle.viewmodel.viewModelFactory`, `com.osfit.app.data.AppContainer`, `com.osfit.app.data.model.Cliente`, `com.osfit.app.data.repository.ClienteRepository`, `kotlinx.coroutines.flow.MutableStateFlow`, `kotlinx.coroutines.flow.StateFlow`, `kotlinx.coroutines.flow.catch`, `kotlinx.coroutines.launch`.

- [ ] **Step 5: Ajustar el comentario de cabecera**

El KDoc de `WebClienteScreen` dice que todo lo nuevo entra por `seccionesWeb`. Agregar al final:

```kotlin
 *
 * La excepción es el interruptor de recordatorio de pago: es un sí/no que se cambia ahí mismo y
 * no abre ninguna pantalla, así que va como fila aparte debajo de la rejilla.
```

- [ ] **Step 6: Compilar y correr los tests**

```bash
./gradlew test assembleDebug
```

Esperado: compila y los tests existentes siguen verdes. Si falta `local.properties` o `app/google-services.json`, ver `README.md` → "Configuración local". Si no se pueden conseguir en la sesión, decirlo y dejar la compilación para el entrenador.

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app
git commit -m "feat(app): add per-client payment reminder switch in Web screen"
```

---

### Task 6: Verificación de punta a punta y cierre

- [ ] **Step 1: Web en local**

```bash
cd web && npm run dev
```

Con una clienta de prueba y su link `/c/<token>`, revisar en el navegador:

1. Interruptor apagado → no aparece nada.
2. Prenderlo desde la app con fecha de pago en 3 días → sigue sin aparecer.
3. Mover la fecha a 2 días, 1 día y hoy → verde, con las tres frases. Aparece **sin recargar**.
4. Mover la fecha a ayer y a hace 5 días → rojo, "venció hace 1 día" / "venció hace 5 días".
5. Registrar el pago → la tarjeta desaparece sola.
6. Cambiar el estilo de la página (clásico, neón, cómic, pixel, sakura, minimalista) → el texto se lee en todos (ver la nota de neón en la Task 3).

- [ ] **Step 2: App en el teléfono**

```bash
./gradlew installDebug
```

Abrir una clienta → Web → el interruptor aparece debajo de la rejilla, apagado. Prenderlo y apagarlo. Con una clienta sin fecha de pago, la descripción cambia al texto de "Sin fecha de pago registrada".

- [ ] **Step 3: Backlog**

En `docs/backlog-2.md`, entrada 2, cambiar `Pendiente: ejecutar el plan.` por:

```
Pendiente: desplegar la web (pedir confirmación al entrenador) e instalar la app.
```

- [ ] **Step 4: Commit y push**

```bash
git add docs/backlog-2.md
git commit -m "docs: mark payment reminder as implemented in backlog 2"
git push
```

- [ ] **Step 5: Desplegar (solo con confirmación)**

Preguntar al entrenador antes de desplegar. Con su sí:

```bash
cd web && npm run build && cd .. && firebase deploy --only hosting
```

No se despliegan reglas ni funciones: no cambiaron.
