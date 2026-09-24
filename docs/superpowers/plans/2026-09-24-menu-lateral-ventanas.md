# Menú lateral y ventanas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partir la web de la clienta en ventanas (Inicio, Ranking, Medallas, Logros personales, Videos, Ajustes) a las que se entra desde un menú lateral con botón ☰.

**Architecture:** Un registro puro (`ventanas.ts`) declara cada ventana y su función de pintado. `navegacion.ts` guarda la ventana activa y el menú abierto fuera de `pintar()` y los sincroniza con `history.state` sin tocar la URL. `ui/menuLateral.ts` genera la cabecera y el panel a partir del registro. `main.ts` deja de tener la lista fija de tarjetas y pinta la ventana activa.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 5 (sin jsdom: los tests prueban strings HTML y lógica pura), Firebase web SDK 12.

**Spec:** `docs/superpowers/specs/2026-09-24-menu-lateral-ventanas-design.md`

Todos los comandos corren en `web/` (`C:\Users\SISTEMAS-03\Desktop\OSfit\web`). Línea base: `npx vitest run` → 19 archivos, 214 tests en verde.

## Global Constraints

- La ventana activa **nunca** va en la URL: no se toca `location.hash` ni la ruta (`firebase.ts` lee el `#` como token heredado y `resolverSesion` usa la ruta).
- `navegacion.ts` es el único módulo que toca `history`, y lo recibe inyectado.
- El historial nunca pasa de `[Inicio, ventana]` más, como mucho, la entrada del menú abierto.
- Recargar siempre cae en Inicio; el `replaceState(null)` inicial va **después** de resolver la sesión.
- Saludo, `#videos` y `#ruleta` viven fuera de `#contenido`; `pintar()` no los recrea.
- Los 8 listeners de Firestore siguen vivos en todas las ventanas.
- Orden del menú: Inicio, Ranking, Medallas, Logros personales, Videos; Ajustes solo, al fondo del panel.
- Ranking y Ajustes: `proximamente: true`, se pueden abrir, muestran "Muy pronto" y en el menú llevan la etiqueta "Pronto".
- Área táctil mínima 44×44 px; el ☰ lleva `aria-label="Abrir menú"`.
- Colores: solo variables de la paleta (`--primario`, `--superficie`, …); el esqueleto de carga solo usa grises neutros.
- `prefers-reduced-motion: reduce` → el panel aparece sin transición.
- Comentarios y nombres en español, con la densidad de comentarios de los archivos vecinos.

## Review Focus

1. **Un snapshot de Firestore llega con la clienta en Medallas** (el entrenador marca una asistencia): debe quedarse en Medallas. Lo cubre que el estado viva en `navegacion.ts`. Se verifica a mano en la Task 5.
2. **Toques rápidos mientras un `history.back()` todavía no responde** (cerrar el menú y volver a abrirlo al instante): no debe quedar una entrada de menú huérfana. Test en la Task 2 ("ignora toques mientras espera el popstate").
3. **Recarga sobre una entrada empujada** (el navegador conserva `history.state = {ventana:"medallas"}`): debe caer en Inicio. Test en la Task 2.
4. **Un video reproduciéndose al cambiar de ventana**: se pausa, conserva su posición y no se vuelve a descargar. Verificación manual en la Task 5.
5. **Nombre de la clienta con caracteres HTML** (`<`, `&`) en el panel del menú: se escapa. Test en la Task 3.

---

### Task 1: Registro de ventanas

**Files:**
- Create: `web/src/ventanas.ts`
- Test: `web/src/ventanas.test.ts`

**Interfaces:**
- Consumes: `tarjetaDia(cliente, hoy, acciones, asistencias)` (`ui/tarjetaDia.ts`), `tarjetasStats(asistencias, hoy)`, `accionDia(cliente, hoy, yaAsistioHoy)`, `hojaDeMotivosAbierta()`, `accionHoyNoPuedo(cliente, hoy, yaAviso)`, `tarjetaRevivir(cliente, hoy, asistencias, tiradaEsteMes, tiradaMesAnterior)`, `calendario(asistencias, mes, hoy)`, `seccionVacia(titulo, emoji, que, quien)`, `tarjetaMedallas(medallas)`, `tarjetaLogrosPersonales(logros)`.
- Produces:
  - `type IdVentana = "inicio" | "ranking" | "medallas" | "logros" | "videos" | "ajustes"`
  - `interface DatosCliente { cliente: Cliente; hoy: string; asistencias: Asistencia[]; mesVisible: string; yaAviso: boolean; medallas: MedallaOtorgada[]; logros: LogroPersonalOtorgado[]; tiradaEsteMes: Tirada | null; tiradaMesAnterior: Tirada | null }`
  - `interface Ventana { id: IdVentana; titulo: string; icono: string; grupo: "principal" | "pie"; proximamente?: boolean; pintar?: (d: DatosCliente) => string; contenedorPropio?: "videos" }`
  - `const VENTANAS: readonly Ventana[]`
  - `function ventana(id: IdVentana): Ventana`: el id desconocido cae en Inicio.
  - `function contenidoDe(v: Ventana, d: DatosCliente): string`

- [ ] **Step 1: Escribir el test que falla**

`web/src/ventanas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Asistencia, Cliente } from "./datos";
import { VENTANAS, contenidoDe, ventana, type DatosCliente, type IdVentana } from "./ventanas";

const HOY = "2026-09-18"; // viernes

/** Sin rutina: la tarjeta del día pinta su estado vacío, que sirve de marca para el orden. */
const cliente = { nombre: "Ana", activo: true, rutinaAsignada: null, ultimoDia: null,
  ultimoDiaFecha: null, ultimoDiaEsAncla: false } as Cliente;

/** La falta del jueves 17 rompe la racha y es reparable: así aparece la tarjeta de revivir. */
const conFaltaRota: Asistencia[] = [
  { fecha: "2026-09-01", asistio: true, justificada: false },
  { fecha: "2026-09-17", asistio: false, justificada: false },
];

function datos(campos: Partial<DatosCliente> = {}): DatosCliente {
  return {
    cliente, hoy: HOY, asistencias: conFaltaRota, mesVisible: "2026-09", yaAviso: false,
    medallas: [], logros: [], tiradaEsteMes: null, tiradaMesAnterior: null, ...campos,
  };
}

describe("el registro de ventanas", () => {
  it("tiene ids únicos", () => {
    const ids = VENTANAS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("va Inicio, Ranking, Medallas, Logros, Videos y Ajustes al final", () => {
    expect(VENTANAS.map((v) => v.id)).toEqual(
      ["inicio", "ranking", "medallas", "logros", "videos", "ajustes"]
    );
  });

  it("Ajustes es la única del pie", () => {
    expect(VENTANAS.filter((v) => v.grupo === "pie").map((v) => v.id)).toEqual(["ajustes"]);
  });

  it("Ranking y Ajustes son las que están por venir", () => {
    expect(VENTANAS.filter((v) => v.proximamente).map((v) => v.id)).toEqual(["ranking", "ajustes"]);
  });

  it("toda ventana tiene con qué pintarse", () => {
    for (const v of VENTANAS) {
      expect(Boolean(v.pintar || v.contenedorPropio || v.proximamente), v.id).toBe(true);
    }
  });

  it("un id desconocido cae en Inicio", () => {
    expect(ventana("nada" as IdVentana).id).toBe("inicio");
  });
});

describe("la ventana Inicio", () => {
  const html = contenidoDe(ventana("inicio"), datos());

  it("va día, racha, revivir y calendario, en ese orden", () => {
    const dia = html.indexOf("Todavía no tienes rutina");
    const racha = html.indexOf("Tu racha");
    const revivir = html.indexOf("Revivir mi racha");
    const cal = html.indexOf(`id="mes-anterior"`);
    expect([dia, racha, revivir, cal].every((i) => i > -1)).toBe(true);
    expect(dia).toBeLessThan(racha);
    expect(racha).toBeLessThan(revivir);
    expect(revivir).toBeLessThan(cal);
  });

  it("ya no trae medallas, logros ni videos", () => {
    expect(html).not.toContain("Tus medallas");
    expect(html).not.toContain("Tus logros personales");
    expect(html).not.toContain("Tus videos de resumen");
  });
});

describe("las demás ventanas", () => {
  it("Medallas y Logros pintan su tarjeta", () => {
    expect(contenidoDe(ventana("medallas"), datos())).toContain("Tus medallas");
    expect(contenidoDe(ventana("logros"), datos())).toContain("Tus logros personales");
  });

  it("las que están por venir dicen Muy pronto", () => {
    expect(contenidoDe(ventana("ranking"), datos())).toContain("Muy pronto");
    expect(contenidoDe(ventana("ajustes"), datos())).toContain("Muy pronto");
  });

  it("Videos no pinta nada en #contenido: vive en su propio contenedor", () => {
    expect(contenidoDe(ventana("videos"), datos())).toBe("");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npx vitest run src/ventanas.test.ts`
Expected: FAIL, "Failed to resolve import ./ventanas".

- [ ] **Step 3: Implementar el registro**

`web/src/ventanas.ts`:

```ts
import type { Asistencia, Cliente, LogroPersonalOtorgado, MedallaOtorgada } from "./datos";
import type { Tirada } from "./tirada";
import { tarjetaDia } from "./ui/tarjetaDia";
import { tarjetasStats } from "./ui/tarjetasStats";
import { accionDia, hojaDeMotivosAbierta } from "./ui/accionDia";
import { accionHoyNoPuedo, tarjetaRevivir } from "./ui/accionFalta";
import { calendario } from "./ui/calendario";
import { seccionVacia, tarjetaLogrosPersonales, tarjetaMedallas } from "./ui/tarjetaInsignias";

/**
 * Las ventanas de la página y lo que pinta cada una.
 *
 * Es el único lugar que dice qué ventanas existen: el menú lateral se arma de esta lista y
 * `pintar()` en `main.ts` solo pregunta cuál está activa. Agregar una ventana es sumar su id
 * al tipo y una entrada a `VENTANAS`; si necesita datos nuevos, un campo en `DatosCliente` y
 * su listener en `main.ts`. Ver `docs/superpowers/specs/2026-09-24-menu-lateral-ventanas-design.md`.
 */

export type IdVentana = "inicio" | "ranking" | "medallas" | "logros" | "videos" | "ajustes";

/** Todo lo que los listeners de Firestore tienen a mano en cada repintado. */
export interface DatosCliente {
  cliente: Cliente;
  hoy: string;
  asistencias: Asistencia[];
  mesVisible: string;
  yaAviso: boolean;
  medallas: MedallaOtorgada[];
  logros: LogroPersonalOtorgado[];
  tiradaEsteMes: Tirada | null;
  tiradaMesAnterior: Tirada | null;
}

export interface Ventana {
  id: IdVentana;
  titulo: string;
  icono: string;
  /** `pie` se pega al fondo del menú, separado del resto. */
  grupo: "principal" | "pie";
  /** Se puede abrir, pero todavía muestra "Muy pronto". */
  proximamente?: boolean;
  /** Lo que va dentro de `#contenido`. */
  pintar?: (d: DatosCliente) => string;
  /**
   * La ventana vive en un contenedor fuera del repintado. Hoy solo los videos: el `<video>`
   * tiene estado propio que `innerHTML` destruiría (ver `pintarVideos` en `main.ts`).
   */
  contenedorPropio?: "videos";
}

/**
 * Lo que hoy es "hoy": el día con sus dos acciones, la racha, revivirla y el calendario, en
 * ese orden. Cada acción vive junto al dato del que habla: cambiar el día y avisar que hoy no
 * se puede van dentro de la tarjeta del día; revivir la racha va debajo de la racha.
 */
function inicio(d: DatosCliente): string {
  const yaAsistioHoy = d.asistencias.some((a) => a.fecha === d.hoy && a.asistio);
  const acciones = `
      ${accionDia(d.cliente, d.hoy, yaAsistioHoy)}
      ${hojaDeMotivosAbierta() ? "" : accionHoyNoPuedo(d.cliente, d.hoy, d.yaAviso)}`;
  return `
      ${tarjetaDia(d.cliente, d.hoy, acciones, d.asistencias)}
      ${tarjetasStats(d.asistencias, d.hoy)}
      ${tarjetaRevivir(d.cliente, d.hoy, d.asistencias, d.tiradaEsteMes, d.tiradaMesAnterior)}
      ${calendario(d.asistencias, d.mesVisible, d.hoy)}
    `;
}

export const VENTANAS: readonly Ventana[] = [
  { id: "inicio", titulo: "Inicio", icono: "🏠", grupo: "principal", pintar: inicio },
  { id: "ranking", titulo: "Ranking", icono: "🏆", grupo: "principal", proximamente: true },
  {
    id: "medallas", titulo: "Medallas", icono: "🏅", grupo: "principal",
    pintar: (d) => tarjetaMedallas(d.medallas),
  },
  {
    id: "logros", titulo: "Logros personales", icono: "⭐", grupo: "principal",
    pintar: (d) => tarjetaLogrosPersonales(d.logros),
  },
  { id: "videos", titulo: "Videos", icono: "🎬", grupo: "principal", contenedorPropio: "videos" },
  { id: "ajustes", titulo: "Ajustes", icono: "⚙️", grupo: "pie", proximamente: true },
];

/** Un id que no está en el registro (un `history.state` viejo, por ejemplo) cae en Inicio. */
export function ventana(id: IdVentana): Ventana {
  return VENTANAS.find((v) => v.id === id) ?? VENTANAS[0];
}

/** Lo que va en `#contenido`. Vacío para las ventanas con contenedor propio. */
export function contenidoDe(v: Ventana, d: DatosCliente): string {
  if (v.pintar) return v.pintar(d);
  if (v.proximamente) {
    return seccionVacia(v.titulo, v.icono, "Muy pronto", "Estamos preparando esta sección.");
  }
  return "";
}
```

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run src/ventanas.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/ventanas.ts web/src/ventanas.test.ts
git commit -m "feat(web): registro de ventanas con lo que pinta cada una"
```

---

### Task 2: Navegación con "atrás"

**Files:**
- Create: `web/src/navegacion.ts`
- Test: `web/src/navegacion.test.ts`

**Interfaces:**
- Consumes: `type IdVentana` de `./ventanas` (solo tipo).
- Produces:
  - `interface Historial { readonly state: unknown; pushState(estado: unknown): void; replaceState(estado: unknown): void; back(): void; alRetroceder(escucha: () => void): void }`
  - `iniciarNavegacion(h: Historial, alCambiar: () => void): void`
  - `ventanaActiva(): IdVentana`
  - `menuAbierto(): boolean`
  - `abrirVentana(id: IdVentana): void`
  - `abrirMenu(): void`
  - `cerrarMenu(): void`
  - `historialDelNavegador(): Historial`

- [ ] **Step 1: Escribir el test que falla**

`web/src/navegacion.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  abrirMenu, abrirVentana, cerrarMenu, iniciarNavegacion, menuAbierto, ventanaActiva,
  type Historial,
} from "./navegacion";

/**
 * `history` de mentira. Igual que el navegador, `back()` no avisa en el acto: el `popstate`
 * llega en otra vuelta del bucle. `soltar()` lo entrega, y es donde se ve si la lógica
 * aguanta ese hueco.
 */
function historialFalso(inicial: unknown = null) {
  const pila: unknown[] = [inicial];
  let i = 0;
  let pendientes = 0;
  let escucha: () => void = () => {};
  const h: Historial & { pila(): unknown[]; soltar(): void; atras(): void } = {
    get state() { return pila[i]; },
    pushState(e) { pila.splice(i + 1); pila.push(e); i++; },
    replaceState(e) { pila[i] = e; },
    back() { if (i > 0) { i--; pendientes++; } },
    alRetroceder(f) { escucha = f; },
    pila: () => pila.slice(0, i + 1),
    soltar() { while (pendientes > 0) { pendientes--; escucha(); } },
    /** El botón "atrás" del teléfono. */
    atras() { h.back(); h.soltar(); },
  };
  return h;
}

let h: ReturnType<typeof historialFalso>;
let avisos: number;

beforeEach(() => {
  h = historialFalso();
  avisos = 0;
  iniciarNavegacion(h, () => { avisos++; });
});

describe("arranque", () => {
  it("empieza en Inicio con el menú cerrado", () => {
    expect(ventanaActiva()).toBe("inicio");
    expect(menuAbierto()).toBe(false);
  });

  it("una recarga sobre una ventana empujada cae en Inicio y limpia el estado heredado", () => {
    const heredado = historialFalso({ ventana: "medallas" });
    iniciarNavegacion(heredado, () => {});
    expect(ventanaActiva()).toBe("inicio");
    expect(heredado.state).toBeNull();
  });
});

describe("entre ventanas", () => {
  it("abrir una desde Inicio empuja una entrada", () => {
    abrirVentana("medallas");
    expect(ventanaActiva()).toBe("medallas");
    expect(h.pila()).toEqual([null, { ventana: "medallas" }]);
    expect(avisos).toBe(1);
  });

  it("saltar de una a otra reemplaza, así atrás siempre vuelve a Inicio", () => {
    abrirVentana("medallas");
    abrirVentana("videos");
    expect(h.pila()).toEqual([null, { ventana: "videos" }]);
    h.atras();
    expect(ventanaActiva()).toBe("inicio");
  });

  it("abrir la que ya está activa no toca el historial", () => {
    abrirVentana("medallas");
    abrirVentana("medallas");
    expect(h.pila()).toEqual([null, { ventana: "medallas" }]);
  });
});

describe("el menú", () => {
  it("atrás con el menú abierto solo cierra el menú", () => {
    abrirVentana("medallas");
    abrirMenu();
    expect(menuAbierto()).toBe(true);
    h.atras();
    expect(menuAbierto()).toBe(false);
    expect(ventanaActiva()).toBe("medallas");
  });

  it("cerrarlo con la ✕ retira su entrada", () => {
    abrirMenu();
    cerrarMenu();
    expect(menuAbierto()).toBe(false); // el panel se cierra sin esperar al popstate
    h.soltar();
    expect(h.pila()).toEqual([null]);
  });

  it("elegir una ventana desde Inicio no deja la entrada del menú", () => {
    abrirMenu();
    abrirVentana("logros");
    h.soltar();
    expect(ventanaActiva()).toBe("logros");
    expect(h.pila()).toEqual([null, { ventana: "logros" }]);
  });

  it("desde Medallas, menú → Videos deja [Inicio, Videos]", () => {
    abrirVentana("medallas");
    abrirMenu();
    abrirVentana("videos");
    h.soltar();
    expect(ventanaActiva()).toBe("videos");
    expect(h.pila()).toEqual([null, { ventana: "videos" }]);
  });

  it("desde Medallas, menú → Inicio deja [Inicio]", () => {
    abrirVentana("medallas");
    abrirMenu();
    abrirVentana("inicio");
    h.soltar();
    expect(ventanaActiva()).toBe("inicio");
    expect(h.pila()).toEqual([null]);
  });

  it("elegir la ventana activa solo cierra el menú", () => {
    abrirVentana("medallas");
    abrirMenu();
    abrirVentana("medallas");
    h.soltar();
    expect(menuAbierto()).toBe(false);
    expect(h.pila()).toEqual([null, { ventana: "medallas" }]);
  });

  it("ignora toques mientras espera el popstate", () => {
    abrirMenu();
    cerrarMenu();
    abrirMenu(); // antes de que llegue el popstate del cierre
    abrirVentana("ranking");
    h.soltar();
    expect(menuAbierto()).toBe(false);
    expect(ventanaActiva()).toBe("inicio");
    expect(h.pila()).toEqual([null]);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npx vitest run src/navegacion.test.ts`
Expected: FAIL, "Failed to resolve import ./navegacion".

- [ ] **Step 3: Implementar la navegación**

`web/src/navegacion.ts`:

```ts
import type { IdVentana } from "./ventanas";

/**
 * Qué ventana está abierta y si el menú lateral también, sincronizado con el botón "atrás".
 *
 * El estado vive acá y no en `pintar()`, por lo mismo que el de las acciones: `pintar()`
 * corre en cada snapshot de Firestore, y una ventana guardada ahí regresaría a la clienta a
 * Inicio cada vez que el entrenador marcara una asistencia.
 *
 * La ventana va en `history.state` y NUNCA en la dirección. El `#` ya está tomado:
 * `firebase.ts` lo lee como el token que se escondía ahí antes, así que un `#medallas` se
 * canjearía como token. La ruta tampoco, porque `resolverSesion` decide con ella si hay que
 * canjear. Con la URL quieta, la sesión no se entera de que existen ventanas.
 *
 * El historial nunca pasa de `[Inicio, ventana]`, más la entrada del menú mientras está
 * abierto: así "atrás" desde cualquier ventana vuelve a Inicio y no recorre todo lo visitado.
 *
 * Es el único módulo que toca `history`, y lo recibe inyectado para poder probarlo.
 */

/** Lo que se usa de `window.history`. */
export interface Historial {
  readonly state: unknown;
  pushState(estado: unknown): void;
  replaceState(estado: unknown): void;
  back(): void;
  alRetroceder(escucha: () => void): void;
}

let historial: Historial | null = null;
let avisar: () => void = () => {};
let activa: IdVentana = "inicio";
let menu = false;
/** La ventana elegida en el menú, que se abre en cuanto el menú termine de cerrarse. */
let pendiente: IdVentana | null = null;
/**
 * Hay un `back()` en vuelo. `history.back()` es asíncrono: hasta que llega su `popstate`, un
 * `pushState` se metería en medio y dejaría una entrada de menú huérfana. Mientras tanto se
 * ignoran los toques; el hueco dura milisegundos.
 */
let esperando = false;

function leer(estado: unknown): { ventana: IdVentana; menu: boolean } {
  const e = (estado ?? {}) as { ventana?: unknown; menu?: unknown };
  return {
    ventana: typeof e.ventana === "string" ? (e.ventana as IdVentana) : "inicio",
    menu: e.menu === true,
  };
}

/** Ir a una ventana con el menú ya cerrado. */
function irA(id: IdVentana): void {
  if (!historial || id === activa) return;
  if (id === "inicio") {
    // Volver es retroceder, no empujar: así no se acumulan entradas.
    esperando = true;
    historial.back();
    return;
  }
  if (activa === "inicio") historial.pushState({ ventana: id });
  else historial.replaceState({ ventana: id });
  activa = id;
}

function alRetroceder(): void {
  esperando = false;
  const e = leer(historial?.state);
  activa = e.ventana;
  menu = e.menu;
  const p = pendiente;
  pendiente = null;
  if (p !== null) irA(p);
  avisar();
}

/**
 * Se llama una vez resuelta la sesión, no antes: el `replaceState` borra `history.state`, y
 * la pantalla del candado lo lee para su diagnóstico (`h+/-`).
 */
export function iniciarNavegacion(h: Historial, alCambiar: () => void): void {
  // Algunos navegadores conservan `history.state` al recargar: sin esto, una recarga sobre
  // Medallas dejaría una entrada de más y el primer "atrás" no haría nada visible.
  h.replaceState(null);
  if (historial !== h) h.alRetroceder(alRetroceder);
  historial = h;
  avisar = alCambiar;
  activa = "inicio";
  menu = false;
  pendiente = null;
  esperando = false;
}

export function ventanaActiva(): IdVentana {
  return activa;
}

export function menuAbierto(): boolean {
  return menu;
}

export function abrirVentana(id: IdVentana): void {
  if (!historial || esperando) return;
  if (menu) {
    // Primero se retira la entrada del menú y después se navega, así esa entrada nunca queda
    // en el historial, se haya abierto desde Inicio o desde otra ventana. El panel se cierra
    // ya, sin esperar al `popstate`, para que el toque se sienta atendido.
    menu = false;
    pendiente = id;
    esperando = true;
    historial.back();
    avisar();
    return;
  }
  irA(id);
  avisar();
}

export function abrirMenu(): void {
  if (!historial || esperando || menu) return;
  // Con su propia entrada, "atrás" cierra el menú en vez de sacarla de la página.
  historial.pushState({ ventana: activa, menu: true });
  menu = true;
  avisar();
}

export function cerrarMenu(): void {
  if (!historial || esperando || !menu) return;
  menu = false;
  esperando = true;
  historial.back();
  avisar();
}

/** El `history` de verdad, con la forma que pide `iniciarNavegacion`. */
export function historialDelNavegador(): Historial {
  // Cada ventana arranca arriba; que el navegador restaure el scroll de otra sería un salto.
  history.scrollRestoration = "manual";
  return {
    get state() { return history.state; },
    pushState: (e) => history.pushState(e, ""),
    replaceState: (e) => history.replaceState(e, ""),
    back: () => history.back(),
    alRetroceder: (f) => window.addEventListener("popstate", f),
  };
}
```

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run src/navegacion.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/navegacion.ts web/src/navegacion.test.ts
git commit -m "feat(web): navegación entre ventanas con el botón atrás, sin tocar la URL"
```

---

### Task 3: Cabecera y panel del menú

**Files:**
- Create: `web/src/ui/menuLateral.ts`
- Test: `web/src/ui/menuLateral.test.ts`
- Modify: `web/src/estilos.css` (agregar al final)

**Interfaces:**
- Consumes: `VENTANAS`, `type Ventana`, `type IdVentana` (Task 1); `escapar` (`ui/tarjetaDia.ts`).
- Produces:
  - `cabecera(saludoHtml: string): string`: el ☰, el saludo y el título de la ventana (oculto).
  - `conectarCabecera(abrirMenu: () => void): void`: se llama una sola vez.
  - `actualizarCabecera(titulo: string | null): void`: `null` = Inicio, muestra el saludo.
  - `panelMenu(ventanas: readonly Ventana[], activa: IdVentana, nombre: string): string`
  - `conectarMenu(acciones: { abrirVentana: (id: IdVentana) => void; cerrarMenu: () => void }): void`
  - `aplicarMenuAbierto(abierto: boolean): void`

- [ ] **Step 1: Escribir el test que falla**

`web/src/ui/menuLateral.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VENTANAS } from "../ventanas";
import { cabecera, panelMenu } from "./menuLateral";

/** Los textos de las opciones, en el orden en que se pintaron. */
function opciones(html: string): string[] {
  return [...html.matchAll(/class="menu-texto">([^<]*)</g)].map((m) => m[1]);
}

describe("panelMenu", () => {
  const html = panelMenu(VENTANAS, "medallas", "Ana");

  it("lista todas las ventanas del registro, en orden", () => {
    expect(opciones(html)).toEqual(
      ["Inicio", "Ranking", "Medallas", "Logros personales", "Videos", "Ajustes"]
    );
  });

  it("marca solo la ventana activa", () => {
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/class="menu-opcion activa" data-ventana="medallas"/);
  });

  it("Ajustes va en el bloque del pie", () => {
    const pie = html.slice(html.indexOf(`class="menu-pie"`));
    expect(opciones(pie)).toEqual(["Ajustes"]);
  });

  it("las ventanas por venir llevan la etiqueta Pronto", () => {
    expect(html.match(/class="menu-pronto"/g)).toHaveLength(2);
  });

  it("escapa el nombre", () => {
    const raro = panelMenu(VENTANAS, "inicio", "<b>Ana & Co</b>");
    expect(raro).toContain("&lt;b&gt;Ana &amp; Co&lt;/b&gt;");
    expect(raro).not.toContain("<b>Ana");
  });

  it("se puede cerrar con la ✕ y con el velo", () => {
    expect(html.match(/data-cerrar-menu/g)).toHaveLength(2);
  });
});

describe("cabecera", () => {
  it("trae el botón del menú con su etiqueta y el saludo adentro", () => {
    const html = cabecera(`<h1 id="saludo">Hola</h1>`);
    expect(html).toContain(`aria-label="Abrir menú"`);
    expect(html).toContain(`<h1 id="saludo">Hola</h1>`);
    expect(html).toMatch(/id="titulo-ventana" hidden/);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npx vitest run src/ui/menuLateral.test.ts`
Expected: FAIL, "Failed to resolve import ./menuLateral".

- [ ] **Step 3: Implementar el menú**

`web/src/ui/menuLateral.ts`:

```ts
import type { IdVentana, Ventana } from "../ventanas";
import { escapar } from "./tarjetaDia";

/**
 * La cabecera con el ☰ y el panel lateral que se abre con él.
 *
 * El panel se genera de `VENTANAS`: no hay una lista de opciones escrita acá que se pueda
 * desincronizar del registro. Qué ventana está activa y si el menú está abierto lo decide
 * `navegacion.ts`; este módulo solo lo dibuja.
 */

/**
 * Se pinta UNA vez, en `prepararEstructura`, por lo mismo que el saludo: el nodo del saludo
 * tiene que sobrevivir a los repintados para que la máquina de escribir llegue al final.
 */
export function cabecera(saludoHtml: string): string {
  return `
    <header class="cabecera">
      <button type="button" class="cabecera-menu" id="abrir-menu"
              aria-label="Abrir menú" aria-controls="menu-panel" aria-expanded="false">☰</button>
      <div class="cabecera-texto">
        ${saludoHtml}
        <h1 class="titulo-ventana" id="titulo-ventana" hidden></h1>
      </div>
    </header>`;
}

export function conectarCabecera(abrirMenu: () => void): void {
  document.querySelector("#abrir-menu")?.addEventListener("click", abrirMenu);
}

/**
 * En Inicio va el saludo; en las demás, el nombre de la ventana. El saludo se oculta y no se
 * destruye: rehacerlo lo volvería a escribir letra por letra al regresar.
 */
export function actualizarCabecera(titulo: string | null): void {
  const saludo = document.querySelector<HTMLElement>("#saludo");
  const el = document.querySelector<HTMLElement>("#titulo-ventana");
  if (saludo) saludo.hidden = titulo !== null;
  if (el) {
    el.hidden = titulo === null;
    if (el.textContent !== (titulo ?? "")) el.textContent = titulo ?? "";
  }
}

function opcion(v: Ventana, activa: IdVentana): string {
  const esActiva = v.id === activa;
  return `
        <button type="button" class="menu-opcion${esActiva ? " activa" : ""}" data-ventana="${v.id}"${esActiva ? ` aria-current="page"` : ""}>
          <span class="menu-icono" aria-hidden="true">${v.icono}</span>
          <span class="menu-texto">${escapar(v.titulo)}</span>
          ${v.proximamente ? `<span class="menu-pronto">Pronto</span>` : ""}
        </button>`;
}

export function panelMenu(ventanas: readonly Ventana[], activa: IdVentana, nombre: string): string {
  const de = (grupo: Ventana["grupo"]) =>
    ventanas.filter((v) => v.grupo === grupo).map((v) => opcion(v, activa)).join("");
  return `
    <div class="menu-velo" data-cerrar-menu></div>
    <nav class="menu-panel" id="menu-panel" aria-label="Menú">
      <div class="menu-encabezado">
        <p class="menu-nombre">${escapar(nombre)}</p>
        <button type="button" class="menu-cerrar" data-cerrar-menu aria-label="Cerrar menú">✕</button>
      </div>
      <div class="menu-lista">${de("principal")}</div>
      <div class="menu-pie">${de("pie")}</div>
    </nav>`;
}

/** Se vuelve a llamar cada vez que el panel se repinta: `innerHTML` tira los listeners. */
export function conectarMenu(acciones: {
  abrirVentana: (id: IdVentana) => void;
  cerrarMenu: () => void;
}): void {
  document.querySelectorAll<HTMLElement>("#menu [data-ventana]").forEach((b) =>
    b.addEventListener("click", () => acciones.abrirVentana(b.dataset.ventana as IdVentana))
  );
  document.querySelectorAll("#menu [data-cerrar-menu]").forEach((b) =>
    b.addEventListener("click", acciones.cerrarMenu)
  );
}

let estabaAbierto = false;

/**
 * Abre o cierra con una clase en `body` y no repintando: así la transición del panel corre,
 * y la misma clase bloquea el scroll de la página de abajo. Cerrado, el panel queda `inert`
 * para que el tabulador y el lector de pantalla no entren en él.
 */
export function aplicarMenuAbierto(abierto: boolean): void {
  document.body.classList.toggle("menu-abierto", abierto);
  const panel = document.querySelector<HTMLElement>("#menu-panel");
  panel?.toggleAttribute("inert", !abierto);
  panel?.setAttribute("aria-hidden", String(!abierto));
  const boton = document.querySelector<HTMLElement>("#abrir-menu");
  boton?.setAttribute("aria-expanded", String(abierto));
  if (abierto && !estabaAbierto) panel?.querySelector<HTMLElement>("[data-ventana]")?.focus();
  if (!abierto && estabaAbierto) boton?.focus({ preventScroll: true });
  estabaAbierto = abierto;
}
```

- [ ] **Step 4: Agregar los estilos al final de `web/src/estilos.css`**

```css
/* `hidden` tiene que ganar siempre: el saludo es `inline-block` y sin esto no se ocultaría. */
[hidden] { display: none !important; }

/* La cabecera: el ☰ en el mismo renglón que el saludo o el nombre de la ventana. */
.cabecera { display: flex; align-items: flex-start; gap: 4px; }
.cabecera-texto { flex: 1; min-width: 0; }
.cabecera-menu {
  flex: none; width: 44px; height: 44px; margin: 0 0 0 -8px;
  border: 0; border-radius: 12px; background: transparent;
  color: var(--texto); font-size: 24px; line-height: 1; cursor: pointer;
}
.titulo-ventana { font-size: 26px; margin: 4px 2px 14px; }
.cabecera-menu:focus-visible, .menu-opcion:focus-visible, .menu-cerrar:focus-visible {
  outline: 2px solid var(--primario); outline-offset: 2px;
}

/* El menú lateral. Siempre está en el DOM, fuera de la pantalla, para que abrir sea una
   transición y no un repintado. */
.menu-velo {
  position: fixed; inset: 0; z-index: 20;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0; pointer-events: none; transition: opacity 200ms ease;
}
.menu-panel {
  position: fixed; top: 0; bottom: 0; left: 0; z-index: 21;
  width: min(80vw, 300px); overflow-y: auto;
  display: flex; flex-direction: column;
  padding: calc(16px + env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom));
  background: var(--superficie);
  transform: translateX(-100%); transition: transform 220ms ease;
}
body.menu-abierto { overflow: hidden; }
.menu-abierto .menu-velo { opacity: 1; pointer-events: auto; }
.menu-abierto .menu-panel { transform: none; box-shadow: 8px 0 24px rgba(0, 0, 0, 0.4); }
.menu-encabezado {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin: 0 0 12px 4px;
}
.menu-nombre {
  margin: 0; font-size: 18px; font-weight: 800;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.menu-cerrar {
  flex: none; width: 44px; height: 44px; border: 0; border-radius: 12px;
  background: transparent; color: var(--texto-tenue); font-size: 20px; cursor: pointer;
}
.menu-lista { display: flex; flex-direction: column; gap: 4px; }
/* `margin-top: auto` empuja Ajustes al fondo del panel, por más ventanas que se agreguen. */
.menu-pie { margin-top: auto; padding-top: 24px; }
.menu-opcion {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px;
  padding: 10px 12px; border: 0; border-radius: 12px; background: transparent;
  color: var(--texto); font: inherit; font-size: 16px; text-align: left; cursor: pointer;
}
.menu-opcion.activa { background: var(--superficie-alta); color: var(--primario); font-weight: 700; }
.menu-icono { width: 24px; text-align: center; font-size: 20px; }
.menu-texto { flex: 1; }
.menu-pronto {
  font-size: 11px; color: var(--texto-tenue); background: var(--superficie-alta);
  border-radius: 999px; padding: 2px 8px;
}
@media (prefers-reduced-motion: reduce) {
  .menu-velo, .menu-panel { transition: none; }
}
```

- [ ] **Step 5: Correr los tests**

Run: `npx vitest run src/ui/menuLateral.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add web/src/ui/menuLateral.ts web/src/ui/menuLateral.test.ts web/src/estilos.css
git commit -m "feat(web): cabecera con ☰ y panel del menú lateral generado del registro"
```

---

### Task 4: Cablear las ventanas en `main.ts`

**Files:**
- Modify: `web/src/main.ts` (imports; `arrancar`: `prepararEstructura`, `pintarVideos`, `pintar`, arranque de la navegación)
- Modify: `web/src/ordenSecciones.test.ts` (reescribir)
- Modify: `web/index.html` (esqueleto: cabecera)
- Modify: `web/src/estilos.css` (esqueleto de la cabecera)

**Interfaces:**
- Consumes: todo lo producido en las Tasks 1–3.
- Produces: la página navegable. Ningún otro módulo depende de `main.ts`.

- [ ] **Step 1: Reescribir `ordenSecciones.test.ts` para que falle con el cableado actual**

`web/src/ordenSecciones.test.ts` (reemplazar el archivo entero):

```ts
import { describe, expect, it } from "vitest";
// El cableado se lee como texto (`?raw`, de Vite): `main.ts` arranca la sesión apenas se
// importa y no se puede montar en un test.
import fuente from "./main.ts?raw";

/**
 * El orden de lo que va en Inicio ya no vive en `main.ts`: es la ventana Inicio del registro
 * y se prueba en `ventanas.test.ts`. Acá queda lo que sí es cableado: que `pintar()` pinte la
 * ventana del registro en vez de una lista fija, y que los videos sigan fuera de lo que se
 * repinta (ver `pintarVideos` en `main.ts`).
 */
const bloqueRepintado = fuente.slice(
  fuente.indexOf("contenido.innerHTML"),
  fuente.indexOf("pintarVideos(activa")
);

describe("el cableado de las ventanas", () => {
  it("pintar() pinta la ventana activa del registro", () => {
    expect(bloqueRepintado).toContain("contenidoDe(");
    expect(bloqueRepintado).not.toContain("tarjetaMedallas(");
    expect(bloqueRepintado).not.toContain("calendario(");
  });

  it("los videos siguen en su propio contenedor, después del repintado", () => {
    expect(bloqueRepintado).not.toContain("tarjetaVideos(");
    expect(fuente.indexOf(`<div id="contenido">`)).toBeLessThan(
      fuente.indexOf(`<div id="videos" hidden>`)
    );
  });

  it("la navegación arranca después de la sesión", () => {
    expect(fuente.indexOf("iniciarNavegacion(")).toBeGreaterThan(
      fuente.indexOf("const clienteId = sesion.clienteId")
    );
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npx vitest run src/ordenSecciones.test.ts`
Expected: FAIL (el bloque todavía contiene `tarjetaMedallas(` y no existe `contenidoDe(`).

- [ ] **Step 3: Cambiar los imports de `main.ts`**

Reemplazar estas líneas:

```ts
import { tarjetaDia } from "./ui/tarjetaDia";
import { saludo, conectarSaludo, actualizarNombre } from "./ui/saludo";
import { tarjetasStats } from "./ui/tarjetasStats";
import { accionDia, conectarAccionDia, hojaDeMotivosAbierta } from "./ui/accionDia";
import { accionHoyNoPuedo, tarjetaRevivir, conectarAccionFalta } from "./ui/accionFalta";
import { calendario, moverMes } from "./ui/calendario";
import { tarjetaMedallas, tarjetaLogrosPersonales } from "./ui/tarjetaInsignias";
import { tarjetaVideos, ultimosRangoDescendente, firmaVideos, MAXIMO_VIDEOS } from "./ui/tarjetaVideos";
```

por:

```ts
import { saludo, conectarSaludo, actualizarNombre } from "./ui/saludo";
import { conectarAccionDia } from "./ui/accionDia";
import { conectarAccionFalta } from "./ui/accionFalta";
import { moverMes } from "./ui/calendario";
import { tarjetaVideos, ultimosRangoDescendente, firmaVideos, MAXIMO_VIDEOS } from "./ui/tarjetaVideos";
import { VENTANAS, contenidoDe, ventana, type IdVentana } from "./ventanas";
import {
  abrirMenu, abrirVentana, cerrarMenu, historialDelNavegador, iniciarNavegacion, menuAbierto,
  ventanaActiva,
} from "./navegacion";
import {
  actualizarCabecera, aplicarMenuAbierto, cabecera, conectarCabecera, conectarMenu, panelMenu,
} from "./ui/menuLateral";
```

- [ ] **Step 4: Arrancar la navegación después de la sesión**

Justo después de `const clienteId = sesion.clienteId;` en `arrancar()`:

```ts
  const clienteId = sesion.clienteId;
  // Después de la sesión, no antes: limpia `history.state`, y la pantalla del candado lo lee
  // para su diagnóstico.
  iniciarNavegacion(historialDelNavegador(), () => pintar());
```

- [ ] **Step 5: Nueva estructura en `prepararEstructura`**

Reemplazar el cuerpo:

```ts
  function prepararEstructura(nombre: string): void {
    if (document.querySelector("#contenido")) return;
    app.innerHTML =
      `${saludo(nombre)}<div id="contenido"></div><div id="videos"></div><div id="ruleta"></div>`;
    conectarSaludo();
  }
```

por:

```ts
  function prepararEstructura(nombre: string): void {
    if (document.querySelector("#contenido")) return;
    // La cabecera (☰ + saludo) y el menú viven fuera de `#contenido` por lo mismo que el
    // saludo: sus nodos tienen estado (la animación, la transición del panel) que un
    // repintado destruiría.
    app.innerHTML = `${cabecera(saludo(nombre))}<div id="contenido"></div>` +
      `<div id="videos" hidden></div><div id="menu"></div><div id="ruleta"></div>`;
    conectarSaludo();
    conectarCabecera(abrirMenu);
  }
```

- [ ] **Step 6: `pintarVideos` se muestra solo en la ventana Videos y pausa al salir**

Reemplazar la función `pintarVideos` entera, con su comentario, por:

```ts
  /**
   * Los videos van FUERA de lo que se repinta, por lo mismo que el saludo: el `<video>` tiene
   * estado propio (posición, buffer ya descargado) y `innerHTML` lo destruye. Con seis
   * listeners vivos más los dos botones de mes, basta con que el entrenador marque una
   * asistencia para que el video que está viendo vuelva a empezar y se recargue con dato móvil.
   *
   * Por eso cambiar de ventana solo oculta el contenedor y nunca lo vacía: al volver, el video
   * sigue donde estaba. Lo que sí se hace al salir es pausarlo, para que no siga sonando
   * detrás de otra ventana.
   */
  function pintarVideos(visible: boolean): void {
    const caja = document.querySelector<HTMLElement>("#videos");
    if (!caja) return;
    if (caja.hidden === visible) {
      caja.hidden = !visible;
      if (!visible) caja.querySelectorAll("video").forEach((v) => v.pause());
    }
    const firma = firmaVideos(videos);
    if (firma === firmaPintada) return;
    firmaPintada = firma;
    caja.innerHTML = tarjetaVideos(videos);
  }
```

En `resolverVideos`, la última línea `pintar();` se queda igual: `pintar()` decide la visibilidad.

- [ ] **Step 7: Agregar `pintarMenu` junto a `pintarRuleta`**

Justo antes de `function pintar(): void {`:

```ts
  /** Lo último que se pintó en `#menu`; `null` mientras no se pintó nada. */
  let firmaMenuPintada: string | null = null;

  /**
   * El panel solo se repinta si cambió lo que muestra (la ventana activa, el nombre). Abrirlo
   * y cerrarlo es una clase, no un repintado: rehacer el nodo cortaría la transición.
   */
  function pintarMenu(activa: IdVentana, nombre: string): void {
    const caja = document.querySelector<HTMLElement>("#menu");
    if (!caja) return;
    const html = panelMenu(VENTANAS, activa, nombre);
    if (html !== firmaMenuPintada) {
      firmaMenuPintada = html;
      caja.innerHTML = html;
      conectarMenu({ abrirVentana, cerrarMenu });
    }
    aplicarMenuAbierto(menuAbierto());
  }

  /** La ventana que se pintó la última vez, para volver arriba solo al cambiar de ventana. */
  let ventanaPintada: IdVentana | null = null;
```

- [ ] **Step 8: Reescribir el final de `pintar()`**

Dentro de `pintar()`, en la rama `if (!cliente)`, agregar el reinicio de las firmas nuevas junto a las existentes:

```ts
      firmaPintada = null;
      firmaRuletaPintada = null;
      firmaMenuPintada = null;
      ventanaPintada = null;
```

Después reemplazar todo desde `prepararEstructura(cliente.nombre);` hasta el cierre de `pintar()` (incluye `accionesDelDia`, `contenido.innerHTML = …`, `pintarVideos(); pintarRuleta();` y los listeners de mes) por:

```ts
    prepararEstructura(cliente.nombre);
    actualizarNombre(cliente.nombre);
    const contenido = document.querySelector<HTMLElement>("#contenido");
    if (!contenido) return;

    const activa = ventana(ventanaActiva());
    actualizarCabecera(activa.id === "inicio" ? null : activa.titulo);
    contenido.innerHTML = contenidoDe(activa, {
      cliente, hoy, asistencias, mesVisible, yaAviso, medallas, logros,
      tiradaEsteMes, tiradaMesAnterior,
    });
    pintarVideos(activa.contenedorPropio === "videos");
    pintarMenu(activa.id, cliente.nombre);
    pintarRuleta();
    if (activa.id !== ventanaPintada) {
      // Cada ventana arranca arriba. Solo al cambiar: un snapshot no debe mover el scroll.
      if (ventanaPintada !== null) window.scrollTo(0, 0);
      ventanaPintada = activa.id;
    }

    // Las acciones y los meses del calendario solo existen en Inicio. Los listeners se vuelven
    // a colgar en cada repintado: `innerHTML` tira los anteriores junto con los elementos. El
    // estado de las dos acciones no vive acá, sino dentro de sus módulos, justo para que un
    // snapshot a destiempo no lo borre.
    if (activa.id !== "inicio") return;
    conectarAccionDia(pintar);
    conectarAccionFalta(hoy, asistencias, pintar);
    document.querySelector("#mes-anterior")?.addEventListener("click", () => {
      mesVisible = moverMes(mesVisible, -1);
      pintar();
    });
    document.querySelector("#mes-siguiente")?.addEventListener("click", () => {
      mesVisible = moverMes(mesVisible, 1);
      pintar();
    });
  }
```

- [ ] **Step 9: Esqueleto de carga con la cabecera**

En `web/index.html`, reemplazar:

```html
        <div class="esq-saludo"></div>
```

por:

```html
        <div class="esq-cabecera">
          <div class="esq-menu"></div>
          <div class="esq-saludo"></div>
        </div>
```

En `web/src/estilos.css`, justo después de la regla `.esq-saludo { … }`:

```css
/* El ☰ del esqueleto, en el mismo gris neutro que el resto: el botón de verdad llega con el
   primer `pintar()` y ocupa este mismo lugar. */
.esq-cabecera { display: flex; align-items: flex-start; gap: 4px; }
.esq-menu {
  flex: none; width: 28px; height: 28px; border-radius: 8px;
  background: var(--superficie-alta); margin: 8px 8px 14px 0;
}
```

- [ ] **Step 10: Correr todos los tests, el typecheck y el build**

Run: `npx vitest run`
Expected: PASS. Son 22 archivos: 19 anteriores (con `ordenSecciones.test.ts` reescrito) más `ventanas.test.ts`, `navegacion.test.ts` y `menuLateral.test.ts`.

Run: `npm run build`
Expected: `tsc` sin errores (`noUnusedLocals` está activo: si falla por un import sin usar, quitarlo) y `vite build` genera `dist/`.

- [ ] **Step 11: Commit**

```bash
git add web/src/main.ts web/src/ordenSecciones.test.ts web/index.html web/src/estilos.css
git commit -m "feat(web): la página se parte en ventanas con menú lateral"
```

---

### Task 5: Verificación en el navegador

**Files:** ninguno (solo si aparece un defecto; en ese caso, arreglarlo en el archivo de la task dueña con su test y hacer commit aparte).

- [ ] **Step 1: Levantar el servidor**

Run (en segundo plano): `npm run dev`
Expected: Vite sirve en `http://localhost:5173`.

- [ ] **Step 2: Entrar con un link de clienta**

Hace falta un link real `/c/<token>` de una clienta de prueba: se le pide al usuario. Se abre `http://localhost:5173/c/<token>` con Playwright en viewport 390×844.

- [ ] **Step 3: Recorrer los casos y tomar captura de cada uno**

1. Inicio muestra ☰, saludo, tarjeta del día, racha y promedio, (revivir si aplica) y calendario. No aparecen medallas, logros ni videos.
2. ☰ abre el panel con el orden Inicio, Ranking, Medallas, Logros personales, Videos y Ajustes separado al fondo. Ranking y Ajustes llevan "Pronto".
3. Tocar el velo cierra el panel. Volver a abrir y tocar ✕ lo cierra.
4. Menú → Medallas: título "Medallas" en lugar del saludo, tarjeta de medallas. `browser_navigate_back` → Inicio, con el saludo ya escrito y sin reanimarse.
5. Menú → Medallas, menú → Videos, "atrás" → Inicio.
6. Menú abierto sobre Medallas + "atrás" → se cierra el menú y sigue en Medallas.
7. Videos: reproducir uno, ir a Medallas y volver. El video está pausado en la misma posición.
8. Ranking y Ajustes muestran "Muy pronto".
9. Recargar estando en Medallas → cae en Inicio.
10. En Medallas, pedirle al usuario que marque una asistencia desde la app (o esperar un snapshot): la página sigue en Medallas.
11. En Inicio, "Quiero cambiar el día" abre su hoja y los botones de mes del calendario funcionan.

- [ ] **Step 4: Detener el servidor y reportar**

Reportar los casos con su resultado y las capturas. Si algún caso falló, reportar el defecto y el commit que lo arregló.
