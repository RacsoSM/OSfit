# Ajustes: la clienta elige su paleta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La ventana Ajustes de la web deja de decir "Muy pronto" y le deja a la
clienta elegir su paleta de color del mismo catálogo de 15 que ve el entrenador.

**Architecture:** El catálogo se copia una vez a `functions/src/paletas.ts`, con
un test de paridad contra `Paleta.kt` que lo mantiene sincronizado. Dos
callables nuevos: `obtenerPaletas` sirve el catálogo y `elegirPaleta` valida un
id y escribe `paletaWeb` con el Admin SDK. La web aplica el color al instante
(optimista) y revierte si la escritura falla; `firestore.rules` no se toca y la
página sigue sin escribir en Firestore por su cuenta.

**Tech Stack:** TypeScript, Vite (web), Firebase Functions v2 + Node 22
(functions), vitest en los dos, Kotlin sólo para leerlo desde un test.

**Spec:** `docs/superpowers/specs/2026-09-25-ajustes-paleta-cliente-design.md`

## Global Constraints

- Los hex van en **MAYÚSCULAS**, formato `#RRGGBB` (seis dígitos siempre).
  `aHexWeb` en Kotlin es `"#%06X".format(color and 0xFFFFFF)`.
- El documento de la clienta recibe **cinco claves**: `id`, `primario`,
  `primarioOscuro`, `primarioClaro`, `sobrePrimario`. **Nunca `nombre`.**
- Toda escritura al documento de la clienta usa `{ merge: true }`.
- `firestore.rules` **no se modifica** en ninguna tarea.
- El navegador manda **sólo un id**. Nunca hex.
- El orden del catálogo TS es el de `Paletas.disponibles` en `Paleta.kt`.
- Código, nombres, comentarios y nombres de test **en español**. Los
  comentarios explican el **porqué**, no el qué.
- Mensajes de commit **en inglés**, con prefijo `feat:` / `fix:` / `docs:` /
  `test:`, terminando con `Co-Authored-By:`. Los commits de abajo traen la
  atribución de Claude Opus 5; si te ejecuta otro agente, cámbiala por la tuya.
- Región de las funciones: siempre la constante `REGION` de `comun.ts`.
- No hacer `push`. Un commit por tarea.

## Review Focus

Cinco cosas que el spec implica pero cuyos tests no caen solos de su texto.
Cada una tiene su test asignado a la tarea que la posee:

1. **Carrera entre dos toques seguidos.** La clienta toca Océano y enseguida
   Cereza; la llamada de Océano falla después. La reversión de Océano no debe
   pisar el color de Cereza, que fue elegido después. → Tarea 4.
2. **`elegirPaleta` sin `data`, o con `data: null`.** Debe responder
   `invalid-argument`, no reventar con un `TypeError` que llegue al cliente como
   `internal`. → Tarea 2.
3. **`obtenerPaletas` sin sesión.** Debe responder `unauthenticated` aunque los
   colores no sean secretos: ninguna función del proyecto es invocable sin
   token. → Tarea 2.
4. **Catálogo vacío en la respuesta** (backend viejo, despliegue a medias). La
   rejilla no puede quedar en blanco sin explicación. → Tarea 3.
5. **Id con espacios o distinta capitalización** (`" morado_osfit "`,
   `"Morado_OSfit"`). Se rechaza; no se normaliza en silencio, porque normalizar
   aceptaría ids que Kotlin nunca escribiría. → Tarea 2.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `functions/src/paletas.ts` | catálogo TS, validación de id, las dos callables | 1, 2 |
| `functions/src/paletas.test.ts` | paridad con Kotlin + validación | 1, 2 |
| `functions/src/index.ts` | exportar las dos callables | 2 |
| `app/.../paletas/PaletaWebFirestore.kt` | corregir el comentario que se vuelve falso | 1 |
| `web/src/paleta.ts` | corregir el comentario que se vuelve falso | 1 |
| `web/src/acciones.ts` | declarar las dos callables | 3 |
| `web/src/ui/tarjetaPaletas.ts` | HTML de la rejilla + lógica de elección | 3, 4 |
| `web/src/ui/tarjetaPaletas.test.ts` | render y elección | 3, 4 |
| `web/src/ventanas.ts` | Ajustes pierde `proximamente`, gana `pintar` | 5 |
| `web/src/ventanas.test.ts` | las dos aserciones de "Muy pronto" | 5 |
| `web/src/main.ts` | `cargarPaletas`, campo en `DatosCliente`, `conectarPaletas` | 5 |
| `web/src/estilos.css` | estilos de la rejilla | 6 |

---

### Task 1: El catálogo en TypeScript y el test de paridad

Primero el test, que es lo único que hace confiable a una copia.

**Files:**
- Create: `functions/src/paletas.ts`
- Create: `functions/src/paletas.test.ts`
- Modify: `app/src/main/java/com/osfit/app/paletas/PaletaWebFirestore.kt` (el comentario de cabecera, líneas 3-10)
- Modify: `web/src/paleta.ts` (el comentario de cabecera, líneas 1-5)

**Interfaces:**
- Consumes: nada.
- Produces: `PaletaOpcion` (interface con `id`, `nombre`, `primario`,
  `primarioOscuro`, `primarioClaro`, `sobrePrimario`, todos `string`),
  `PALETAS: readonly PaletaOpcion[]` (15, en orden de `Paletas.disponibles`), y
  `MORADO_OSFIT: string` (la constante `"morado_osfit"`).

- [ ] **Step 1: Write the failing parity test**

Create `functions/src/paletas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETAS, type PaletaOpcion } from "./paletas";

/**
 * El catálogo vive dos veces: en `Paleta.kt` (que lo escribe desde la app) y en
 * `paletas.ts` (que lo sirve a la web). Este test es lo único que las mantiene iguales.
 *
 * GEMELO: `Paletas.disponibles` en `app/.../paletas/Paleta.kt`.
 */
const RUTA_KOTLIN = join(
  __dirname,
  "../../app/src/main/java/com/osfit/app/paletas/Paleta.kt"
);

/** Réplica de `aHexWeb` en Kotlin: descarta el alfa y deja seis dígitos en mayúsculas. */
function aHexWeb(argb: string): string {
  return `#${(parseInt(argb, 16) & 0xffffff).toString(16).toUpperCase().padStart(6, "0")}`;
}

function campo(bloque: string, nombre: string): string {
  const m = bloque.match(new RegExp(`${nombre} = "([^"]*)"`));
  if (!m) throw new Error(`falta ${nombre} en el bloque de Kotlin`);
  return m[1];
}

function color(bloque: string, nombre: string): string {
  const m = bloque.match(new RegExp(`${nombre} = 0x([0-9A-Fa-f]{8})\\.toInt\\(\\)`));
  if (!m) throw new Error(`falta ${nombre} en el bloque de Kotlin`);
  return aHexWeb(m[1]);
}

/** Lo que `Paleta.kt` declara, en el orden que manda `disponibles`. */
function paletasDeKotlin(): PaletaOpcion[] {
  const fuente = readFileSync(RUTA_KOTLIN, "utf8");

  const porConstante = new Map<string, PaletaOpcion>();
  for (const m of fuente.matchAll(/private val (\w+) = Paleta\(([\s\S]*?)\n {4}\)/g)) {
    const [, constante, bloque] = m;
    porConstante.set(constante, {
      id: campo(bloque, "id"),
      nombre: campo(bloque, "nombre"),
      primario: color(bloque, "webPrimario"),
      primarioOscuro: color(bloque, "webPrimarioOscuro"),
      primarioClaro: color(bloque, "webPrimarioClaro"),
      sobrePrimario: color(bloque, "webSobrePrimario"),
    });
  }

  // El orden sale de `disponibles` y no del orden de declaración: son iguales hoy, y
  // depender del segundo sería depender de una coincidencia.
  const lista = fuente.match(/val disponibles: List<Paleta> = listOf\(([\s\S]*?)\)/);
  if (!lista) throw new Error("no se encontró `disponibles` en Paleta.kt");
  return lista[1]
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((n) => {
      const p = porConstante.get(n);
      if (!p) throw new Error(`\`disponibles\` menciona ${n}, que no se pudo parsear`);
      return p;
    });
}

describe("el catálogo de paletas", () => {
  /**
   * Va ANTES de comparar, y es la aserción más importante del archivo: si el regex deja de
   * morder —alguien reformatea `Paleta.kt`— sin esto el test compararía dos listas vacías,
   * pasaría, y la paridad quedaría sin vigilancia justo cuando más falta hace.
   */
  it("extrae las quince paletas de Paleta.kt", () => {
    expect(paletasDeKotlin()).toHaveLength(15);
  });

  it("es idéntico al de Kotlin, en el mismo orden", () => {
    expect(PALETAS).toEqual(paletasDeKotlin());
  });

  it("no repite ids", () => {
    const ids = PALETAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo hex es #RRGGBB en mayúsculas", () => {
    for (const p of PALETAS) {
      for (const hex of [p.primario, p.primarioOscuro, p.primarioClaro, p.sobrePrimario]) {
        expect(hex, `${p.id}`).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd functions && npx vitest run src/paletas.test.ts`
Expected: FAIL — `Failed to resolve import "./paletas"`.

- [ ] **Step 3: Write the catalogue**

Create `functions/src/paletas.ts`:

```ts
/**
 * El catálogo de paletas, copia de la mitad web de `Paletas.disponibles` en Kotlin.
 *
 * GEMELO: `app/src/main/java/com/osfit/app/paletas/Paleta.kt`. Existe esta copia porque la
 * clienta elige su paleta desde Ajustes y el navegador tiene que ver las quince: no se puede
 * elegir de una lista que sólo existe compilada en la app. El navegador manda un id y esta
 * lista es la que resuelve los hex, así que los colores que se guardan nunca vienen de fuera.
 *
 * Sólo la mitad web: `blobA`, `blobB`, `blobC` y `destacado` son del video y la página no los
 * usa. `paletas.test.ts` compara esta lista contra el archivo Kotlin y exige igualdad exacta,
 * incluido el orden — es lo único que evita que las dos se separen en silencio.
 */
export interface PaletaOpcion {
  id: string;
  nombre: string;
  primario: string;
  primarioOscuro: string;
  primarioClaro: string;
  sobrePrimario: string;
}

/** Los colores que la web tuvo siempre: el por defecto y el destino de toda reversión. */
export const MORADO_OSFIT = "morado_osfit";

export const PALETAS: readonly PaletaOpcion[] = [
  { id: "aqua_noche", nombre: "Aqua noche", primario: "#3FE0B8", primarioOscuro: "#0E6B57", primarioClaro: "#C8FFEE", sobrePrimario: "#03251C" },
  { id: "atardecer", nombre: "Atardecer", primario: "#FFB347", primarioOscuro: "#8A3B12", primarioClaro: "#FFE3B0", sobrePrimario: "#2E1403" },
  { id: "bosque", nombre: "Bosque", primario: "#A8E05A", primarioOscuro: "#2F6B1E", primarioClaro: "#E4F7C4", sobrePrimario: "#12240A" },
  { id: "ultravioleta", nombre: "Ultravioleta", primario: "#6FD8FF", primarioOscuro: "#1B4E8A", primarioClaro: "#D6F2FF", sobrePrimario: "#041A26" },
  { id: "brasa", nombre: "Brasa", primario: "#FF8A5C", primarioOscuro: "#8A2B15", primarioClaro: "#FFD9C7", sobrePrimario: "#2B0C04" },
  { id: MORADO_OSFIT, nombre: "Morado OSfit", primario: "#B388FF", primarioOscuro: "#6A1B9A", primarioClaro: "#E3D2FF", sobrePrimario: "#2A0064" },
  { id: "cereza", nombre: "Cereza", primario: "#FF6E9C", primarioOscuro: "#8A123F", primarioClaro: "#FFD1E0", sobrePrimario: "#2B0413" },
  { id: "menta_fria", nombre: "Menta fría", primario: "#5FE6C4", primarioOscuro: "#0F5C50", primarioClaro: "#CFFFF2", sobrePrimario: "#04231D" },
  { id: "oceano", nombre: "Océano", primario: "#6BB6FF", primarioOscuro: "#123A75", primarioClaro: "#D2E8FF", sobrePrimario: "#04162B" },
  { id: "arena", nombre: "Arena", primario: "#E8C28A", primarioOscuro: "#6B4A1E", primarioClaro: "#FAEBD4", sobrePrimario: "#2B1D06" },
  { id: "neon", nombre: "Neón", primario: "#FF6FE0", primarioOscuro: "#7B1268", primarioClaro: "#FFD4F5", sobrePrimario: "#2B0424" },
  { id: "bruma", nombre: "Bruma", primario: "#A9C6E3", primarioOscuro: "#37506B", primarioClaro: "#E2EDF7", sobrePrimario: "#0C1722" },
  { id: "vino", nombre: "Vino", primario: "#E58BA4", primarioOscuro: "#5E1230", primarioClaro: "#FADCE4", sobrePrimario: "#260610" },
  { id: "lima", nombre: "Lima", primario: "#C6F24F", primarioOscuro: "#4A6B12", primarioClaro: "#EDFBC6", sobrePrimario: "#1A2604" },
  { id: "cobre", nombre: "Cobre", primario: "#F0A46B", primarioOscuro: "#6B3312", primarioClaro: "#FBE0CB", sobrePrimario: "#2B1204" },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd functions && npx vitest run src/paletas.test.ts`
Expected: PASS, 4 tests.

Si "es idéntico al de Kotlin" falla, el mensaje de vitest muestra el diff exacto:
corrige el hex o el nombre del lado TS, **nunca el de Kotlin** — Kotlin es la
fuente y sus colores están protegidos por los tests de contraste de
`PaletasTest.kt`.

- [ ] **Step 5: Fix the comment that this task makes false**

En `app/src/main/java/com/osfit/app/paletas/PaletaWebFirestore.kt`, la cabecera
dice hoy que no hay copia de la lista. Reemplaza ese párrafo por:

```kotlin
/**
 * Cómo una [Paleta] se convierte en lo que la web lee.
 *
 * Se guardan los hex ya resueltos y no sólo el id porque la web aplica colores sin tener que
 * resolverlos: `web/src/paleta.ts` los vuelca como variables CSS y ya. El id viaja igual,
 * para marcar cuál está seleccionada y para poder reasignar en masa si algún día se rehacen
 * los colores de un preset.
 *
 * Desde que la clienta elige su paleta desde Ajustes hay una segunda copia del catálogo, en
 * `functions/src/paletas.ts`: el navegador necesita ver las quince para elegir. Esa copia
 * tiene sólo la mitad web, y `functions/src/paletas.test.ts` la compara contra este archivo
 * en cada corrida. Kotlin sigue siendo la fuente; TS es el reflejo.
 */
```

- [ ] **Step 6: Fix the same claim in the web**

En `web/src/paleta.ts`, la cabecera afirma que el catálogo no existe fuera de
Kotlin. Reemplázala por:

```ts
/**
 * Los colores de marca de la página, volcados como variables CSS.
 *
 * Los hex llegan ya resueltos en el documento de la clienta, los escriba el entrenador desde
 * la app o ella misma desde Ajustes. Este módulo no conoce el catálogo: recibe cuatro colores
 * y los aplica. El catálogo vive en Kotlin y, reflejado, en `functions/src/paletas.ts`.
 */
```

- [ ] **Step 7: Run every suite that could have been touched**

Run: `cd functions && npm test`
Expected: PASS (las suites que ya existían, más las 4 nuevas).

Run: `cd web && npm test`
Expected: PASS, sin cambios — sólo se tocó un comentario.

Run: `./gradlew test`
Expected: PASS, sin cambios — sólo se tocó un comentario.

- [ ] **Step 8: Commit**

```bash
git add functions/src/paletas.ts functions/src/paletas.test.ts \
  app/src/main/java/com/osfit/app/paletas/PaletaWebFirestore.kt web/src/paleta.ts
git commit -m "feat(functions): mirror the palette catalogue in TypeScript, with a parity test

The client needs to see all fifteen to pick one, and the catalogue only existed
compiled into the Android app. The copy holds the web half only, and the test
parses Paleta.kt and demands an exact match, order included.

It asserts it extracted fifteen entries before comparing: a regex that stops
matching would otherwise compare two empty lists, pass, and leave the parity
unwatched exactly when it matters.

Two header comments claimed no such copy could exist. They are now true again.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Las dos Cloud Functions

**Files:**
- Modify: `functions/src/paletas.ts` (agregar al final)
- Modify: `functions/src/paletas.test.ts` (agregar un `describe`)
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `PALETAS`, `PaletaOpcion` de la Tarea 1.
- Produces:
  - `camposFirestore(p: PaletaOpcion): Record<string, string>` — las cinco
    claves, sin `nombre`.
  - `resolverEleccion(datos: unknown): Record<string, string>` — valida y
    devuelve los campos, o lanza `HttpsError`.
  - `obtenerPaletas` y `elegirPaleta`, los dos callables.

- [ ] **Step 1: Write the failing tests**

Añade al final de `functions/src/paletas.test.ts`:

```ts
import { HttpsError } from "firebase-functions/v2/https";
import { camposFirestore, resolverEleccion } from "./paletas";

describe("camposFirestore", () => {
  it("escribe cinco claves: el id y los cuatro hex", () => {
    const morado = PALETAS.find((p) => p.id === "morado_osfit")!;
    expect(camposFirestore(morado)).toEqual({
      id: "morado_osfit",
      primario: "#B388FF",
      primarioOscuro: "#6A1B9A",
      primarioClaro: "#E3D2FF",
      sobrePrimario: "#2A0064",
    });
  });

  /**
   * El documento tiene que quedar con la misma forma que escribe `camposFirestore` en Kotlin.
   * Si se colara `nombre`, el documento diría cosas distintas según quién eligió último y no
   * se notaría hasta que algo leyera ese campo esperando que no estuviera.
   */
  it("no escribe el nombre", () => {
    for (const p of PALETAS) {
      expect(Object.keys(camposFirestore(p)).sort()).toEqual(
        ["id", "primario", "primarioClaro", "primarioOscuro", "sobrePrimario"]
      );
    }
  });
});

describe("resolverEleccion", () => {
  it("resuelve los campos de una paleta del catálogo", () => {
    expect(resolverEleccion({ id: "oceano" })).toEqual(camposFirestore(
      PALETAS.find((p) => p.id === "oceano")!
    ));
  });

  it("acepta las quince", () => {
    for (const p of PALETAS) {
      expect(resolverEleccion({ id: p.id }).id).toBe(p.id);
    }
  });

  /** Sin `data`, con `data: null`, o con un `id` que no es cadena: `invalid-argument`, no
   *  un TypeError que le llegue al navegador disfrazado de `internal`. */
  it("rechaza una entrada sin id usable", () => {
    for (const datos of [undefined, null, {}, { id: null }, { id: 7 }, { id: "" }, { id: ["oceano"] }]) {
      expect(() => resolverEleccion(datos), JSON.stringify(datos) ?? "undefined")
        .toThrowError(HttpsError);
    }
  });

  it("rechaza un id desconocido", () => {
    expect(() => resolverEleccion({ id: "turquesa_imaginaria" })).toThrowError(HttpsError);
  });

  /** No se normaliza: aceptar " oceano " u "Oceano" sería aceptar ids que Kotlin nunca
   *  escribiría, y el id guardado tiene que poder compararse con el del catálogo tal cual. */
  it("rechaza un id con espacios o con otra capitalización", () => {
    for (const id of [" oceano", "oceano ", "Oceano", "OCEANO", "Morado_OSfit"]) {
      expect(() => resolverEleccion({ id }), id).toThrowError(HttpsError);
    }
  });

  it("el error dice invalid-argument y paleta_desconocida", () => {
    try {
      resolverEleccion({ id: "no_existe" });
      expect.unreachable("tenía que lanzar");
    } catch (error) {
      expect((error as HttpsError).code).toBe("invalid-argument");
      expect((error as HttpsError).message).toBe("paleta_desconocida");
    }
  });
});

/**
 * Review Focus 3. Las dos callables exigen sesión, y quien lo hace cumplir es
 * `clienteDeLaSesion`: es la única puerta, y ninguna función debe aceptar un clienteId que
 * venga en el body. La cáscara `onCall` no se prueba unitariamente —no hay precedente en el
 * repo—, pero sí la puerta que las dos atraviesan.
 */
describe("la puerta de sesión que usan las dos callables", () => {
  it("rechaza una llamada sin el claim clienteId", () => {
    for (const auth of [undefined, {}, { token: {} }, { token: { clienteId: "" } }, { token: { clienteId: 7 } }]) {
      expect(
        () => clienteDeLaSesion({ auth } as unknown as CallableRequest),
        JSON.stringify(auth) ?? "undefined"
      ).toThrowError(HttpsError);
    }
  });

  it("devuelve el clienteId del token cuando viene bien", () => {
    const request = { auth: { token: { clienteId: "ana" } } } as unknown as CallableRequest;
    expect(clienteDeLaSesion(request)).toBe("ana");
  });
});
```

Ese `describe` necesita dos imports más arriba, junto a los otros:

```ts
import type { CallableRequest } from "firebase-functions/v2/https";
import { clienteDeLaSesion } from "./comun";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd functions && npx vitest run src/paletas.test.ts`
Expected: FAIL — `camposFirestore` y `resolverEleccion` no están exportadas.

- [ ] **Step 3: Write the implementation**

Añade al final de `functions/src/paletas.ts`:

```ts
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db } from "./comun";

/**
 * Lo que va al documento de la clienta: el id y los cuatro hex, y nada más.
 *
 * GEMELO: `camposFirestore` en `app/.../paletas/PaletaWebFirestore.kt`. `nombre` se queda
 * fuera a propósito — está en el catálogo para pintar el selector, no para guardarse. Si se
 * colara, el documento tendría una forma distinta según quién eligió último.
 */
export function camposFirestore(paleta: PaletaOpcion): Record<string, string> {
  return {
    id: paleta.id,
    primario: paleta.primario,
    primarioOscuro: paleta.primarioOscuro,
    primarioClaro: paleta.primarioClaro,
    sobrePrimario: paleta.sobrePrimario,
  };
}

/**
 * Del `data` que llegó del navegador a los campos que se van a escribir.
 *
 * Es la única puerta: el navegador manda un id y los hex los resuelve el servidor, así que
 * nadie puede meterle colores arbitrarios a su propio documento desde la consola. El id se
 * compara tal cual, sin recortar ni bajar a minúsculas: normalizar aceptaría ids que Kotlin
 * nunca escribiría, y el id guardado tiene que poder compararse con el del catálogo.
 */
export function resolverEleccion(datos: unknown): Record<string, string> {
  const id = (datos as { id?: unknown } | null | undefined)?.id;
  if (typeof id !== "string" || id === "") {
    throw new HttpsError("invalid-argument", "paleta_desconocida");
  }
  const paleta = PALETAS.find((p) => p.id === id);
  if (!paleta) {
    throw new HttpsError("invalid-argument", "paleta_desconocida");
  }
  return camposFirestore(paleta);
}

/**
 * El catálogo para el selector de Ajustes.
 *
 * No toca Firestore: es una constante del módulo. Exige sesión aunque los colores no sean
 * secretos, para que ninguna función del proyecto sea la excepción invocable sin token.
 */
export const obtenerPaletas = onCall({ region: REGION }, async (request) => {
  clienteDeLaSesion(request);
  return { paletas: PALETAS };
});

/**
 * La clienta elige su paleta.
 *
 * `merge` y no `set` a secas por lo mismo que documenta `PaletaWebRepository` en Kotlin: el
 * documento tiene nombre, rutina y todo lo demás, y un set completo lo borraría.
 *
 * Escribe el mismo campo que el entrenador desde la app, a propósito: gana el último que
 * toca. Lo que él eligió queda como valor inicial.
 */
export const elegirPaleta = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);
  const paletaWeb = resolverEleccion(request.data);

  await db().collection("clientes").doc(clienteId).set({ paletaWeb }, { merge: true });

  return { ok: true, id: paletaWeb.id };
});
```

Mueve el `import` de `HttpsError`/`onCall` y el de `comun` al principio del
archivo, junto a los demás: TypeScript los acepta abajo, pero el repo no tiene
imports a media altura en ningún módulo.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd functions && npx vitest run src/paletas.test.ts`
Expected: PASS, 14 tests (las 4 de la Tarea 1 más las 10 nuevas).

- [ ] **Step 5: Export the two callables**

En `functions/src/index.ts`, añade al final:

```ts
export { obtenerPaletas, elegirPaleta } from "./paletas";
```

- [ ] **Step 6: Verify it compiles and the whole suite passes**

Run: `cd functions && npm run build`
Expected: PASS, sin errores de tipos.

Run: `cd functions && npm test`
Expected: PASS, todas las suites.

- [ ] **Step 7: Commit**

```bash
git add functions/src/paletas.ts functions/src/paletas.test.ts functions/src/index.ts
git commit -m "feat(functions): serve the palette catalogue and accept the client's choice

obtenerPaletas returns the catalogue; elegirPaleta takes an id, resolves the
hexes server-side and merges paletaWeb into the client's document.

The browser only ever sends an id, so nobody can write arbitrary colours into
their own document from the console. Ids are compared verbatim: normalising
would accept ids Kotlin would never write.

firestore.rules stays untouched — the client remains read-only and the function
writes with the Admin SDK, like the other four client actions.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: La rejilla, sin interacción todavía

**Files:**
- Create: `web/src/ui/tarjetaPaletas.ts`
- Create: `web/src/ui/tarjetaPaletas.test.ts`
- Modify: `web/src/acciones.ts`

**Interfaces:**
- Consumes: nada de las tareas anteriores (el tipo se declara acá; `web/` y
  `functions/` son dos proyectos npm separados y no se importan entre sí).
- Produces:
  - `PaletaOpcion` — mismos seis campos que en `functions/src/paletas.ts`.
  - `EstadoPaletas` — `{ estado: "cargando" } | { estado: "listo"; paletas: PaletaOpcion[] } | { estado: "error" }`.
  - `tarjetaPaletas(estado: EstadoPaletas, guardada: string | null): string`.
  - En `acciones.ts`: `obtenerPaletas` y `elegirPaleta` como `httpsCallable`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/ui/tarjetaPaletas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tarjetaPaletas, type PaletaOpcion } from "./tarjetaPaletas";

const OCEANO: PaletaOpcion = {
  id: "oceano", nombre: "Océano", primario: "#6BB6FF",
  primarioOscuro: "#123A75", primarioClaro: "#D2E8FF", sobrePrimario: "#04162B",
};
const MORADO: PaletaOpcion = {
  id: "morado_osfit", nombre: "Morado OSfit", primario: "#B388FF",
  primarioOscuro: "#6A1B9A", primarioClaro: "#E3D2FF", sobrePrimario: "#2A0064",
};

const listo = (paletas = [OCEANO, MORADO]) => ({ estado: "listo" as const, paletas });

describe("tarjetaPaletas", () => {
  it("mientras carga muestra el esqueleto y ningún botón", () => {
    const html = tarjetaPaletas({ estado: "cargando" }, null);
    expect(html).toContain("paletas-esqueleto");
    expect(html).not.toContain("data-paleta");
  });

  it("si falló ofrece reintentar", () => {
    const html = tarjetaPaletas({ estado: "error" }, null);
    expect(html).toContain("paletas-reintentar");
    expect(html).toContain("No pudimos cargar los colores");
  });

  it("pinta un botón por paleta, con su nombre y su color", () => {
    const html = tarjetaPaletas(listo(), null);
    expect(html).toContain(`data-paleta="oceano"`);
    expect(html).toContain(`data-paleta="morado_osfit"`);
    expect(html).toContain("Océano");
    expect(html).toContain("#6BB6FF");
  });

  it("marca la guardada, y sólo a ella", () => {
    const html = tarjetaPaletas(listo(), "oceano");
    expect(html).toContain(`data-paleta="oceano" class="paleta activa" aria-pressed="true"`);
    expect(html).toContain(`data-paleta="morado_osfit" class="paleta" aria-pressed="false"`);
  });

  /** Una clienta a la que nunca se le asignó paleta está viendo el morado de :root, así que
   *  "lo de siempre" se marca como la elegida en vez de dejar la rejilla sin marca. */
  it("sin paleta guardada marca el morado", () => {
    const html = tarjetaPaletas(listo(), null);
    expect(html).toContain(`data-paleta="morado_osfit" class="paleta activa"`);
    expect(html).toContain(`data-paleta="oceano" class="paleta" aria-pressed="false"`);
  });

  /** Un preset que se quitó de Kotlin. Es raro y real: no se marca ninguna y no truena. */
  it("con una guardada que ya no está en el catálogo no marca ninguna", () => {
    const html = tarjetaPaletas(listo(), "preset_retirado");
    expect(html).not.toContain("activa");
  });

  /**
   * Review Focus 4: un backend viejo o un despliegue a medias puede devolver la lista vacía.
   * Una rejilla en blanco sin explicación es peor que un error.
   */
  it("con el catálogo vacío explica en vez de dejar la rejilla en blanco", () => {
    const html = tarjetaPaletas(listo([]), null);
    expect(html).toContain("No hay colores disponibles");
    expect(html).not.toContain("data-paleta");
  });

  it("escapa el nombre", () => {
    const html = tarjetaPaletas(listo([{ ...OCEANO, nombre: "<script>" }]), null);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/ui/tarjetaPaletas.test.ts`
Expected: FAIL — `Failed to resolve import "./tarjetaPaletas"`.

- [ ] **Step 3: Write the rendering module**

Create `web/src/ui/tarjetaPaletas.ts`:

```ts
import { escapar } from "./tarjetaDia";

/**
 * La ventana Ajustes: elegir el color de la página. Ver
 * `docs/superpowers/specs/2026-09-25-ajustes-paleta-cliente-design.md`.
 */

/**
 * Una paleta como la sirve `obtenerPaletas`.
 *
 * GEMELO: `PaletaOpcion` en `functions/src/paletas.ts`. No se importa de allá porque `web/` y
 * `functions/` son dos proyectos npm separados, igual que pasa con `hoyEnMazatlan`.
 */
export interface PaletaOpcion {
  id: string;
  nombre: string;
  primario: string;
  primarioOscuro: string;
  primarioClaro: string;
  sobrePrimario: string;
}

export type EstadoPaletas =
  | { estado: "cargando" }
  | { estado: "listo"; paletas: PaletaOpcion[] }
  | { estado: "error" };

/** El id del por defecto de la web. GEMELO: `MORADO_OSFIT` en `functions/src/paletas.ts`. */
export const MORADO_OSFIT = "morado_osfit";

/**
 * Cuál se pinta marcada.
 *
 * Sin nada guardado cae en el morado, que es literalmente lo que la clienta está viendo: los
 * cuatro hex de `morado_osfit` son los de `:root` en `estilos.css`, y hay un test de Kotlin
 * que lo sostiene. Un id que ya no está en el catálogo no marca ninguna: la página sigue con
 * los hex guardados, y marcar otra sería mentirle sobre qué color tiene.
 */
function marcada(guardada: string | null, paletas: PaletaOpcion[]): string | null {
  if (guardada === null) return MORADO_OSFIT;
  return paletas.some((p) => p.id === guardada) ? guardada : null;
}

function muestra(p: PaletaOpcion): string {
  const franja = (color: string) =>
    `<span class="paleta-color" style="background: ${color}"></span>`;
  return `${franja(p.primario)}${franja(p.primarioClaro)}${franja(p.primarioOscuro)}`;
}

function boton(p: PaletaOpcion, activa: boolean): string {
  return `
        <button type="button" data-paleta="${p.id}" class="paleta${activa ? " activa" : ""}" aria-pressed="${activa}">
          <span class="paleta-muestras" aria-hidden="true">${muestra(p)}</span>
          <span class="paleta-nombre">${escapar(p.nombre)}</span>
        </button>`;
}

function cuerpo(estado: EstadoPaletas, guardada: string | null): string {
  if (estado.estado === "cargando") {
    return `<div class="paletas-esqueleto">${"<div></div>".repeat(6)}</div>`;
  }
  if (estado.estado === "error") {
    return `
      <div class="vacio" style="padding: 14px 8px">
        <div class="vacio-emoji">📡</div>
        <p><strong>No pudimos cargar los colores</strong></p>
        <button class="boton" id="paletas-reintentar">Reintentar</button>
      </div>`;
  }
  if (estado.paletas.length === 0) {
    return `
      <div class="vacio" style="padding: 14px 8px">
        <div class="vacio-emoji">🎨</div>
        <p><strong>No hay colores disponibles</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">Inténtalo de nuevo más tarde.</p>
      </div>`;
  }
  const activa = marcada(guardada, estado.paletas);
  return `<div class="paletas-rejilla">${
    estado.paletas.map((p) => boton(p, p.id === activa)).join("")
  }</div>`;
}

/**
 * `guardada` es sólo lo que dice Firestore. La elección optimista no entra por parámetro:
 * vive en el módulo (ver `eleccionOptimista`), por lo mismo que la pestaña del ranking.
 */
export function tarjetaPaletas(estado: EstadoPaletas, guardada: string | null): string {
  return `
    <div class="tarjeta paletas">
      <p class="tarjeta-titulo">Color de tu página</p>
      ${cuerpo(estado, guardada)}
    </div>`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/ui/tarjetaPaletas.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Declare the two callables**

En `web/src/acciones.ts`, añade al final, y añade `PaletaOpcion` al `import type`
de arriba (`import type { PaletaOpcion } from "./ui/tarjetaPaletas";`):

```ts
/** El catálogo para el selector de Ajustes. Lectura: no cambia nada del cliente. */
export const obtenerPaletas = httpsCallable<
  Record<string, never>,
  { paletas: PaletaOpcion[] }
>(functions, "obtenerPaletas");

/**
 * La paleta que eligió la clienta. Va el id y nada más: los hex los resuelve el servidor,
 * que es lo que impide que alguien se escriba colores arbitrarios desde la consola.
 */
export const elegirPaleta = httpsCallable<{ id: string }, { ok: true; id: string }>(
  functions,
  "elegirPaleta"
);
```

Actualiza también el comentario de cabecera del archivo, que dice "cuatro
escrituras y la lectura del ranking": ahora son cinco escrituras y dos lecturas.

- [ ] **Step 6: Verify it compiles and the whole suite passes**

Run: `cd web && npm run build`
Expected: PASS, sin errores de tipos.

Run: `cd web && npm test`
Expected: PASS, todas las suites.

- [ ] **Step 7: Commit**

```bash
git add web/src/ui/tarjetaPaletas.ts web/src/ui/tarjetaPaletas.test.ts web/src/acciones.ts
git commit -m "feat(web): render the palette grid for Ajustes

Pure rendering, no interaction yet: skeleton while loading, retry on failure,
and a button per palette with its swatches and name.

A client with no paletaWeb gets morado_osfit marked as chosen, because that is
literally what she is looking at — its four hexes are the ones in :root. A saved
id that is no longer in the catalogue marks nothing rather than lying about
which colour she has.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Elegir, con reversión

**Files:**
- Modify: `web/src/ui/tarjetaPaletas.ts`
- Modify: `web/src/ui/tarjetaPaletas.test.ts`

**Interfaces:**
- Consumes: `PaletaOpcion`, `MORADO_OSFIT`, `tarjetaPaletas` de la Tarea 3;
  `PaletaWeb` de `web/src/paleta.ts`, que ya existe y es lo que `aplicarPaleta`
  toma. **No se declara un `PaletaWeb` nuevo**: serían dos tipos con los mismos
  cuatro hex y el `id`, y el de `paleta.ts` es el que ya viaja en
  `Cliente.paletaWeb`.
- Produces:
  - `DepsEleccion` — `{ paletas, actual, aplicar, guardar, repintar }`.
  - `elegirPaletaLocal(id: string, deps: DepsEleccion): Promise<void>`.
  - `reiniciarPaletas(): void` — limpia el estado del módulo, para los tests.
  - `conectarPaletas(deps: DepsEleccion & { reintentar: () => void }): void`.
  - `tarjetaPaletas` pasa a preferir la elección optimista sobre `guardada`.

- [ ] **Step 1: Write the failing tests**

Añade a `web/src/ui/tarjetaPaletas.test.ts`:

```ts
import { beforeEach, vi } from "vitest";
import type { PaletaWeb } from "../paleta";
import { elegirPaletaLocal, reiniciarPaletas, type DepsEleccion } from "./tarjetaPaletas";

const hex = (p: PaletaOpcion): PaletaWeb => ({
  id: p.id, primario: p.primario, primarioOscuro: p.primarioOscuro,
  primarioClaro: p.primarioClaro, sobrePrimario: p.sobrePrimario,
});

function deps(campos: Partial<DepsEleccion> = {}): DepsEleccion {
  return {
    paletas: [OCEANO, MORADO],
    actual: null,
    aplicar: vi.fn(),
    guardar: vi.fn(async () => {}),
    repintar: vi.fn(),
    ...campos,
  };
}

describe("elegirPaletaLocal", () => {
  beforeEach(reiniciarPaletas);

  it("aplica el color al instante y guarda el id", async () => {
    const d = deps();
    await elegirPaletaLocal("oceano", d);
    expect(d.aplicar).toHaveBeenCalledWith(hex(OCEANO));
    expect(d.guardar).toHaveBeenCalledWith("oceano");
  });

  it("deja marcada la elegida antes de que Firestore conteste", async () => {
    const d = deps();
    await elegirPaletaLocal("oceano", d);
    expect(tarjetaPaletas(listo(), null)).toContain(`data-paleta="oceano" class="paleta activa"`);
  });

  it("un id fuera del catálogo no guarda ni aplica nada", async () => {
    const d = deps();
    await elegirPaletaLocal("turquesa_imaginaria", d);
    expect(d.guardar).not.toHaveBeenCalled();
    expect(d.aplicar).not.toHaveBeenCalled();
  });

  it("si guardar falla vuelve al morado cuando no había nada guardado", async () => {
    const d = deps({ guardar: vi.fn(async () => { throw new Error("sin red"); }) });
    await elegirPaletaLocal("oceano", d);
    expect(d.aplicar).toHaveBeenLastCalledWith(hex(MORADO));
    expect(tarjetaPaletas(listo(), null)).toContain("No pudimos guardar tu color");
  });

  it("si guardar falla vuelve a la que estaba guardada", async () => {
    const d = deps({
      actual: hex(OCEANO),
      guardar: vi.fn(async () => { throw new Error("sin red"); }),
    });
    await elegirPaletaLocal("morado_osfit", d);
    expect(d.aplicar).toHaveBeenLastCalledWith(hex(OCEANO));
  });

  /** Los hex de un preset retirado ya no están en el catálogo, pero sí en el documento: la
   *  reversión usa esos y no cae al morado, que sería cambiarle el color sin motivo. */
  it("revierte a los hex guardados aunque su id ya no esté en el catálogo", async () => {
    const retirada: PaletaWeb = {
      id: "preset_retirado", primario: "#111111", primarioOscuro: "#222222",
      primarioClaro: "#333333", sobrePrimario: "#444444",
    };
    const d = deps({
      actual: retirada,
      guardar: vi.fn(async () => { throw new Error("sin red"); }),
    });
    await elegirPaletaLocal("oceano", d);
    expect(d.aplicar).toHaveBeenLastCalledWith(retirada);
  });

  it("el error se limpia al volver a intentar", async () => {
    const falla = deps({ guardar: vi.fn(async () => { throw new Error("sin red"); }) });
    await elegirPaletaLocal("oceano", falla);
    expect(tarjetaPaletas(listo(), null)).toContain("No pudimos guardar tu color");

    await elegirPaletaLocal("oceano", deps());
    expect(tarjetaPaletas(listo(), null)).not.toContain("No pudimos guardar tu color");
  });

  /**
   * Review Focus 1. Toca Océano, toca Cereza, y recién entonces falla la de Océano. Sin la
   * guardia, esa falla tardía revierte el color que la clienta acaba de elegir y encima le
   * echa la culpa a la elección buena.
   */
  it("una falla vieja no pisa una elección más nueva", async () => {
    let fallarPrimera: () => void = () => {};
    const primera = new Promise<void>((_, rechazar) => {
      fallarPrimera = () => rechazar(new Error("sin red"));
    });
    const d = deps({ guardar: vi.fn(() => primera) });

    const enVuelo = elegirPaletaLocal("oceano", d);
    await elegirPaletaLocal("morado_osfit", deps({ paletas: d.paletas }));
    fallarPrimera();
    await enVuelo;

    expect(tarjetaPaletas(listo(), null)).toContain(`data-paleta="morado_osfit" class="paleta activa"`);
    expect(tarjetaPaletas(listo(), null)).not.toContain("No pudimos guardar tu color");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/ui/tarjetaPaletas.test.ts`
Expected: FAIL — `elegirPaletaLocal`, `reiniciarPaletas`, `DepsEleccion` y
`PaletaWeb` no están exportadas.

- [ ] **Step 3: Write the implementation**

En `web/src/ui/tarjetaPaletas.ts`, añade después de `MORADO_OSFIT`:

```ts
import type { PaletaWeb } from "../paleta";

/**
 * Del catálogo a lo que `aplicarPaleta` toma: las mismas cinco claves sin el nombre. Se
 * reutiliza `PaletaWeb` de `paleta.ts` en vez de declarar un tipo gemelo: es el que ya viaja
 * en `Cliente.paletaWeb`, así que la paleta guardada y la elegida son el mismo tipo.
 */
function soloHex(p: PaletaOpcion): PaletaWeb {
  const { nombre: _nombre, ...hex } = p;
  return hex;
}

/**
 * La elección adelantada y el error viven en el módulo, no en el DOM, por lo mismo que la
 * pestaña del ranking: `pintar()` rehace `#contenido` en CADA snapshot de Firestore, y una
 * asistencia marcada desde la app haría brincar la marca a la vieja mientras la escritura va
 * en camino.
 */
let eleccionOptimista: string | null = null;
let errorGuardar: string | null = null;

/**
 * Cuántas elecciones se hicieron. Una respuesta que falla tarde sólo revierte si sigue siendo
 * la última: sin esto, tocar Océano y enseguida Cereza deja que la falla de Océano pise el
 * color de Cereza —y muestre un error por una elección que sí funcionó. Mismo truco que
 * `pedidoRanking` en `main.ts`.
 */
let eleccion = 0;

/** Limpia el estado del módulo. Para los tests, que comparten el import. */
export function reiniciarPaletas(): void {
  eleccionOptimista = null;
  errorGuardar = null;
  eleccion = 0;
}

export interface DepsEleccion {
  paletas: PaletaOpcion[];
  /** El `paletaWeb` del documento, con sus hex. `null` si nunca se le asignó ninguna. */
  actual: PaletaWeb | null;
  aplicar: (p: PaletaWeb) => void;
  guardar: (id: string) => Promise<unknown>;
  repintar: () => void;
}

/**
 * Elegir una paleta: se aplica al instante y se guarda en segundo plano.
 *
 * El color se pinta antes de la llamada y no después, porque esperar al servidor —con un
 * arranque en frío de por medio— se sentiría como que el botón no responde. Si la escritura
 * falla, se vuelve a lo anterior; si funciona, el snapshot de `observarCliente` llega y
 * `main.ts` aplica los mismos colores, así que el estado optimista deja de hacer falta.
 */
export async function elegirPaletaLocal(id: string, deps: DepsEleccion): Promise<void> {
  const paleta = deps.paletas.find((p) => p.id === id);
  // Un id que no está en el catálogo no puede venir de un botón nuestro. Se ignora en vez de
  // mandarlo: el servidor lo rechazaría igual, pero por una llamada que no hacía falta.
  if (!paleta) return;

  const mia = ++eleccion;
  const anterior = deps.actual ?? soloHex(
    deps.paletas.find((p) => p.id === MORADO_OSFIT) ?? paleta
  );

  eleccionOptimista = id;
  errorGuardar = null;
  deps.aplicar(soloHex(paleta));

  try {
    await deps.guardar(id);
  } catch {
    // Sólo si sigue siendo la última: ver el comentario de `eleccion`.
    if (mia !== eleccion) return;
    eleccionOptimista = null;
    errorGuardar = "No pudimos guardar tu color. Inténtalo otra vez en un momento.";
    deps.aplicar(anterior);
    deps.repintar();
  }
}
```

Cambia `marcada` para que la elección optimista mande:

```ts
function marcada(guardada: string | null, paletas: PaletaOpcion[]): string | null {
  const elegida = eleccionOptimista ?? guardada;
  if (elegida === null) return MORADO_OSFIT;
  return paletas.some((p) => p.id === elegida) ? elegida : null;
}
```

Y pinta el error dentro de la tarjeta, en `tarjetaPaletas`:

```ts
export function tarjetaPaletas(estado: EstadoPaletas, guardada: string | null): string {
  return `
    <div class="tarjeta paletas">
      <p class="tarjeta-titulo">Color de tu página</p>
      ${cuerpo(estado, guardada)}
      ${errorGuardar ? `<p class="aviso-error">${escapar(errorGuardar)}</p>` : ""}
    </div>`;
}
```

Añade al final del archivo:

```ts
/** Se vuelve a colgar en cada repintado: `innerHTML` tira los listeners con los nodos. */
export function conectarPaletas(
  deps: DepsEleccion & { reintentar: () => void }
): void {
  document.querySelectorAll<HTMLElement>(".paletas [data-paleta]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.paleta;
      if (id) void elegirPaletaLocal(id, deps);
    });
  });
  document.querySelector("#paletas-reintentar")?.addEventListener("click", deps.reintentar);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/ui/tarjetaPaletas.test.ts`
Expected: PASS, 16 tests (las 8 de la Tarea 3 más las 8 nuevas).

Si "una falla vieja no pisa una elección más nueva" pasa sin la guardia de
`eleccion`, el test está mal escrito, no el código: quita la guardia, confirma
que falla, y vuelve a ponerla.

- [ ] **Step 5: Verify the whole suite and the build**

Run: `cd web && npm test`
Expected: PASS.

Run: `cd web && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/ui/tarjetaPaletas.ts web/src/ui/tarjetaPaletas.test.ts
git commit -m "feat(web): apply the chosen palette at once, roll back if the write fails

The colour is painted before the call, not after: waiting for the server with a
cold start in the way would feel like a dead button.

Reverting is always one operation because morado_osfit's four hexes are the ones
in :root, so 'no palette' is a palette — paleta.ts needs no way to unset.
Reverting uses the document's own hexes, so a client on a retired preset keeps
her colour instead of being dropped into purple.

A counter guards the rollback: tapping one palette then another let the first
one's late failure overwrite the second's colour and blame the good choice.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Ajustes deja de decir "Muy pronto"

**Files:**
- Modify: `web/src/ventanas.ts`
- Modify: `web/src/ventanas.test.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: `tarjetaPaletas`, `conectarPaletas`, `EstadoPaletas` de las Tareas 3 y 4; `obtenerPaletas`, `elegirPaleta` de `acciones.ts`.
- Produces: `DatosCliente.paletas: EstadoPaletas`.

- [ ] **Step 1: Update the two assertions that describe the old behaviour**

En `web/src/ventanas.test.ts`:

Añade `paletas: { estado: "cargando" },` al objeto que devuelve `datos()`,
junto a `ranking`.

Reemplaza el test de la línea 42:

```ts
  it("ya ninguna ventana está por venir", () => {
    expect(VENTANAS.filter((v) => v.proximamente).map((v) => v.id)).toEqual([]);
  });
```

Y el de "Ajustes dice Muy pronto", al final del archivo:

```ts
  it("Ajustes pinta el selector de color", () => {
    const html = contenidoDe(ventana("ajustes"), datos({
      paletas: { estado: "listo", paletas: [{
        id: "oceano", nombre: "Océano", primario: "#6BB6FF",
        primarioOscuro: "#123A75", primarioClaro: "#D2E8FF", sobrePrimario: "#04162B",
      }] },
    }));
    expect(html).not.toContain("Muy pronto");
    expect(html).toContain("Color de tu página");
    expect(html).toContain(`data-paleta="oceano"`);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/ventanas.test.ts`
Expected: FAIL — `ya ninguna ventana está por venir` da `["ajustes"]`, y Ajustes
sigue pintando "Muy pronto".

- [ ] **Step 3: Give Ajustes its content**

En `web/src/ventanas.ts`:

Añade el import:

```ts
import { tarjetaPaletas, type EstadoPaletas } from "./ui/tarjetaPaletas";
```

Añade el campo a `DatosCliente`, junto a `ranking`:

```ts
  /** El catálogo de paletas; lo pide `main.ts` al entrar a Ajustes, una sola vez. */
  paletas: EstadoPaletas;
```

Reemplaza la entrada de Ajustes en `VENTANAS`:

```ts
  {
    id: "ajustes", titulo: "Ajustes", icono: "⚙️", grupo: "pie",
    pintar: (d) => tarjetaPaletas(d.paletas, d.cliente.paletaWeb?.id ?? null),
  },
```

`contenidoDe` no se toca: su rama `if (v.proximamente)` sigue siendo correcta
para la próxima ventana que nazca vacía.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/ventanas.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into main.ts**

En `web/src/main.ts`:

Añade a los imports:

```ts
import { conectarPaletas, type EstadoPaletas, type PaletaOpcion } from "./ui/tarjetaPaletas";
import { elegirPaleta, obtenerPaletas } from "./acciones";
```

(`obtenerRanking` ya viene de `./acciones`; añade los dos nombres a ese import
en vez de escribir una línea nueva.)

Junto a la variable `ranking`, declara:

```ts
  let paletas: EstadoPaletas = { estado: "cargando" };
```

Después de `cargarRanking`, añade:

```ts
  /**
   * El catálogo se pide UNA vez y se queda: son quince constantes compiladas en la función, a
   * diferencia del ranking, que cambia cada día. Reintentar tras un error sí vuelve a pedir.
   */
  function cargarPaletas(): void {
    if (paletas.estado === "listo") return;
    paletas = { estado: "cargando" };
    obtenerPaletas({}).then(
      (r) => {
        paletas = { estado: "listo", paletas: r.data.paletas as PaletaOpcion[] };
        pintar();
      },
      () => {
        paletas = { estado: "error" };
        pintar();
      }
    );
  }
```

En `pintar()`, junto a la línea que carga el ranking al entrar:

```ts
    if (activa.id === "ajustes" && activa.id !== ventanaPintada) cargarPaletas();
```

Añade `paletas` al objeto que se le pasa a `contenidoDe`, junto a `ranking`.

Y antes del bloque `if (activa.id === "ranking")`, añade el suyo:

```ts
    if (activa.id === "ajustes") {
      conectarPaletas({
        paletas: paletas.estado === "listo" ? paletas.paletas : [],
        actual: cliente.paletaWeb ?? null,
        aplicar: (p) => aplicarPaleta(p, document.documentElement),
        guardar: (id) => elegirPaleta({ id }),
        repintar: pintar,
        reintentar: () => {
          paletas = { estado: "cargando" };
          cargarPaletas();
          pintar();
        },
      });
      return;
    }
```

- [ ] **Step 6: Verify the build and the whole suite**

Run: `cd web && npm run build`
Expected: PASS. `cliente.paletaWeb` encaja con `DepsEleccion.actual` sin
conversiones, porque la Tarea 4 usa el `PaletaWeb` de `paleta.ts` y no un tipo
gemelo.

Run: `cd web && npm test`
Expected: PASS, todas las suites.

- [ ] **Step 7: Commit**

```bash
git add web/src/ventanas.ts web/src/ventanas.test.ts web/src/main.ts
git commit -m "feat(web): open Ajustes with the colour picker in it

Ajustes loses proximamente and gains pintar, so the 'Pronto' badge disappears
from the side menu on its own — it is derived from that flag, not from a second
list.

main.ts follows the Ranking precedent: load on entering the window, state in
DatosCliente, listeners reconnected after the innerHTML. Unlike the ranking, the
catalogue is fetched once and kept: fifteen constants compiled into the function
do not change during a session.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Los estilos, y verlo funcionar

**Files:**
- Modify: `web/src/estilos.css`

**Interfaces:**
- Consumes: las clases que pinta `tarjetaPaletas`: `.paletas`,
  `.paletas-rejilla`, `.paleta`, `.paleta.activa`, `.paleta-muestras`,
  `.paleta-color`, `.paleta-nombre`, `.paletas-esqueleto`.
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Add the styles**

Al final de `web/src/estilos.css`, siguiendo el estilo del archivo (variables,
sin anidar, una clase por línea de responsabilidad):

```css
/* Ajustes: la rejilla de paletas. Tres columnas en teléfono, que es donde se abre siempre. */
.paletas-rejilla {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 4px;
}

.paleta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  padding: 10px 6px;
  background: var(--superficie-alta);
  border: 2px solid transparent;
  border-radius: 12px;
  color: var(--texto);
  font: inherit;
  cursor: pointer;
}

/* El borde marca la elegida y no un relleno: el relleno competiría con las muestras. */
.paleta.activa {
  border-color: var(--primario);
}

.paleta-muestras {
  display: flex;
  overflow: hidden;
  border-radius: 8px;
}

.paleta-color {
  width: 18px;
  height: 26px;
}

.paleta-nombre {
  font-size: 12px;
  line-height: 1.2;
  text-align: center;
  color: var(--texto-tenue);
}

.paleta.activa .paleta-nombre {
  color: var(--texto);
}

.paletas-esqueleto {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 4px;
}

.paletas-esqueleto div {
  height: 64px;
  border-radius: 12px;
  background: var(--superficie-alta);
}
```

- [ ] **Step 2: Verify nothing broke**

Run: `cd web && npm test`
Expected: PASS — el CSS no entra en los tests, pero conviene confirmar que no se
tocó nada más.

Run: `cd web && npm run build`
Expected: PASS.

- [ ] **Step 3: See it in the real page**

Esto no se prueba unitariamente, por convención del repo. Levanta la página
(`cd web && npm run dev`) o despliega, y entra con el link de prueba de una
clienta. Comprueba las cinco cosas:

1. La rejilla se ve completa, con las 15 paletas y sus nombres legibles.
2. Al tocar una, **toda la página** cambia de color al instante.
3. Al recargar, la que tocaste sigue marcada (es lo que dice Firestore).
4. Con el modo avión puesto, tocar una revierte el color y aparece el aviso.
5. En el menú lateral, Ajustes **ya no** tiene el badge "Pronto".

- [ ] **Step 4: Commit**

```bash
git add web/src/estilos.css
git commit -m "feat(web): style the palette grid

Three columns, since the page only ever opens on a phone. The chosen one is
marked with a border rather than a fill: a fill would compete with the swatches
it is meant to frame.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Despliegue

Las dos funciones son nuevas, así que **`functions/` va antes que `web/`**: una
página que llame a `obtenerPaletas` contra un backend viejo deja Ajustes en el
estado de error.

```bash
cd functions && npm run deploy
cd ../web && npm run build   # y subir lo que quede en dist/
```

`firestore.rules` no cambió, así que no hay nada que desplegar ahí. Nada que
migrar: los documentos que ya tienen `paletaWeb` escrito por la app siguen
válidos, porque la forma del campo no cambia.
