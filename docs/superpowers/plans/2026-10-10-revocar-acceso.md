# Revocar el acceso de una clienta de verdad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que "Revocar acceso" saque a la clienta de verdad: deja de ver sus datos en segundos (también con la página abierta o instalada), sus acciones dejan de funcionar, no le llegan más avisos y ve "Tu acceso ya no está activo". Un link nuevo que le manden después funciona sin más.

**Architecture:** Una fecha de corte `accesoRevocadoEn` en `clientes/{id}`. Toda sesión cuyo `auth_time` (hora del canje original, firmada por Firebase) sea anterior al corte deja de servir: lo exigen las reglas de Firestore y Storage y `clienteDeLaSesion` en las callables. La escribe un trigger nuevo, `alRevocarAcceso`, al borrarse `accesosWeb/{token}`; el mismo trigger anula la renovación de la sesión (`revokeRefreshTokens`) y borra sus `dispositivos`. La web convierte la pérdida de acceso en el candado de revocado. La app pide confirmación y muestra "Acceso revocado el {fecha}".

**Tech Stack:** Cloud Functions v2 (TypeScript, vitest), reglas de Firestore y Storage, web Vite + TypeScript (vitest), Android Kotlin + Compose (JUnit para lo puro).

**Spec:** `docs/superpowers/specs/2026-10-10-revocar-acceso-design.md`. **Léelo completo antes de empezar.** Este plan dice qué escribir; el spec dice por qué.

## Global Constraints

- **Sin corte, nada cambia.** Si `accesoRevocadoEn` no existe, reglas, callables y web se comportan exactamente como hoy. Es lo que permite desplegar por partes sin riesgo.
- **`auth_time` está en segundos y `toMillis()` en milisegundos.** Comparar siempre como `auth_time * 1000 > corte` (en reglas y en funciones). Estrictamente mayor: una sesión del mismo instante que el corte no pasa.
- **El trigger escribe el corte primero**, antes de `revokeRefreshTokens` y del borrado de dispositivos: es lo que corta al instante. Cada paso en su propio `try` con `logger.error`; uno que falla no impide los demás. Idempotente.
- **`notificacionesWeb` no se toca** (decisión 1 del spec).
- **Texto del candado, exacto:** "Tu acceso ya no está activo." / "Pídele a tu entrenador un link nuevo."
- **Funciones: desplegar siempre por nombre** (`--only functions:<nombre>`). Un `--only functions` a secas intentaría borrar `guardarEstilo` (punto 1 del backlog).
- El trigger va en `us-central1` (Firestore en `nam5`), como `enviarNotificacion`. Las callables siguen en `REGION` (`us-west1`).
- La entrada rápida de la página instalada (`resolverSesion`, mismo token + sesión guardada) **se queda**.
- Campos nuevos opcionales en la web; en Kotlin con valor por defecto `null`.
- Commits en inglés con prefijo (`feat:`, `docs:`…) y `Co-Authored-By:` con tu atribución. Un commit por task, push al cerrar cada una, en la rama que indique la sesión.
- **Desplegar requiere confirmación del entrenador** (Task 7).

## Review Focus

- Sesión anterior al corte → rechazada en reglas y callables; posterior al corte (link nuevo) → pasa; sin corte → pasa (tests en Task 1, verificación manual en Task 7).
- Las reglas que comparan el claim directo (`asistencias`, `cambiosDia`, `avisosFalta`, `ruletas`) también exigen sesión vigente (Task 3).
- Página abierta al revocar → candado de revocado en segundos, no "No pudimos traer tus datos" (Task 7).
- Un link rechazado que era el token recordado se olvida (test en Task 4).
- Tras revocar, un aviso desde la app ya no llega al teléfono viejo (Task 7).
- El diálogo cancela sin hacer nada; "Revocar" revoca (Task 7).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `functions/src/corteAcceso.ts` (+ `.test.ts`) | Crear | `sesionVigente(authTime, corteMillis)`, puro. |
| `functions/src/comun.ts` | Modificar | `clienteDeLaSesion` async, con el corte. |
| `functions/src/{avisarFalta,cambiarDia,jugarRuleta,ranking,registrarDispositivo,revivirRacha}.ts` | Modificar | `await clienteDeLaSesion(request)`. |
| `functions/src/alRevocarAcceso.ts` | Crear | El trigger. |
| `functions/src/index.ts` | Modificar | Exportar `alRevocarAcceso`. |
| `firestore.rules` | Modificar | `sesionVigente` en `esCliente` y en las reglas por claim. |
| `storage.rules` | Modificar | `sesionVigente` con `firestore.get`. |
| `web/src/sesion.ts` (+ test) | Modificar | Motivo `revocado`; olvidar el token recordado si el link se rechaza. |
| `web/src/firebase.ts` | Modificar | `renovarCredencial` devuelve el resultado; `cerrarSesion()`. |
| `web/src/datos.ts` | Modificar | `alPerderAcceso`; no reintentar tras perderlo. |
| `web/src/main.ts` | Modificar | Candado de revocado. |
| `app/.../data/model/Cliente.kt` | Modificar | `accesoRevocadoEn: Timestamp?`. |
| `app/.../util/TextoEntradas.kt` (+ test) | Modificar | `revocado(momento, zona)`. |
| `app/.../ui/clientes/ClienteDetailScreen.kt` | Modificar | Diálogo de confirmación y renglón "Acceso revocado el…". |
| `docs/backlog-2.md` | Modificar | Estado al terminar. |

`app/...` = `app/src/main/java/com/osfit/app`.

---

### Task 1: Fecha de corte en las callables

**Files:**
- Create: `functions/src/corteAcceso.ts`, `functions/src/corteAcceso.test.ts`
- Modify: `functions/src/comun.ts` y las seis callables

- [ ] **Step 1: Test que falla**

`functions/src/corteAcceso.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sesionVigente } from "./corteAcceso";

describe("sesionVigente", () => {
  const corte = Date.parse("2026-10-10T18:00:00Z");

  it("sin corte, cualquier sesión sirve", () => {
    expect(sesionVigente(1_000, null)).toBe(true);
  });

  it("una sesión iniciada antes del corte ya no sirve", () => {
    expect(sesionVigente(corte / 1000 - 60, corte)).toBe(false);
  });

  it("una del mismo segundo que el corte tampoco", () => {
    expect(sesionVigente(corte / 1000, corte)).toBe(false);
  });

  it("una iniciada después del corte (link nuevo) sí", () => {
    expect(sesionVigente(corte / 1000 + 1, corte)).toBe(true);
  });

  it("sin auth_time y con corte, no sirve", () => {
    expect(sesionVigente(undefined, corte)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla** — `npm --prefix functions test -- corteAcceso` → falla (no existe el módulo).

- [ ] **Step 3: Implementar**

`functions/src/corteAcceso.ts`:

```ts
/**
 * Si una sesión sigue valiendo frente a la fecha de corte del cliente.
 *
 * `authTime` es el `auth_time` del token: la hora del canje original, en segundos, que no
 * cambia al renovarse. `corteMillis` es `accesoRevocadoEn` en milisegundos, o `null` si
 * nunca se revocó. GEMELO de `sesionVigente` en `firestore.rules` y `storage.rules`.
 */
export function sesionVigente(authTime: number | undefined, corteMillis: number | null): boolean {
  if (corteMillis === null) return true;
  return typeof authTime === "number" && authTime * 1000 > corteMillis;
}
```

En `functions/src/comun.ts`, `clienteDeLaSesion` pasa a:

```ts
export async function clienteDeLaSesion(request: CallableRequest): Promise<string> {
  const clienteId = request.auth?.token?.clienteId;
  if (typeof clienteId !== "string" || clienteId === "") {
    throw new HttpsError("unauthenticated", "sesion_invalida");
  }
  const corte = (await db().collection("clientes").doc(clienteId).get())
    .get("accesoRevocadoEn") as Timestamp | undefined;
  if (!sesionVigente(request.auth?.token?.auth_time, corte ? corte.toMillis() : null)) {
    throw new HttpsError("unauthenticated", "acceso_revocado");
  }
  return clienteId;
}
```

(con `import type { Timestamp } from "firebase-admin/firestore"` e `import { sesionVigente } from "./corteAcceso"`, y el comentario de la función actualizado: además del claim, exige sesión posterior al corte).

En las seis callables: `const clienteId = await clienteDeLaSesion(request);`.

- [ ] **Step 4: Verificar** — `npm --prefix functions test` y `npm --prefix functions run build` en verde.

- [ ] **Step 5: Commit** — `feat(functions): reject callable sessions started before access revocation`.

---

### Task 2: Trigger `alRevocarAcceso`

**Files:**
- Create: `functions/src/alRevocarAcceso.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implementar**

```ts
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { db } from "./comun";

/** Firestore está en `nam5`: sus triggers van en `us-central1` (ver `enviarNotificacion`). */
const REGION_FIRESTORE = "us-central1";

/**
 * Revocar de verdad. La app solo borra `accesosWeb/{token}`; esto hace el resto.
 * Ver docs/superpowers/specs/2026-10-10-revocar-acceso-design.md.
 *
 * El corte va primero porque es lo que saca a la clienta al instante (reglas y callables lo
 * miran). Cada paso falla por su cuenta, y repetirlo deja todo igual, así que un reintento
 * de Eventarc no hace daño.
 */
export const alRevocarAcceso = onDocumentDeleted(
  { document: "accesosWeb/{token}", region: REGION_FIRESTORE },
  async (event) => {
    const clienteId = event.data?.get("clienteId");
    if (typeof clienteId !== "string" || clienteId === "") return;
    const cliente = db().collection("clientes").doc(clienteId);

    try {
      await cliente.update({ accesoRevocadoEn: FieldValue.serverTimestamp() });
    } catch (error) {
      logger.error("No se pudo escribir el corte", { clienteId, error });
    }
    try {
      await getAuth().revokeRefreshTokens(clienteId);
    } catch (error) {
      logger.error("No se pudo anular la sesión", { clienteId, error });
    }
    try {
      const dispositivos = await cliente.collection("dispositivos").listDocuments();
      const lote = db().batch();
      dispositivos.forEach((d) => lote.delete(d));
      if (dispositivos.length > 0) await lote.commit();
    } catch (error) {
      logger.error("No se pudieron borrar los dispositivos", { clienteId, error });
    }
  }
);
```

(Un lote admite 500 escrituras; una clienta tiene pocos teléfonos.)

`functions/src/index.ts`: `export { alRevocarAcceso } from "./alRevocarAcceso";`

- [ ] **Step 2: Verificar** — `npm --prefix functions run build` y `npm --prefix functions test` en verde.

- [ ] **Step 3: Commit** — `feat(functions): revoke session and devices when a web access is deleted`.

---

### Task 3: Reglas de Firestore y Storage

**Files:** `firestore.rules`, `storage.rules`

- [ ] **Step 1: Leer los dos archivos completos.**

- [ ] **Step 2: Firestore**

Agregar, junto a `esCliente`:

```
// GEMELO de `sesionVigente` en functions/src/corteAcceso.ts. `auth_time` es la hora del
// canje original (segundos, firmada, no cambia al renovarse); `accesoRevocadoEn` la escribe
// `alRevocarAcceso`. Sin corte, pasa todo como antes.
function sesionVigente(cid) {
  let corte = get(/databases/$(database)/documents/clientes/$(cid)).data.get('accesoRevocadoEn', null);
  return corte == null || request.auth.token.auth_time * 1000 > corte.toMillis();
}
```

- `esCliente(cid)` agrega `&& sesionVigente(cid)`.
- En `match /clientes/{cid}`, la regla de lectura del propio documento puede usar
  `resource.data` en vez de `get()` (sin lectura extra): `esCliente` con una variante
  `esClienteDelDoc(cid)` que mire `resource.data.get('accesoRevocadoEn', null)`.
- `asistencias` y `cambiosDia`: `resource.data.clienteId == request.auth.token.clienteId && sesionVigente(request.auth.token.clienteId)`.
- `avisosFalta` y `ruletas`: lo mismo sobre `doc.split('_')[0]`.

- [ ] **Step 3: Storage**

```
function sesionVigente(cid) {
  let corte = firestore.get(/databases/(default)/documents/clientes/$(cid)).data.get('accesoRevocadoEn', null);
  return corte == null || request.auth.token.auth_time * 1000 > corte.toMillis();
}
```

y `esCliente(cid)` agrega `&& sesionVigente(cid)`. (La regla de `insignias/` sigue con `request.auth != null`: no son datos personales.)

- [ ] **Step 4: Verificar sintaxis** — `firebase deploy --only firestore:rules,storage --dry-run --project osfit-cccfe` compila las reglas sin publicarlas. No hay emulador de reglas en el repo: la prueba de comportamiento es la de Task 7.

- [ ] **Step 5: Commit** — `feat(rules): require sessions started after access revocation`.

---

### Task 4: La web — sesión y motivo `revocado`

**Files:** `web/src/sesion.ts`, `web/src/sesion.test.ts`

- [ ] **Step 1: Tests que fallan** (en el `describe("resolverSesion")`):

```ts
it("un link rechazado que era el recordado se olvida", async () => {
  const e = entorno({ ruta: "/c/tok1", recordado: "tok1", canje: () => ({ estado: "sin-acceso" }) });
  expect(await resolverSesion(e)).toEqual({ estado: "sin-acceso", motivo: "link-rechazado" });
  expect(e.memoria.recordado()).toBe(null);
});

it("un link rechazado distinto al recordado no borra el recordado", async () => {
  const e = entorno({ ruta: "/c/tok2", recordado: "tok1", canje: () => ({ estado: "sin-acceso" }) });
  await resolverSesion(e);
  expect(e.memoria.recordado()).toBe("tok1");
});
```

- [ ] **Step 2: Implementar**
  - `MotivoSinAcceso` agrega `"revocado"`: perdió el acceso con la página ya abierta (documentarlo en el comentario del tipo).
  - En el escalón 1 de `resolverSesion`, si el canje da `sin-acceso` y `memoria.recordado() === deLaUrl`, `memoria.olvidar()`.

- [ ] **Step 3: Verificar** — `npm --prefix web test`, `npx --prefix web tsc -p web`.

- [ ] **Step 4: Commit** — `feat(web): forget a rejected remembered link and add revoked reason`.

---

### Task 5: La web — candado al perder el acceso

**Files:** `web/src/firebase.ts`, `web/src/datos.ts`, `web/src/main.ts`

- [ ] **Step 1: `firebase.ts`**
  - `renovarCredencial(): Promise<ResultadoSesion["estado"]>`: `"lista"` si la renovación forzada funcionó; si no, el `estado` de `iniciarSesion()`.
  - `export async function cerrarSesion(): Promise<void>`: `signOut(auth)` (importar `signOut` de `firebase/auth`) y `memoriaToken(almacenesDelNavegador()).olvidar()`, cada uno en su `try`.

- [ ] **Step 2: `datos.ts`**
  - `let reportarPerdida: () => void = () => {}` y `export function alPerderAcceso(escucha: () => void)`, igual que `alFallarDatos`.
  - En `escuchar`, el primer reintento por `permission-denied`: si `renovarCredencial()` devuelve `"sin-acceso"`, llamar `reportarPerdida()` y **no** reconectar (`vivo = false`). Los demás estados siguen como hoy.

- [ ] **Step 3: `main.ts`**
  - Registrar `alPerderAcceso` en `arrancar()`, junto a `alFallarDatos`. Una sola vez (guardia `let perdido = false`): `cerrarSesion()` y `mostrarEnlaceInvalido("revocado")`.
  - En `mostrarEnlaceInvalido`, para `motivo === "revocado"`: emoji 🔒, "Tu acceso ya no está activo." y "Pídele a tu entrenador un link nuevo." Se conserva el renglón chico de diagnóstico.
  - Con el candado puesto, los repintados de los listeners no deben taparlo: `pintar()` sale si `perdido`.

- [ ] **Step 4: Verificar** — `npm --prefix web test`, `npx --prefix web tsc -p web`, `npm --prefix web run build`.

- [ ] **Step 5: Commit** — `feat(web): show revoked screen when access is lost mid-session`.

---

### Task 6: La app — confirmación y "Acceso revocado el…"

**Files:** `Cliente.kt`, `TextoEntradas.kt` (+ `TextoEntradasTest.kt`), `ClienteDetailScreen.kt`

- [ ] **Step 1: Test que falla** en `app/src/test/java/com/osfit/app/util/TextoEntradasTest.kt`:

```kotlin
@Test
fun `revocado dice la fecha en la zona del gimnasio`() {
    val momento = Instant.parse("2026-10-11T03:00:00Z") // 10 de octubre, 8 pm en Mazatlán
    assertEquals(
        "Acceso revocado el 10 de octubre de 2026",
        TextoEntradas.revocado(momento, ZoneId.of("America/Mazatlan"))
    )
}
```

- [ ] **Step 2: Implementar**
  - `TextoEntradas.revocado(momento: Instant, zona: ZoneId): String` con `DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale("es", "MX"))`.
  - `Cliente.kt`: `val accesoRevocadoEn: Timestamp? = null`, con comentario: lo escribe la función `alRevocarAcceso`, nunca la app.
  - `ClienteDetailScreen.kt`, tarjeta "Acceso web":
    - Si `acceso == null` y `clienteActual.accesoRevocadoEn != null`: el renglón muestra `TextoEntradas.revocado(...)` en vez de "Todavía no le compartiste su página personal."
    - "Revocar acceso" abre un `AlertDialog` (`var confirmarRevocar by remember { mutableStateOf(false) }`) con el título "¿Revocar el acceso de {nombre}?", el texto del spec, el último acceso (`TextoEntradas.resumen`), "Cancelar" y "Revocar" (color de error). Solo "Revocar" llama `viewModel.revocarAccesoWeb()`.

- [ ] **Step 3: Verificar** — `./gradlew testDebugUnitTest` y `./gradlew assembleDebug`. Si la sesión no tiene Android SDK, decirlo y dejar la compilación para el entrenador (como en el recordatorio de pago).

- [ ] **Step 4: Commit** — `feat(app): confirm before revoking web access and show revocation date`.

---

### Task 7: Despliegue y verificación (con confirmación del entrenador)

- [ ] **Step 1: Pedir confirmación** para desplegar a producción.

- [ ] **Step 2: Desplegar en este orden** (cada paso es seguro sin el siguiente, porque sin corte nada cambia):
  1. `firebase deploy --only functions:alRevocarAcceso,functions:avisarFalta,functions:cambiarDia,functions:jugarRuleta,functions:obtenerRanking,functions:registrarDispositivo,functions:revivirRacha --project osfit-cccfe`
  2. `firebase deploy --only firestore:rules,storage --project osfit-cccfe` (aceptar el permiso de reglas de Storage → Firestore si lo pide).
  3. `firebase deploy --only hosting --project osfit-cccfe`
  4. App: compilarla e instalarla en el teléfono del entrenador.

- [ ] **Step 3: Verificar con una clienta de prueba** (no una real):
  1. Compartirle acceso, entrar desde su link en un teléfono, instalarla en inicio y activar notificaciones.
  2. Con la página abierta, revocar desde la app (probar antes "Cancelar": no pasa nada). En segundos: candado "Tu acceso ya no está activo".
  3. Abrir desde el ícono instalado: candado.
  4. Mandar un aviso desde Avisos: no le llega ("Llegó a 0 teléfonos").
  5. La ficha dice "Acceso revocado el {hoy}".
  6. "Compartir acceso web" con link nuevo: entra normal desde el link nuevo, y la ruleta / avisar falta funcionan.
  7. Una clienta real sin revocar sigue entrando normal (las reglas nuevas no la afectan).

- [ ] **Step 4: Registrar** en este plan qué se verificó y en qué teléfono, y marcar el punto 6 de `docs/backlog-2.md` como hecho. Commit `docs: mark access revocation as done`.

## Registro de verificación

**2026-10-10, antes de desplegar:**

- `functions/`: 110 tests en verde (incluye `corteAcceso.test.ts`).
- Reglas: evaluadas con la API de pruebas de reglas de Firebase (`firebaserules.googleapis.com
  …:test`, con `functionMocks` para el `get` / `firestore.get` del cliente), sin publicarlas.
  14 casos de Firestore (sin corte, con corte, link nuevo, otra clienta, entrenador, medallas,
  asistencias, ruletas, avisosFalta, cambiosDia) y 4 de Storage: todos como se esperaba.
- `web/`: 434 tests en verde y build bien.
- App: `testDebugUnitTest` (45 archivos de resultados, sin fallas) y `assembleDebug` bien.

**2026-10-10, despliegue:** funciones (7, por nombre), reglas de Firestore y Storage, y hosting.

- **Ojo para la próxima:** las reglas de Storage que leen Firestore necesitan el rol
  "Firebase Rules Firestore Service Agent" (`roles/firebaserules.firestoreServiceAgent`) para
  `service-754891137796@gcp-sa-firebasestorage.iam.gserviceaccount.com`. El CLI lo pide al
  desplegar en modo interactivo; con `--non-interactive` no lo pide y las reglas se publican
  igual. Entre el despliegue y que el entrenador dio el rol en la consola de IAM (unos
  minutos), Storage denegó los videos a las clientas. Ya está dado.
- Comprobado después: una sesión de una clienta activa pasa la regla de `resumenes/` (404 en
  un archivo inexistente) y la carpeta de otra clienta sigue bloqueada (403).
- App: APK de depuración entregado al entrenador para instalar.

Pendiente: Step 3 (prueba con una clienta de prueba) y Step 4.
