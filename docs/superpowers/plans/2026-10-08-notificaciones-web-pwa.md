# Notificaciones a los clientes (PWA + avisos desde la app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el entrenador mande avisos push ("ya llegamos", "ya nos fuimos", texto libre) desde la app a las clientas que él habilitó y que activaron las notificaciones en su teléfono. En iPhone eso exige que la clienta **instale la página en su pantalla de inicio y la abra desde ese ícono**: es la única forma en que iOS deja recibir notificaciones de una web.

**Architecture:** La web se vuelve instalable (manifest sin `start_url`, para que la versión instalada abra en el `/c/<token>` de la clienta) y registra un service worker propio que muestra los avisos. Al activar, la página saca un token FCM y lo guarda con la callable `registrarDispositivo` en `clientes/{id}/dispositivos`. La app escribe cada aviso en `notificaciones/{id}`; un trigger de Firestore (`enviarNotificacion`) filtra a las habilitadas, manda por token con `sendEachForMulticast` y anota el resultado en el mismo documento, que sirve de historial.

**Tech Stack:** Firebase Functions v2 (`onCall`, `onDocumentCreated`, TypeScript commonjs), Admin SDK (Firestore, Messaging), web Vite + TypeScript + Firebase JS SDK 12 (`firebase/messaging` cargado bajo demanda), Android Kotlin + Jetpack Compose + Firestore. Pruebas: vitest (`functions/`, `web/`) y JUnit4 (`app/.../domain`).

**Spec:** `docs/superpowers/specs/2026-10-08-notificaciones-web-pwa-design.md` — **léelo completo antes de empezar**. Este plan dice qué escribir; el spec dice por qué.

## Global Constraints

- **En iPhone, nada funciona fuera de la página instalada.** iOS 16.4+, instalada con "Compartir → Agregar a inicio" desde **Safari** y abierta **desde el ícono**. En Safari normal y en el navegador interno de WhatsApp no existe la API de notificaciones. Toda la UI de la web parte de eso.
- **El manifest NO lleva `start_url`.** Sin él, la página instalada abre en la dirección desde donde se instaló (`/c/<token>`) y entra por el escalón 1 de `resolverSesion`. Agregar `start_url` rompe la sesión de todas las clientas instaladas.
- **El token se queda en la barra.** No reintroducir el `replaceState` que lo escondía (ver `resolverSesion` en `web/src/sesion.ts`).
- **Dos llaves:** recibe solo quien tenga `notificacionesWeb === true` (lo pone el entrenador) **y** un dispositivo registrado (lo pone la clienta). Una clienta elegida a mano pero no habilitada **no** recibe. Inactivas (`activo !== true`) tampoco.
- **La web nunca escribe en Firestore:** el token va por la callable `registrarDispositivo`, y `web/src/acciones.ts` sigue siendo el único archivo con `httpsCallable`.
- **El permiso se pide dentro del toque:** `Notification.requestPermission()` es lo **primero** que se espera en el manejador del botón. Si antes hay otro `await` (registrar el service worker, importar el SDK), iOS deja de considerarlo un gesto de la clienta y el permiso falla en silencio.
- **Mensajes solo de datos** (`data: { titulo, texto }`), y el service worker llama siempre a `showNotification`. iOS revoca la suscripción si llega un push que no muestra notificación.
- **TTL de 4 horas** (`webpush.headers.TTL = "14400"`): un "ya llegamos" que llega al día siguiente es peor que no llegar.
- **Solo se borran tokens que FCM declara muertos** (`messaging/registration-token-not-registered`, `messaging/invalid-registration-token`). Nunca por `invalid-argument` ni por errores de red: un payload mal armado borraría los tokens de todas.
- `functions/` y `web/` son proyectos npm separados; lo compartido se duplica con comentario `GEMELO`. En `functions/` los comentarios van sin acentos, como el resto de ese proyecto.
- Kotlin: data classes con valor por defecto en todos los campos; el `id` se escribe con `.copy(id = "")`; repositorios como clases planas; ViewModels con repositorios por constructor y `AppContainer.xxx` por defecto.
- Campos nuevos en la web, opcionales (Firestore omite lo que nunca se escribió).
- Commits en inglés con prefijo (`feat:`, `docs:`…) y `Co-Authored-By:` con tu atribución. **Se trabaja directo en `main`** (pedido del entrenador): commit y push a `main` al cerrar cada task.
- **Desplegar requiere confirmación del entrenador** cada vez (hosting, reglas, funciones).

## Review Focus

- Instalada desde `/c/<token>`, cerrada y abierta desde el ícono → entra sin candado (Task 1, en iPhone real). **Si falla, se detiene todo el plan.**
- Clienta elegida a mano sin `notificacionesWeb` → no está en las destinatarias (test en Task 2).
- `invalid-argument` o error de red al enviar → el token **no** se borra (test en Task 2).
- El trigger corre dos veces para el mismo aviso → se envía una sola vez (guardia de estado en Task 4).
- Mismo token registrado dos veces → un solo documento en `dispositivos` (test en Task 3).
- iPhone en Safari sin instalar → muestra los pasos de instalación, nunca el botón de permiso (test en Task 5).
- iPhone en `/mi` (sin token en la ruta) → no ofrece instalar desde ahí (test en Task 5).
- El botón de activar llama a `requestPermission` antes de cualquier otro `await` (revisión de código en Task 6).
- Texto del aviso con `<script>` → la notificación lo muestra como texto (las notificaciones del sistema no interpretan HTML) y la app no lo pinta como HTML.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `web/public/manifest.webmanifest` | Crear | Hace instalable la página. Sin `start_url`. |
| `web/public/icono-180.png`, `icono-192.png`, `icono-512.png` | Crear | Íconos de la página instalada. |
| `web/public/sw.js` | Crear | Service worker: muestra el aviso y abre la página al tocarlo. |
| `web/index.html` | Modificar | `<link rel="manifest">` y etiquetas de Apple. |
| `firebase.json` | Modificar | Sin caché para `sw.js` y el manifest. |
| `functions/src/notificaciones.ts` (+ test) | Crear | Lógica pura: destinatarias, tandas, tokens muertos, lectura de documentos. |
| `functions/src/registrarDispositivo.ts` (+ test) | Crear | Callable que guarda el token de la clienta. |
| `functions/src/enviarNotificacion.ts` | Crear | Trigger que manda el aviso y anota el resultado. |
| `functions/src/index.ts` | Modificar | Exportar las dos funciones. |
| `firestore.rules` | Modificar | `dispositivos` y `notificaciones`, solo entrenador. |
| `web/src/notificaciones.ts` (+ test) | Crear | Puro: en qué estado está la clienta y qué ofrecerle. |
| `web/src/notificacionesNavegador.ts` | Crear | Lo que toca el navegador: permiso, service worker, token. |
| `web/src/acciones.ts` | Modificar | `registrarDispositivo`. |
| `web/src/datos.ts` | Modificar | `notificacionesWeb?` en `Cliente`. |
| `web/src/ui/tarjetaNotificaciones.ts` (+ test) | Crear | Sección de Ajustes e invitación de Inicio. |
| `web/src/ventanas.ts` (+ test) | Modificar | Datos nuevos y dónde se pinta cada pieza. |
| `web/src/main.ts` | Modificar | Estado, clics, sincronizar el token al arrancar. |
| `web/src/estilos.css` | Modificar | Estilos de los pasos de instalación. |
| `app/.../data/model/Cliente.kt` | Modificar | `notificacionesWeb`. |
| `app/.../data/model/Notificacion.kt` | Crear | Documento de `notificaciones`. |
| `app/.../data/repository/ClienteRepository.kt` + Firestore + Fake | Modificar | `actualizarNotificacionesWeb`. |
| `app/.../data/repository/NotificacionRepository.kt` | Crear | Enviar y observar historial. |
| `app/.../data/repository/DispositivoRepository.kt` | Crear | Contar dispositivos de una clienta. |
| `app/.../data/AppContainer.kt` | Modificar | Registrar los dos repositorios. |
| `app/.../domain/Avisos.kt` (+ `AvisosTest.kt`) | Crear | Textos rápidos, destinatarias (GEMELO), resumen del historial. |
| `app/.../ui/clientes/WebClienteScreen.kt` | Modificar | Interruptor "Notificaciones" y su estado. |
| `app/.../ui/avisos/AvisosScreen.kt`, `AvisosViewModel.kt` | Crear | Pantalla para escribir y enviar avisos. |
| `app/.../ui/navigation/Screen.kt`, `OSfitNavHost.kt`, `ui/OSfitApp.kt` | Modificar | Ruta y entrada "Avisos" en el menú lateral. |

`app/...` = `app/src/main/java/com/osfit/app`.

---

## Antes de empezar: lo que tiene que dar el entrenador

- [ ] **Logo** en PNG cuadrado de al menos 512×512 (Task 1). Si no hay, se usa el ícono provisional de la Task 1.
- [ ] **Un iPhone con iOS 16.4 o más** y un link `/c/<token>` de una clienta de prueba (Task 1 y Task 12).
- [ ] **La clave VAPID** (Task 6): consola de Firebase → ⚙️ Configuración del proyecto → Cloud Messaging → "Configuración web" → "Certificados de push web" → "Generar par de claves". Se copia la **clave pública** (empieza con `B…`). Es pública: va en el código, como `firebaseConfig`.

---

### Task 1: Hacer la página instalable y comprobar la sesión en un iPhone (puerta del plan)

Esta task va primero porque valida el supuesto del que depende todo: que la página instalada entra sola. Si falla, **se detiene el plan** y se avisa al entrenador.

**Files:**
- Create: `web/public/manifest.webmanifest`, `web/public/icono-180.png`, `web/public/icono-192.png`, `web/public/icono-512.png`
- Modify: `web/index.html`, `firebase.json`

- [x] **Step 1: Íconos**

Con el logo del entrenador, generar tres PNG cuadrados: 180, 192 y 512 px, **sin transparencia** (iOS pinta de negro lo transparente), con el fondo `#121212`.

Si no hay logo, usar este provisional como `web/public/icono.svg` y convertirlo:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#121212"/>
  <text x="256" y="320" text-anchor="middle" font-family="Arial Black, Arial, sans-serif"
        font-size="200" font-weight="900" fill="#B388FF">OS</text>
</svg>
```

```bash
cd web/public
for t in 180 192 512; do npx --yes sharp-cli --input icono.svg --output icono-$t.png resize $t $t; done
```

(Cualquier otra herramienta que exporte PNG sirve; lo que importa son los tres tamaños y el fondo opaco.)

- [x] **Step 2: Manifest**

`web/public/manifest.webmanifest`:

```json
{
  "name": "OSfit",
  "short_name": "OSfit",
  "description": "Tu rutina, tu racha y los avisos de tus coaches.",
  "display": "standalone",
  "scope": "/",
  "background_color": "#121212",
  "theme_color": "#121212",
  "icons": [
    { "src": "/icono-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icono-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icono-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**No agregar `start_url` ni `id`.** JSON no admite comentarios, así que el porqué va en `index.html` (Step 3).

- [x] **Step 3: Etiquetas en `web/index.html`**

Dentro de `<head>`, justo después de `<title>OSfit</title>`:

```html
    <!--
      Instalable. El manifest NO declara `start_url` a proposito: sin el, la pagina instalada
      abre en la direccion desde la que se instalo, que es el `/c/<token>` de la clienta, y
      entra sola por el escalon 1 de `resolverSesion`. La pagina instalada en iPhone no
      comparte almacenamiento con Safari, asi que sin el token en la direccion abriria en el
      candado. Ver docs/superpowers/specs/2026-10-08-notificaciones-web-pwa-design.md.
    -->
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icono-180.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="OSfit" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

(El comentario va en español con acentos si se prefiere; en `web/` sí se usan. Lo que importa es que diga el porqué.)

- [x] **Step 4: Sin caché para el manifest y el service worker**

En `firebase.json`, dentro de `hosting.headers`, agregar antes de la entrada de `/assets/**`:

```json
      {
        "source": "/@(sw.js|manifest.webmanifest)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, must-revalidate"
          }
        ]
      },
```

El service worker todavía no existe (Task 6); la regla se deja lista para que su primera versión ya salga sin caché.

- [x] **Step 5: Build**

Run: `cd web && npm run build && ls dist | grep -E "manifest|icono"`
Expected: el build pasa y aparecen `manifest.webmanifest`, `icono-180.png`, `icono-192.png`, `icono-512.png`.

- [x] **Step 6: Commit y push**

```bash
git add web/public web/index.html firebase.json
git commit -m "feat: make the client web installable without a fixed start_url"
git push origin main
```

- [x] **Step 7: Pedir confirmación y desplegar hosting**

Preguntar al entrenador antes. Con su sí: `firebase deploy --only hosting`.

- [x] **Step 8: Prueba en iPhone (la puerta)**

1. Abrir el link `/c/<token>` en **Safari** (si viene de WhatsApp: ⋯ → "Abrir en Safari").
2. Compartir → "Agregar a inicio" → "Agregar". Comprobar ícono y nombre "OSfit".
3. Cerrar Safari por completo (deslizar hacia arriba).
4. Abrir desde el ícono → **tiene que abrir sin barra de Safari y entrar directo a la página de la clienta**, sin candado.
5. Cerrar la app instalada, esperar un minuto, volver a abrir → entra otra vez.

Si entra: anotar "Task 1 verificada en iPhone <modelo>, iOS <versión>" al final de este archivo y seguir.
**Si abre en el candado o en blanco: parar aquí** y reportar al entrenador qué se vio (la línea de diagnóstico del candado incluida). No seguir con la Task 2.

---

### Task 2: Lógica pura de envío en el servidor

**Files:**
- Create: `functions/src/notificaciones.ts`
- Test: `functions/src/notificaciones.test.ts`

**Interfaces:**
- Produces:
  - `const LARGO_MAXIMO_TEXTO = 500`
  - `interface ClienteParaAviso { id: string; activo: boolean; notificacionesWeb: boolean }`
  - `interface Aviso { titulo: string; texto: string; destino: "todas" | "elegidas"; clientesElegidos: string[] }`
  - `clienteParaAvisoDesdeDoc(id: string, data: Record<string, unknown>): ClienteParaAviso`
  - `avisoDesdeDoc(data: Record<string, unknown>): Aviso | null`
  - `destinatarias(clientes: ClienteParaAviso[], aviso: Aviso): string[]`
  - `enTandas<T>(xs: T[], tamano?: number): T[][]`
  - `esTokenMuerto(codigo: string | undefined): boolean`

- [x] **Step 1: Write the failing test**

`functions/src/notificaciones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  LARGO_MAXIMO_TEXTO,
  avisoDesdeDoc,
  clienteParaAvisoDesdeDoc,
  destinatarias,
  enTandas,
  esTokenMuerto,
  type Aviso,
  type ClienteParaAviso,
} from "./notificaciones";

const c = (id: string, notificacionesWeb = true, activo = true): ClienteParaAviso => ({
  id, notificacionesWeb, activo,
});
const aviso = (campos: Partial<Aviso> = {}): Aviso => ({
  titulo: "OSfit", texto: "Ya llegamos", destino: "todas", clientesElegidos: [], ...campos,
});

describe("destinatarias", () => {
  it("'todas' son las habilitadas y activas", () => {
    const clientes = [c("a"), c("b", false), c("x", true, false)];
    expect(destinatarias(clientes, aviso())).toEqual(["a"]);
  });

  // Review Focus: la llave del entrenador manda aunque la haya elegido a mano.
  it("'elegidas' excluye a las elegidas que no estan habilitadas", () => {
    const clientes = [c("a"), c("b", false), c("d")];
    expect(destinatarias(clientes, aviso({ destino: "elegidas", clientesElegidos: ["a", "b"] })))
      .toEqual(["a"]);
  });

  it("'elegidas' ignora ids que ya no existen", () => {
    expect(destinatarias([c("a")], aviso({ destino: "elegidas", clientesElegidos: ["a", "borrada"] })))
      .toEqual(["a"]);
  });
});

describe("enTandas", () => {
  it("parte en grupos del tamano pedido", () => {
    expect(enTandas([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("por defecto usa el limite de FCM, 500", () => {
    const tandas = enTandas(Array.from({ length: 1001 }, (_, i) => i));
    expect(tandas.map((t) => t.length)).toEqual([500, 500, 1]);
  });

  it("sin elementos no hay tandas", () => {
    expect(enTandas([])).toEqual([]);
  });
});

describe("esTokenMuerto", () => {
  it("borra solo los tokens que FCM declara muertos", () => {
    expect(esTokenMuerto("messaging/registration-token-not-registered")).toBe(true);
    expect(esTokenMuerto("messaging/invalid-registration-token")).toBe(true);
  });

  // Review Focus: un payload mal armado no puede vaciar los dispositivos de todas.
  it("no borra por argumento invalido, errores de red ni codigo ausente", () => {
    expect(esTokenMuerto("messaging/invalid-argument")).toBe(false);
    expect(esTokenMuerto("messaging/internal-error")).toBe(false);
    expect(esTokenMuerto("messaging/server-unavailable")).toBe(false);
    expect(esTokenMuerto(undefined)).toBe(false);
  });
});

describe("lectura de documentos", () => {
  it("un cliente sin los campos queda deshabilitado e inactivo", () => {
    expect(clienteParaAvisoDesdeDoc("a", {})).toEqual({ id: "a", activo: false, notificacionesWeb: false });
    expect(clienteParaAvisoDesdeDoc("b", { activo: true, notificacionesWeb: "si" }))
      .toEqual({ id: "b", activo: true, notificacionesWeb: false });
  });

  it("un aviso valido se lee con sus valores", () => {
    expect(avisoDesdeDoc({ titulo: "Coach", texto: " Ya llegamos ", destino: "elegidas", clientesElegidos: ["a", 3] }))
      .toEqual({ titulo: "Coach", texto: "Ya llegamos", destino: "elegidas", clientesElegidos: ["a"] });
  });

  it("sin titulo usa OSfit, y un destino raro cuenta como 'todas'", () => {
    expect(avisoDesdeDoc({ texto: "Hola", destino: "nadie" }))
      .toEqual({ titulo: "OSfit", texto: "Hola", destino: "todas", clientesElegidos: [] });
  });

  it("sin texto, o con texto demasiado largo, no hay aviso", () => {
    expect(avisoDesdeDoc({ texto: "   " })).toBeNull();
    expect(avisoDesdeDoc({})).toBeNull();
    expect(avisoDesdeDoc({ texto: "x".repeat(LARGO_MAXIMO_TEXTO + 1) })).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/notificaciones.test.ts`
Expected: FAIL — no existe `./notificaciones`.

- [x] **Step 3: Write minimal implementation**

`functions/src/notificaciones.ts`:

```ts
/**
 * Lo puro del envio de avisos: a quien, en cuantas tandas y que tokens tirar.
 *
 * Vive aparte de `enviarNotificacion.ts` para probarse en Node sin Firestore ni FCM, como
 * `rachas.ts` respecto de `ranking.ts`.
 */

/**
 * Largo maximo del texto de un aviso. Un aviso de mas no rompe nada, pero en la pantalla
 * bloqueada se corta a las pocas lineas, asi que un texto largo se lee a medias.
 *
 * GEMELO: `Avisos.LARGO_MAXIMO` en `app/.../domain/Avisos.kt`.
 */
export const LARGO_MAXIMO_TEXTO = 500;

/** Maximo de tokens por llamada a `sendEachForMulticast`. Lo fija FCM. */
const TANDA_FCM = 500;

export interface ClienteParaAviso {
  id: string;
  activo: boolean;
  notificacionesWeb: boolean;
}

export interface Aviso {
  titulo: string;
  texto: string;
  destino: "todas" | "elegidas";
  clientesElegidos: string[];
}

/** Campos ausentes o de tipo raro cuentan como `false`: ante la duda, no se manda. */
export function clienteParaAvisoDesdeDoc(id: string, data: Record<string, unknown>): ClienteParaAviso {
  return {
    id,
    activo: data.activo === true,
    notificacionesWeb: data.notificacionesWeb === true,
  };
}

export function avisoDesdeDoc(data: Record<string, unknown>): Aviso | null {
  const texto = typeof data.texto === "string" ? data.texto.trim() : "";
  if (texto === "" || texto.length > LARGO_MAXIMO_TEXTO) return null;
  const titulo = typeof data.titulo === "string" && data.titulo.trim() !== "" ? data.titulo.trim() : "OSfit";
  const destino = data.destino === "elegidas" ? "elegidas" : "todas";
  const clientesElegidos = Array.isArray(data.clientesElegidos)
    ? data.clientesElegidos.filter((x): x is string => typeof x === "string")
    : [];
  return { titulo, texto, destino, clientesElegidos };
}

/**
 * A quien le llega. La llave del entrenador (`notificacionesWeb`) manda siempre: elegir a
 * una clienta en la lista no la habilita. Asi apagar el interruptor de alguien basta para
 * que deje de recibir, sin revisar avisos viejos ni listas guardadas.
 *
 * GEMELO: `Avisos.destinatarias` en `app/.../domain/Avisos.kt` (la app lo usa para decir
 * cuantas lo van a recibir antes de enviar).
 */
export function destinatarias(clientes: ClienteParaAviso[], aviso: Aviso): string[] {
  const habilitadas = clientes.filter((c) => c.activo && c.notificacionesWeb);
  if (aviso.destino === "todas") return habilitadas.map((c) => c.id);
  const elegidas = new Set(aviso.clientesElegidos);
  return habilitadas.filter((c) => elegidas.has(c.id)).map((c) => c.id);
}

export function enTandas<T>(xs: T[], tamano: number = TANDA_FCM): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < xs.length; i += tamano) tandas.push(xs.slice(i, i + tamano));
  return tandas;
}

/**
 * Si FCM dice que ese token ya no existe: la clienta desinstalo la pagina o le quito el
 * permiso. Solo esos se borran. `invalid-argument` NO esta aqui a proposito: tambien sale
 * cuando el mensaje esta mal armado, y en ese caso borraria los tokens de todas de un golpe.
 */
export function esTokenMuerto(codigo: string | undefined): boolean {
  return (
    codigo === "messaging/registration-token-not-registered" ||
    codigo === "messaging/invalid-registration-token"
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/notificaciones.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit y push**

```bash
git add functions/src/notificaciones.ts functions/src/notificaciones.test.ts
git commit -m "feat: pure helpers to pick push recipients and prune dead tokens"
git push origin main
```

---

### Task 3: Callable `registrarDispositivo`

**Files:**
- Create: `functions/src/registrarDispositivo.ts`
- Test: `functions/src/registrarDispositivo.test.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `REGION`, `clienteDeLaSesion`, `db` de `./comun`.
- Produces:
  - `idDispositivo(token: string): string` (sha256 hex del token)
  - `registroValido(data: unknown): { token: string; plataforma: "ios" | "android" | "otro" } | null`
  - callable `registrarDispositivo({ token, plataforma })` → `{ ok: true }`

- [x] **Step 1: Write the failing test**

`functions/src/registrarDispositivo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { idDispositivo, registroValido } from "./registrarDispositivo";

describe("idDispositivo", () => {
  // Review Focus: registrar dos veces el mismo token no duplica el documento.
  it("el mismo token da siempre el mismo id", () => {
    expect(idDispositivo("abc")).toBe(idDispositivo("abc"));
    expect(idDispositivo("abc")).not.toBe(idDispositivo("abd"));
  });

  it("el id sirve como id de documento de Firestore", () => {
    expect(idDispositivo("a/b:c")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("registroValido", () => {
  it("acepta un token y una plataforma conocida", () => {
    expect(registroValido({ token: "t".repeat(150), plataforma: "ios" }))
      .toEqual({ token: "t".repeat(150), plataforma: "ios" });
  });

  it("una plataforma desconocida queda como 'otro'", () => {
    expect(registroValido({ token: "t".repeat(150), plataforma: "windows" })?.plataforma).toBe("otro");
  });

  it("rechaza token ausente, vacio o absurdamente largo", () => {
    expect(registroValido({})).toBeNull();
    expect(registroValido({ token: "" })).toBeNull();
    expect(registroValido({ token: "t".repeat(5000) })).toBeNull();
    expect(registroValido(null)).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/registrarDispositivo.test.ts`
Expected: FAIL — no existe el módulo.

- [x] **Step 3: Write minimal implementation**

`functions/src/registrarDispositivo.ts`:

```ts
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db } from "./comun";

/** Un token FCM web ronda los 150-200 caracteres; 4096 deja aire sin aceptar basura. */
const LARGO_MAXIMO_TOKEN = 4096;

/**
 * Id del documento: hash del token. Asi registrar el mismo telefono en cada carga de la
 * pagina pisa el mismo documento en vez de llenar la subcoleccion de copias.
 */
export function idDispositivo(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function registroValido(
  data: unknown
): { token: string; plataforma: "ios" | "android" | "otro" } | null {
  if (typeof data !== "object" || data === null) return null;
  const { token, plataforma } = data as { token?: unknown; plataforma?: unknown };
  if (typeof token !== "string" || token === "" || token.length > LARGO_MAXIMO_TOKEN) return null;
  const conocida = plataforma === "ios" || plataforma === "android" ? plataforma : "otro";
  return { token, plataforma: conocida };
}

/**
 * Guarda el token de notificaciones del telefono de la clienta.
 *
 * El clienteId sale del claim de la sesion, nunca del body. Si el entrenador no la habilito,
 * no se guarda nada: un token guardado de una clienta no habilitada no serviria para nada y
 * quedaria ahi esperando a que alguien olvide revisar la llave.
 */
export const registrarDispositivo = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);
  const registro = registroValido(request.data);
  if (!registro) throw new HttpsError("invalid-argument", "token_invalido");

  const cliente = db().collection("clientes").doc(clienteId);
  if ((await cliente.get()).get("notificacionesWeb") !== true) {
    throw new HttpsError("failed-precondition", "no_habilitada");
  }

  const ref = cliente.collection("dispositivos").doc(idDispositivo(registro.token));
  const existe = (await ref.get()).exists;
  await ref.set(
    {
      token: registro.token,
      plataforma: registro.plataforma,
      actualizado: FieldValue.serverTimestamp(),
      ...(existe ? {} : { creado: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );
  return { ok: true };
});
```

En `functions/src/index.ts`, al final:

```ts
export { registrarDispositivo } from "./registrarDispositivo";
```

- [x] **Step 4: Run tests and build**

Run: `cd functions && npm test && npm run build`
Expected: PASS y el build sin errores.

- [ ] **Step 5: Commit y push**

```bash
git add functions/src/registrarDispositivo.ts functions/src/registrarDispositivo.test.ts functions/src/index.ts
git commit -m "feat: callable to register a client's web push token"
git push origin main
```

---

### Task 4: Trigger `enviarNotificacion` y reglas

**Files:**
- Create: `functions/src/enviarNotificacion.ts`
- Modify: `functions/src/index.ts`, `firestore.rules`

**Interfaces:**
- Consumes: todo lo de `./notificaciones` (Task 2), `db` de `./comun`.
- Produces: trigger `enviarNotificacion` sobre `notificaciones/{id}`.

- [x] **Step 1: Averiguar la región del trigger**

Los triggers de Firestore tienen que vivir donde vive la base. Run:
`firebase firestore:databases:get "(default)" --project osfit-cccfe`
y leer `locationId`.

- Si es una región (`us-west1`, `us-central1`, …): usar esa misma.
- Si es `nam5`: usar `us-central1`. Si es `eur3`: `europe-west1`.

Anotar el valor elegido como `REGION_FIRESTORE` en el Step 2. **No asumir `REGION` (`us-west1`)**: si no coincide, el despliegue falla o el trigger nunca dispara.

- [x] **Step 2: Implementación**

`functions/src/enviarNotificacion.ts` (reemplazar `"<locationId>"` por lo del Step 1):

```ts
import type { DocumentReference } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "./comun";
import {
  avisoDesdeDoc,
  clienteParaAvisoDesdeDoc,
  destinatarias,
  enTandas,
  esTokenMuerto,
} from "./notificaciones";

/**
 * Region del trigger. No es `REGION` (`us-west1`): un trigger de Firestore tiene que vivir
 * donde vive la base, y esta salio de `firebase firestore:databases:get`.
 */
const REGION_FIRESTORE = "<locationId>";

/**
 * Cuanto espera FCM a un telefono apagado antes de tirar el aviso. Cuatro horas: un "ya
 * llegamos" que llega al dia siguiente confunde mas de lo que avisa.
 */
const TTL_SEGUNDOS = "14400";

/**
 * Manda el aviso que la app acaba de escribir en `notificaciones/{id}`.
 *
 * Un trigger y no una callable porque la app no tiene el SDK de Functions: todo lo que hace
 * el entrenador es escribir en Firestore, y si esta sin senal la escritura espera en la cola
 * local y sale sola al volver la red.
 *
 * Mensajes solo de datos: el service worker de la pagina arma la notificacion. Si viajara
 * tambien `notification`, algunos navegadores la mostrarian por su cuenta y se veria doble.
 */
export const enviarNotificacion = onDocumentCreated(
  { document: "notificaciones/{id}", region: REGION_FIRESTORE },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ref = snap.ref;

    // Los triggers pueden correr mas de una vez para el mismo documento. Se toma el aviso
    // pasandolo de "pendiente" a "enviando" en una transaccion: la segunda corrida ya no lo
    // encuentra pendiente y no manda nada. Sin esto, la clienta recibiria el aviso dos veces.
    const tomado = await db().runTransaction(async (tx) => {
      const actual = await tx.get(ref);
      if (actual.get("estado") !== "pendiente") return false;
      tx.update(ref, { estado: "enviando" });
      return true;
    });
    if (!tomado) return;

    const aviso = avisoDesdeDoc(snap.data());
    if (!aviso) {
      await ref.update({ estado: "error", enviadas: 0, fallidas: 0 });
      return;
    }

    try {
      const clientesSnap = await db().collection("clientes").where("notificacionesWeb", "==", true).get();
      const clientes = clientesSnap.docs.map((d) => clienteParaAvisoDesdeDoc(d.id, d.data()));
      const ids = destinatarias(clientes, aviso);

      const dispositivos = (
        await Promise.all(
          ids.map((id) => db().collection("clientes").doc(id).collection("dispositivos").get())
        )
      ).flatMap((s) => s.docs)
        .map((d) => ({ token: d.get("token"), ref: d.ref }))
        .filter((d): d is { token: string; ref: DocumentReference } =>
          typeof d.token === "string" && d.token !== "");

      let enviadas = 0;
      let fallidas = 0;
      for (const tanda of enTandas(dispositivos)) {
        const respuesta = await getMessaging().sendEachForMulticast({
          tokens: tanda.map((d) => d.token),
          data: { titulo: aviso.titulo, texto: aviso.texto },
          webpush: { headers: { TTL: TTL_SEGUNDOS, Urgency: "high" } },
        });
        await Promise.all(
          respuesta.responses.map(async (r, i) => {
            if (r.success) {
              enviadas += 1;
              return;
            }
            fallidas += 1;
            if (esTokenMuerto(r.error?.code)) await tanda[i].ref.delete();
          })
        );
      }

      await ref.update({ estado: "enviada", enviadas, fallidas });
    } catch (error) {
      logger.error("No se pudo enviar el aviso", { id: ref.id, error });
      await ref.update({ estado: "error" });
    }
  }
);
```

En `functions/src/index.ts`, al final:

```ts
export { enviarNotificacion } from "./enviarNotificacion";
```

- [x] **Step 3: Reglas**

En `firestore.rules`, dentro de `match /clientes/{cid} { ... }`, junto a `pagos`:

```
      // Los tokens de notificaciones de sus telefonos. Solo el entrenador: la clienta no
      // necesita leerlos, y el token es lo unico que permite mandarle avisos a su telefono.
      // Los escribe la funcion `registrarDispositivo` con el Admin SDK.
      match /dispositivos/{doc} {
        allow read, write: if esEntrenador();
      }
```

Y a nivel raíz, junto a los catálogos del final:

```
    // Avisos que el entrenador manda desde la app. Son cola y a la vez historial: la funcion
    // `enviarNotificacion` los toma al crearse y les anota el resultado.
    match /notificaciones/{doc} { allow read, write: if esEntrenador(); }
```

Leer `firestore.rules` completo antes de tocarlo (lo pide `AGENTS.md`).

- [x] **Step 4: Tests y build**

Run: `cd functions && npm test && npm run build`
Expected: PASS y build sin errores.

- [ ] **Step 5: Commit y push**

```bash
git add functions/src/enviarNotificacion.ts functions/src/index.ts firestore.rules
git commit -m "feat: Firestore trigger that sends coach notices to enabled clients"
git push origin main
```

---

### Task 5: Estado de las notificaciones en la web (puro)

**Files:**
- Create: `web/src/notificaciones.ts`
- Test: `web/src/notificaciones.test.ts`

**Interfaces:**
- Produces:
  - `type Permiso = "default" | "granted" | "denied" | "sin-api"`
  - `interface EntornoNotificaciones { ua: string; instalada: boolean; tienePush: boolean; permiso: Permiso; tokenEnRuta: boolean }`
  - `type EstadoNotificaciones = "no-habilitada" | "instalar" | "instalar-desde-link" | "no-soportado" | "pedir-permiso" | "activadas" | "bloqueadas"`
  - `estadoNotificaciones(habilitada: boolean, e: EntornoNotificaciones): EstadoNotificaciones`
  - `versionIos(ua: string): [number, number] | null`
  - `plataforma(ua: string): "ios" | "android" | "otro"`

**Nota sobre el spec:** el spec listaba `abrir-en-safari` aparte de `instalar`. Desde la página no se distingue con certeza Safari del navegador interno de WhatsApp en iOS, así que se juntan en `instalar`, cuyos pasos empiezan por "si estás dentro de WhatsApp, ábrelo en Safari". Se agrega `instalar-desde-link` para el caso `/mi` sin token. El spec se actualiza en el Step 5.

- [x] **Step 1: Write the failing test**

`web/src/notificaciones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  estadoNotificaciones,
  plataforma,
  versionIos,
  type EntornoNotificaciones,
} from "./notificaciones";

const IPHONE_17 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_16_3 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

const entorno = (campos: Partial<EntornoNotificaciones> = {}): EntornoNotificaciones => ({
  ua: IPHONE_17, instalada: false, tienePush: false, permiso: "sin-api", tokenEnRuta: true, ...campos,
});

describe("estadoNotificaciones", () => {
  it("sin la llave del entrenador no se ofrece nada, en ningun telefono", () => {
    expect(estadoNotificaciones(false, entorno())).toBe("no-habilitada");
    expect(estadoNotificaciones(false, entorno({ ua: ANDROID, tienePush: true, permiso: "default" })))
      .toBe("no-habilitada");
  });

  // Review Focus: en Safari (o dentro de WhatsApp) sin instalar, nunca el boton de permiso.
  it("iPhone sin instalar: pasos para instalar", () => {
    expect(estadoNotificaciones(true, entorno())).toBe("instalar");
  });

  // Review Focus: desde /mi no hay token que la pagina instalada pueda usar para entrar.
  it("iPhone sin instalar y sin token en la ruta: primero abrir su link", () => {
    expect(estadoNotificaciones(true, entorno({ tokenEnRuta: false }))).toBe("instalar-desde-link");
  });

  it("iPhone con iOS anterior a 16.4: no soportado", () => {
    expect(estadoNotificaciones(true, entorno({ ua: IPHONE_16_3 }))).toBe("no-soportado");
  });

  it("iPhone instalado: pedir permiso, activadas o bloqueadas segun el permiso", () => {
    const instalada = { instalada: true, tienePush: true };
    expect(estadoNotificaciones(true, entorno({ ...instalada, permiso: "default" }))).toBe("pedir-permiso");
    expect(estadoNotificaciones(true, entorno({ ...instalada, permiso: "granted" }))).toBe("activadas");
    expect(estadoNotificaciones(true, entorno({ ...instalada, permiso: "denied" }))).toBe("bloqueadas");
  });

  it("iPhone instalado pero sin Push API: no soportado", () => {
    expect(estadoNotificaciones(true, entorno({ instalada: true, tienePush: false }))).toBe("no-soportado");
  });

  it("Android no necesita instalar", () => {
    expect(estadoNotificaciones(true, entorno({ ua: ANDROID, tienePush: true, permiso: "default" })))
      .toBe("pedir-permiso");
  });
});

describe("versionIos y plataforma", () => {
  it("lee la version de iOS del user agent", () => {
    expect(versionIos(IPHONE_17)).toEqual([17, 5]);
    expect(versionIos(IPHONE_16_3)).toEqual([16, 3]);
    expect(versionIos(ANDROID)).toBeNull();
  });

  it("clasifica la plataforma", () => {
    expect(plataforma(IPHONE_17)).toBe("ios");
    expect(plataforma(ANDROID)).toBe("android");
    expect(plataforma("Mozilla/5.0 (Windows NT 10.0)")).toBe("otro");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/notificaciones.test.ts`
Expected: FAIL — no existe `./notificaciones`.

- [x] **Step 3: Write minimal implementation**

`web/src/notificaciones.ts`:

```ts
/**
 * Qué ofrecerle a la clienta sobre las notificaciones. Puro: el navegador entra por
 * `EntornoNotificaciones`, que arma `notificacionesNavegador.ts`, así que esto se prueba con
 * datos y sin DOM.
 *
 * La regla que lo ordena todo es de Apple, no nuestra: en iPhone una página web solo recibe
 * notificaciones si está instalada en la pantalla de inicio (iOS 16.4 o más) y se abrió
 * desde ese ícono. Ver docs/superpowers/specs/2026-10-08-notificaciones-web-pwa-design.md.
 */

export type Permiso = "default" | "granted" | "denied" | "sin-api";

export interface EntornoNotificaciones {
  ua: string;
  /** Abierta desde el ícono de la pantalla de inicio (`display-mode: standalone`). */
  instalada: boolean;
  /** Existen `serviceWorker`, `PushManager` y `Notification`. */
  tienePush: boolean;
  permiso: Permiso;
  /** La ruta es `/c/<token>`. Sin token, la página instalada no tendría con qué entrar. */
  tokenEnRuta: boolean;
}

export type EstadoNotificaciones =
  | "no-habilitada"
  | "instalar"
  | "instalar-desde-link"
  | "no-soportado"
  | "pedir-permiso"
  | "activadas"
  | "bloqueadas";

export function versionIos(ua: string): [number, number] | null {
  const m = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)_(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function plataforma(ua: string): "ios" | "android" | "otro" {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "otro";
}

export function estadoNotificaciones(
  habilitada: boolean,
  e: EntornoNotificaciones
): EstadoNotificaciones {
  if (!habilitada) return "no-habilitada";
  const ios = versionIos(e.ua);
  if (ios && (ios[0] < 16 || (ios[0] === 16 && ios[1] < 4))) return "no-soportado";
  // En iPhone sin instalar no se pregunta por la API: en Safari no existe y dentro de
  // WhatsApp tampoco. Lo único que sirve ahí es explicar cómo instalarla.
  if (ios && !e.instalada) return e.tokenEnRuta ? "instalar" : "instalar-desde-link";
  if (!e.tienePush || e.permiso === "sin-api") return "no-soportado";
  if (e.permiso === "granted") return "activadas";
  if (e.permiso === "denied") return "bloqueadas";
  return "pedir-permiso";
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/notificaciones.test.ts`
Expected: PASS.

- [x] **Step 5: Ajustar el spec**

En `docs/superpowers/specs/2026-10-08-notificaciones-web-pwa-design.md`, sección "`web/src/notificaciones.ts`", reemplazar la lista de estados por la de este archivo y explicar en una línea por qué `abrir-en-safari` se juntó con `instalar` (no se distingue con certeza) y para qué es `instalar-desde-link`.

- [ ] **Step 6: Commit y push**

```bash
git add web/src/notificaciones.ts web/src/notificaciones.test.ts docs/superpowers/specs/2026-10-08-notificaciones-web-pwa-design.md
git commit -m "feat: decide which notification step to offer each client device"
git push origin main
```

---

### Task 6: Service worker, token y callable en la web

**Files:**
- Create: `web/public/sw.js`, `web/src/notificacionesNavegador.ts`
- Modify: `web/src/acciones.ts`, `web/src/datos.ts`

**Interfaces:**
- Consumes: `app` de `./firebase`; `EntornoNotificaciones`, `plataforma` de `./notificaciones`; `tokenEnLaUrl` de `./sesion`.
- Produces:
  - `registrarDispositivo` callable en `acciones.ts`: `({ token, plataforma }) → { ok: true }`
  - `entornoDelNavegador(): EntornoNotificaciones`
  - `activarNotificaciones(): Promise<"activadas" | "bloqueadas" | "sin-respuesta" | "error">`
  - `sincronizarToken(): Promise<void>`
  - `Cliente.notificacionesWeb?: boolean`

Sin tests unitarios: todo esto toca el navegador. Se verifica en dispositivo (Task 12).

- [x] **Step 1: Service worker**

`web/public/sw.js`:

```js
/*
 * Service worker de la página. Hace UNA cosa: mostrar los avisos del entrenador y abrir la
 * página al tocarlos. No intercepta `fetch` ni guarda nada en caché a propósito: así no
 * cambia nada de cómo carga la página.
 *
 * Los avisos llegan solo con datos (`titulo`, `texto`) y aquí se arma la notificación. En
 * iOS es obligatorio mostrar una notificación por cada push: si llega uno y no se muestra
 * nada, Safari le quita la suscripción a la página.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let carga = {};
  try {
    carga = evento.data ? evento.data.json() : {};
  } catch (e) {
    carga = {};
  }
  // FCM envuelve los datos en `data`; se acepta también plano por si cambia el formato.
  const datos = carga.data || carga;
  const titulo = datos.titulo || "OSfit";
  const texto = datos.texto || "";
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: texto,
      icon: "/icono-192.png",
      badge: "/icono-192.png",
    })
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const v of ventanas) {
        if ("focus" in v) return v.focus();
      }
      // Sin ventana abierta se abre la raíz: la página instalada guarda su propia sesión y
      // el token recordado, así que la escalera de `resolverSesion` la deja entrar.
      return self.clients.openWindow("/");
    })()
  );
});
```

- [x] **Step 2: Campo en `datos.ts`**

En `interface Cliente`, después de `paletaWeb?`:

```ts
  /**
   * La llave del entrenador para las notificaciones. Opcional por la razón de siempre:
   * Firestore omite los campos que nunca se escribieron, y ausente es "no habilitada".
   */
  notificacionesWeb?: boolean;
```

- [x] **Step 3: Callable en `acciones.ts`**

Al final:

```ts
/**
 * Guarda el token de notificaciones de este teléfono. Si el entrenador no la habilitó, el
 * servidor responde `failed-precondition` y no guarda nada.
 */
export const registrarDispositivo = httpsCallable<
  { token: string; plataforma: "ios" | "android" | "otro" },
  { ok: true }
>(functions, "registrarDispositivo");
```

Y en el comentario de cabecera del archivo, cambiar "cuatro escrituras y la lectura del ranking" por "cinco escrituras y la lectura del ranking".

- [x] **Step 4: `web/src/notificacionesNavegador.ts`**

Reemplazar `PEGAR_CLAVE_VAPID` por la clave pública que dio el entrenador.

```ts
import { app } from "./firebase";
import { registrarDispositivo } from "./acciones";
import { plataforma, type EntornoNotificaciones, type Permiso } from "./notificaciones";
import { tokenEnLaUrl } from "./sesion";

/**
 * Clave pública VAPID del proyecto (consola de Firebase → Cloud Messaging → Certificados de
 * push web). Es pública, como `firebaseConfig`: identifica al remitente, no da permisos.
 */
const CLAVE_VAPID = "PEGAR_CLAVE_VAPID";

export function entornoDelNavegador(): EntornoNotificaciones {
  const tienePush =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const permiso: Permiso = "Notification" in window ? Notification.permission : "sin-api";
  const instalada =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    ua: navigator.userAgent,
    instalada,
    tienePush,
    permiso,
    tokenEnRuta: tokenEnLaUrl(location.pathname) !== null,
  };
}

/**
 * Lo que hace el botón "Activar notificaciones".
 *
 * `requestPermission` va PRIMERO, antes de cualquier otro `await`: iOS solo muestra el
 * diálogo si la llamada sale directo del toque, y un `await` previo (registrar el service
 * worker, importar el SDK) lo deja sin gesto. Ahí falla en silencio y la clienta cree que el
 * botón no hace nada.
 */
export async function activarNotificaciones(): Promise<
  "activadas" | "bloqueadas" | "sin-respuesta" | "error"
> {
  const permiso = await Notification.requestPermission();
  if (permiso === "denied") return "bloqueadas";
  if (permiso !== "granted") return "sin-respuesta";
  try {
    await sincronizarToken();
    return "activadas";
  } catch {
    return "error";
  }
}

/**
 * Saca el token de este teléfono y lo guarda en el servidor. Se llama al activar y en cada
 * carga con el permiso ya dado: FCM puede rotar el token y así el servidor siempre tiene el
 * vigente.
 *
 * El SDK de messaging se importa aquí y no arriba: pesa, y solo hace falta a quien activa.
 * La carga inicial de la página no lo paga (ver punto 5 de `docs/backlog-2.md`).
 */
export async function sincronizarToken(): Promise<void> {
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("messaging_no_soportado");
  await navigator.serviceWorker.register("/sw.js");
  const registro = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), {
    vapidKey: CLAVE_VAPID,
    serviceWorkerRegistration: registro,
  });
  await registrarDispositivo({ token, plataforma: plataforma(navigator.userAgent) });
}
```

- [x] **Step 5: Build**

Run: `cd web && npm test && npm run build`
Expected: PASS; build sin errores. `firebase/messaging` aparece como chunk aparte en `dist/assets`, no dentro del bundle principal.

- [ ] **Step 6: Commit y push**

```bash
git add web/public/sw.js web/src/notificacionesNavegador.ts web/src/acciones.ts web/src/datos.ts
git commit -m "feat: service worker and token registration for web push"
git push origin main
```

---

### Task 7: UI de notificaciones en la web

**Files:**
- Create: `web/src/ui/tarjetaNotificaciones.ts`, `web/src/ui/tarjetaNotificaciones.test.ts`
- Modify: `web/src/ventanas.ts`, `web/src/ventanas.test.ts`, `web/src/main.ts`, `web/src/estilos.css`

**Interfaces:**
- Consumes: `EstadoNotificaciones` (Task 5); `entornoDelNavegador`, `activarNotificaciones`, `sincronizarToken` (Task 6).
- Produces:
  - `seccionNotificaciones(estado: EstadoNotificaciones, ocupado: boolean): string`
  - `invitacionNotificaciones(estado: EstadoNotificaciones, descartada: boolean): string`
  - `conectarNotificaciones(alActivar: () => void, alDescartar: () => void): void`
  - `DatosCliente` gana `notificaciones: EstadoNotificaciones; invitacionDescartada: boolean; activandoNotificaciones: boolean`

- [x] **Step 1: Write the failing test**

`web/src/ui/tarjetaNotificaciones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { invitacionNotificaciones, seccionNotificaciones } from "./tarjetaNotificaciones";

describe("seccionNotificaciones (Ajustes)", () => {
  it("sin la llave del entrenador no pinta nada", () => {
    expect(seccionNotificaciones("no-habilitada", false)).toBe("");
  });

  it("para instalar muestra los pasos, empezando por salir de WhatsApp, y ningún botón", () => {
    const html = seccionNotificaciones("instalar", false);
    expect(html).toContain("Abrir en Safari");
    expect(html).toContain("Agregar a inicio");
    expect(html).toContain("desde el ícono");
    expect(html).not.toContain(`id="activar-notificaciones"`);
  });

  it("sin token en la ruta pide abrir el link de WhatsApp primero", () => {
    expect(seccionNotificaciones("instalar-desde-link", false)).toContain("tu link de WhatsApp");
  });

  it("con permiso pendiente muestra el botón, deshabilitado mientras activa", () => {
    expect(seccionNotificaciones("pedir-permiso", false)).toContain(`id="activar-notificaciones"`);
    expect(seccionNotificaciones("pedir-permiso", true)).toContain("disabled");
  });

  it("activadas, bloqueadas y no soportado se explican sin botón", () => {
    expect(seccionNotificaciones("activadas", false)).toContain("activadas");
    expect(seccionNotificaciones("bloqueadas", false)).toContain("Ajustes");
    expect(seccionNotificaciones("no-soportado", false)).toContain("16.4");
    for (const e of ["activadas", "bloqueadas", "no-soportado"] as const) {
      expect(seccionNotificaciones(e, false)).not.toContain(`id="activar-notificaciones"`);
    }
  });
});

describe("invitacionNotificaciones (Inicio)", () => {
  it("invita solo a quien puede dar el siguiente paso y no la descartó", () => {
    expect(invitacionNotificaciones("pedir-permiso", false)).toContain(`id="activar-notificaciones"`);
    expect(invitacionNotificaciones("instalar", false)).toContain("Ajustes");
    expect(invitacionNotificaciones("pedir-permiso", true)).toBe("");
    for (const e of ["no-habilitada", "activadas", "bloqueadas", "no-soportado", "instalar-desde-link"] as const) {
      expect(invitacionNotificaciones(e, false)).toBe("");
    }
  });

  it("trae su botón para descartarla", () => {
    expect(invitacionNotificaciones("pedir-permiso", false)).toContain(`id="descartar-notificaciones"`);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/tarjetaNotificaciones.test.ts`
Expected: FAIL — no existe el módulo.

- [x] **Step 3: Implementación de la tarjeta**

`web/src/ui/tarjetaNotificaciones.ts`:

```ts
import type { EstadoNotificaciones } from "../notificaciones";

/**
 * Los pasos para instalar en iPhone. Es la parte que más importa de toda la función: sin
 * instalar, iOS no deja recibir notificaciones, y Apple no permite mostrar un aviso
 * automático de instalación, así que la página solo puede explicarlo.
 */
const PASOS_INSTALAR = `
  <ol class="pasos-instalar">
    <li>Si estás dentro de WhatsApp, toca <strong>⋯</strong> y elige <strong>Abrir en Safari</strong>.</li>
    <li>En Safari, toca <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).</li>
    <li>Elige <strong>Agregar a inicio</strong> y luego <strong>Agregar</strong>.</li>
    <li>Cierra Safari y abre <strong>OSfit</strong> desde el ícono nuevo de tu pantalla de inicio.</li>
    <li>Ahí te aparecerá el botón para activar las notificaciones.</li>
  </ol>`;

function boton(ocupado: boolean): string {
  return `<button class="boton" id="activar-notificaciones"${ocupado ? " disabled" : ""}>
      ${ocupado ? "Activando…" : "Activar notificaciones"}
    </button>`;
}

/** La sección de Ajustes. Vacía si el entrenador no la habilitó. */
export function seccionNotificaciones(estado: EstadoNotificaciones, ocupado: boolean): string {
  const cuerpo: Record<Exclude<EstadoNotificaciones, "no-habilitada">, string> = {
    "instalar": `<p class="ajuste-nota">Para recibir avisos de tus coaches en iPhone, instala esta página en tu pantalla de inicio:</p>${PASOS_INSTALAR}`,
    "instalar-desde-link": `<p class="ajuste-nota">Abre esta página desde tu link de WhatsApp y desde ahí instálala en tu pantalla de inicio.</p>`,
    "no-soportado": `<p class="ajuste-nota">Este teléfono no puede recibir avisos de una página web. En iPhone hace falta iOS 16.4 o más reciente.</p>`,
    "pedir-permiso": `<p class="ajuste-nota">Recibe los avisos de tus coaches: cuando llegan, cuando se van o si se retrasan.</p>${boton(ocupado)}`,
    "activadas": `<p class="ajuste-nota">✅ Notificaciones activadas en este teléfono.</p>`,
    "bloqueadas": `<p class="ajuste-nota">Las notificaciones están bloqueadas. Actívalas en Ajustes del teléfono → Notificaciones → OSfit.</p>`,
  };
  if (estado === "no-habilitada") return "";
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Notificaciones</p>
      ${cuerpo[estado]}
    </div>`;
}

/**
 * La invitación de Inicio. Solo para quien puede dar el siguiente paso; los demás estados
 * se explican en Ajustes, que es donde la clienta va a buscarlo.
 */
export function invitacionNotificaciones(estado: EstadoNotificaciones, descartada: boolean): string {
  if (descartada) return "";
  if (estado !== "pedir-permiso" && estado !== "instalar") return "";
  const accion =
    estado === "pedir-permiso"
      ? boton(false)
      : `<p class="ajuste-nota">Mira cómo instalar la página en <strong>Ajustes</strong> (menú ☰).</p>`;
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">🔔 Avisos de tus coaches</p>
      <p class="ajuste-nota">Entérate cuando llegan, cuando se van o si se retrasan.</p>
      ${accion}
      <button class="boton-texto" id="descartar-notificaciones">Ahora no</button>
    </div>`;
}

/** Se vuelve a colgar en cada repintado, como el resto de `conectar*`. */
export function conectarNotificaciones(alActivar: () => void, alDescartar: () => void): void {
  document.querySelector("#activar-notificaciones")?.addEventListener("click", alActivar);
  document.querySelector("#descartar-notificaciones")?.addEventListener("click", alDescartar);
}
```

Verificar que `.boton-texto` exista en `estilos.css` (`grep -n "boton-texto" web/src/estilos.css`). Si no existe, agregar en el Step 6 un estilo de botón de solo texto acorde a los demás.

- [x] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/ui/tarjetaNotificaciones.test.ts`
Expected: PASS.

- [x] **Step 5: Registro de ventanas**

En `web/src/ventanas.ts`:

- Importar: `import { invitacionNotificaciones, seccionNotificaciones } from "./ui/tarjetaNotificaciones";` y `import type { EstadoNotificaciones } from "./notificaciones";`.
- `DatosCliente` gana:

```ts
  /** Qué ofrecerle sobre notificaciones; lo calcula `main.ts` en cada repintado. */
  notificaciones: EstadoNotificaciones;
  /** Si ya dijo "Ahora no" a la invitación de Inicio. Lo guarda el navegador. */
  invitacionDescartada: boolean;
  /** Mientras el permiso y el registro están en curso: el botón se deshabilita. */
  activandoNotificaciones: boolean;
```

- En `inicio()`, después de `${tarjetaDia(...)}`:

```ts
      ${invitacionNotificaciones(d.notificaciones, d.invitacionDescartada)}
```

- En la entrada `ajustes`:

```ts
    pintar: (d) => tarjetaAjustes(d.estilo) + seccionNotificaciones(d.notificaciones, d.activandoNotificaciones),
```

En `web/src/ventanas.test.ts`, en `datos()`, agregar a la base:
`notificaciones: "no-habilitada", invitacionDescartada: false, activandoNotificaciones: false,`
y un test:

```ts
  it("Ajustes muestra la sección de notificaciones solo si está habilitada", () => {
    expect(contenidoDe(ventana("ajustes"), datos())).not.toContain("Notificaciones");
    expect(contenidoDe(ventana("ajustes"), datos({ notificaciones: "pedir-permiso" })))
      .toContain(`id="activar-notificaciones"`);
  });
```

Run: `cd web && npx vitest run src/ventanas.test.ts` → Expected: PASS.

- [x] **Step 6: `main.ts` y estilos**

Imports nuevos:

```ts
import { estadoNotificaciones } from "./notificaciones";
import { activarNotificaciones, entornoDelNavegador, sincronizarToken } from "./notificacionesNavegador";
import { conectarNotificaciones } from "./ui/tarjetaNotificaciones";
```

Junto a las demás variables de estado en `arrancar()` (después de `let pedidoRanking = 0;`):

```ts
  /** Llave en el navegador para "Ahora no". Se pierde si borran datos: vuelve a salir, no es grave. */
  const LLAVE_INVITACION = "osfit:notificaciones-descartada";
  let invitacionDescartada = (() => {
    try { return localStorage.getItem(LLAVE_INVITACION) === "1"; } catch { return false; }
  })();
  let activandoNotificaciones = false;
  /** El token se resincroniza una vez por carga, no en cada snapshot del cliente. */
  let tokenSincronizado = false;

  function alActivarNotificaciones(): void {
    // Sin `await` antes de `activarNotificaciones`: ahí adentro, `requestPermission` tiene
    // que ser lo primero para que iOS lo cuente como respuesta al toque.
    const intento = activarNotificaciones();
    activandoNotificaciones = true;
    pintar();
    intento.finally(() => {
      activandoNotificaciones = false;
      pintar();
    });
  }

  function alDescartarInvitacion(): void {
    invitacionDescartada = true;
    try { localStorage.setItem(LLAVE_INVITACION, "1"); } catch { /* se pierde el recuerdo, no la página */ }
    pintar();
  }
```

En `pintar()`, en el objeto que se pasa a `contenidoDe(...)`, agregar:

```ts
      notificaciones: estadoNotificaciones(cliente.notificacionesWeb === true, entornoDelNavegador()),
      invitacionDescartada,
      activandoNotificaciones,
```

En `pintar()`, el bloque de `ajustes` queda:

```ts
    if (activa.id === "ajustes") {
      conectarAjustes(estilo, (nuevo) => {
        estilo = nuevo;
        pintar();
      });
      conectarNotificaciones(alActivarNotificaciones, alDescartarInvitacion);
      return;
    }
```

Y en la parte de Inicio, después de `conectarAccionFalta(...)`:

```ts
    conectarNotificaciones(alActivarNotificaciones, alDescartarInvitacion);
```

En el callback de `observarCliente`, después de `aplicarPaleta(...)`:

```ts
    // Con el permiso ya dado, se manda el token vigente una vez por carga: FCM puede rotarlo
    // y así el servidor nunca se queda con uno muerto. Si falla, no se le muestra nada a la
    // clienta; la próxima carga lo vuelve a intentar.
    if (!tokenSincronizado && c?.notificacionesWeb === true &&
        estadoNotificaciones(true, entornoDelNavegador()) === "activadas") {
      tokenSincronizado = true;
      sincronizarToken().catch(() => {});
    }
```

En `web/src/estilos.css`, al final:

```css
/* Pasos para instalar la página en iPhone (Ajustes → Notificaciones). */
.pasos-instalar {
  margin: 8px 0 0;
  padding-left: 20px;
  color: var(--texto);
  font-size: 14px;
  line-height: 1.5;
}
.pasos-instalar li + li {
  margin-top: 6px;
}
```

- [x] **Step 7: Suite completa y build**

Run: `cd web && npm test && npm run build`
Expected: PASS y build sin errores.

- [ ] **Step 8: Commit y push**

```bash
git add web/src
git commit -m "feat: notification settings and invite card on the client web"
git push origin main
```

---

### Task 8: Datos y repositorios en la app

**Files:**
- Modify: `app/.../data/model/Cliente.kt`, `app/.../data/repository/ClienteRepository.kt`, `FirestoreClienteRepository.kt`, `app/.../data/fake/FakeClienteRepository.kt`, `app/.../data/AppContainer.kt`
- Create: `app/.../data/model/Notificacion.kt`, `app/.../data/repository/NotificacionRepository.kt`, `app/.../data/repository/DispositivoRepository.kt`

- [x] **Step 1: Campo en `Cliente`**

Después de `tieneAccesoWeb`:

```kotlin
    // Llave del entrenador para las notificaciones de la web. Apagada por defecto: solo
    // reciben avisos las clientas que él habilite, además de que ellas den permiso en su
    // teléfono. La función `enviarNotificacion` la vuelve a revisar al enviar.
    val notificacionesWeb: Boolean = false
```

- [x] **Step 2: Repositorio de clientes**

En `ClienteRepository`, después de `actualizarTieneAccesoWeb`:

```kotlin
    suspend fun actualizarNotificacionesWeb(clienteId: String, habilitada: Boolean)
```

En `FirestoreClienteRepository`:

```kotlin
    override suspend fun actualizarNotificacionesWeb(clienteId: String, habilitada: Boolean) {
        coleccion.document(clienteId).update("notificacionesWeb", habilitada).await()
    }
```

En `FakeClienteRepository`:

```kotlin
    override suspend fun actualizarNotificacionesWeb(clienteId: String, habilitada: Boolean) {
        actualizarCliente(clienteId) { it.copy(notificacionesWeb = habilitada) }
    }
```

- [x] **Step 3: Modelo `Notificacion`**

`app/.../data/model/Notificacion.kt`:

```kotlin
package com.osfit.app.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.ServerTimestamp

/**
 * Un aviso a las clientas, en `notificaciones/{id}`. La app lo crea en "pendiente" y la
 * función `enviarNotificacion` lo manda y anota `estado`, `enviadas` y `fallidas`: el mismo
 * documento es la cola y el historial.
 *
 * `enviadas` y `fallidas` cuentan **dispositivos**, no clientas: una clienta con teléfono y
 * tablet suma dos.
 */
data class Notificacion(
    val id: String = "",
    val titulo: String = "OSfit",
    val texto: String = "",
    val destino: String = DESTINO_TODAS,
    val clientesElegidos: List<String> = emptyList(),
    @ServerTimestamp val creada: Timestamp? = null,
    val estado: String = ESTADO_PENDIENTE,
    val enviadas: Int = 0,
    val fallidas: Int = 0
) {
    companion object {
        const val DESTINO_TODAS = "todas"
        const val DESTINO_ELEGIDAS = "elegidas"
        const val ESTADO_PENDIENTE = "pendiente"
        const val ESTADO_ENVIANDO = "enviando"
        const val ESTADO_ENVIADA = "enviada"
        const val ESTADO_ERROR = "error"
    }
}
```

- [x] **Step 4: `NotificacionRepository`**

`app/.../data/repository/NotificacionRepository.kt`:

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.Notificacion
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class NotificacionRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("notificaciones")

    fun observarHistorial(limite: Long = 30): Flow<List<Notificacion>> = callbackFlow {
        val registro = coleccion.orderBy("creada", Query.Direction.DESCENDING).limit(limite)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(
                    snapshot?.documents.orEmpty().mapNotNull { doc ->
                        doc.toObject(Notificacion::class.java)?.copy(id = doc.id)
                    }
                )
            }
        awaitClose { registro.remove() }
    }

    /**
     * Sin `await` a propósito: sin señal, la escritura espera en la cola local de Firestore y
     * sale sola al volver la red. Esperarla dejaría la pantalla en "enviando" hasta entonces;
     * el historial ya muestra el aviso como pendiente desde el caché local.
     */
    fun enviar(aviso: Notificacion) {
        coleccion.add(aviso.copy(id = "", estado = Notificacion.ESTADO_PENDIENTE))
    }
}
```

- [x] **Step 5: `DispositivoRepository`**

`app/.../data/repository/DispositivoRepository.kt`:

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Los teléfonos donde la clienta activó las notificaciones. Los escribe la función
 * `registrarDispositivo`; la app solo los cuenta, para que el entrenador sepa si de verdad le
 * van a llegar los avisos.
 */
class DispositivoRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    fun contarDispositivos(clienteId: String): Flow<Int> = callbackFlow {
        val registro = db.collection("clientes").document(clienteId).collection("dispositivos")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.size() ?: 0)
            }
        awaitClose { registro.remove() }
    }
}
```

- [x] **Step 6: `AppContainer`**

Agregar los imports y:

```kotlin
    val notificacionRepository: NotificacionRepository by lazy { NotificacionRepository() }
    val dispositivoRepository: DispositivoRepository by lazy { DispositivoRepository() }
```

- [x] **Step 7: Compilar**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 8: Commit y push**

```bash
git add app/src/main/java/com/osfit/app/data
git commit -m "feat: app data layer for client notifications"
git push origin main
```

---

### Task 9: Lógica de dominio de los avisos (JUnit)

**Files:**
- Create: `app/.../domain/Avisos.kt`
- Test: `app/src/test/java/com/osfit/app/domain/AvisosTest.kt`

**Interfaces:**
- Produces: `object Avisos { val RAPIDOS: List<String>; const val LARGO_MAXIMO = 500; fun destinatarias(clientes: List<Cliente>, elegidos: Set<String>?): List<Cliente>; fun resumen(n: Notificacion): String }`

- [x] **Step 1: Write the failing test**

`app/src/test/java/com/osfit/app/domain/AvisosTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Notificacion
import org.junit.Assert.assertEquals
import org.junit.Test

class AvisosTest {

    private fun c(id: String, habilitada: Boolean = true, activo: Boolean = true) =
        Cliente(id = id, nombre = id, activo = activo, notificacionesWeb = habilitada)

    @Test
    fun `todas son las habilitadas y activas`() {
        val r = Avisos.destinatarias(listOf(c("a"), c("b", habilitada = false), c("x", activo = false)), null)
        assertEquals(listOf("a"), r.map { it.id })
    }

    @Test
    fun `elegir a una clienta no habilitada no la incluye`() {
        val r = Avisos.destinatarias(listOf(c("a"), c("b", habilitada = false)), setOf("a", "b"))
        assertEquals(listOf("a"), r.map { it.id })
    }

    @Test
    fun `el resumen dice en que va el envio`() {
        assertEquals("Enviando…", Avisos.resumen(Notificacion(estado = Notificacion.ESTADO_PENDIENTE)))
        assertEquals("Enviando…", Avisos.resumen(Notificacion(estado = Notificacion.ESTADO_ENVIANDO)))
        assertEquals("No se pudo enviar", Avisos.resumen(Notificacion(estado = Notificacion.ESTADO_ERROR)))
        assertEquals("Llegó a 1 teléfono", Avisos.resumen(Notificacion(estado = "enviada", enviadas = 1)))
        assertEquals(
            "Llegó a 6 teléfonos · 1 falló",
            Avisos.resumen(Notificacion(estado = "enviada", enviadas = 6, fallidas = 1))
        )
        assertEquals("Nadie tenía las notificaciones activadas", Avisos.resumen(Notificacion(estado = "enviada")))
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.osfit.app.domain.AvisosTest"`
Expected: FAIL (no compila: no existe `Avisos`).

- [x] **Step 3: Write minimal implementation**

`app/.../domain/Avisos.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Notificacion

object Avisos {

    /**
     * Los textos de los botones rápidos. Llenan el campo, no envían: así "más tarde" se
     * completa con la hora antes de mandar, y nada sale por un toque accidental.
     */
    val RAPIDOS = listOf(
        "¡Ya llegamos! Los esperamos 💪",
        "Ya nos fuimos. ¡Nos vemos la próxima!",
        "Hoy llegaremos más tarde, a las "
    )

    /** GEMELO: `LARGO_MAXIMO_TEXTO` en `functions/src/notificaciones.ts`. */
    const val LARGO_MAXIMO = 500

    /**
     * A quién le va a llegar, para decirlo antes de enviar. `elegidos == null` es "todas".
     *
     * GEMELO: `destinatarias` en `functions/src/notificaciones.ts`, que es la que manda de
     * verdad. Si estas dos difieren, el número que ve el entrenador miente.
     */
    fun destinatarias(clientes: List<Cliente>, elegidos: Set<String>?): List<Cliente> =
        clientes.filter { it.activo && it.notificacionesWeb && (elegidos == null || it.id in elegidos) }

    fun resumen(n: Notificacion): String = when (n.estado) {
        Notificacion.ESTADO_PENDIENTE, Notificacion.ESTADO_ENVIANDO -> "Enviando…"
        Notificacion.ESTADO_ERROR -> "No se pudo enviar"
        else -> when {
            n.enviadas == 0 && n.fallidas == 0 -> "Nadie tenía las notificaciones activadas"
            else -> buildString {
                append("Llegó a ${n.enviadas} ${if (n.enviadas == 1) "teléfono" else "teléfonos"}")
                if (n.fallidas > 0) append(" · ${n.fallidas} ${if (n.fallidas == 1) "falló" else "fallaron"}")
            }
        }
    }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.osfit.app.domain.AvisosTest"`
Expected: PASS.

- [ ] **Step 5: Commit y push**

```bash
git add app/src/main/java/com/osfit/app/domain/Avisos.kt app/src/test/java/com/osfit/app/domain/AvisosTest.kt
git commit -m "feat: quick notice texts, recipients and send summary for the coach app"
git push origin main
```

---

### Task 10: Interruptor "Notificaciones" en el apartado Web

**Files:**
- Modify: `app/.../ui/clientes/WebClienteScreen.kt`

**Nota:** si el plan del recordatorio de pago ya se ejecutó, `WebClienteViewModel` ya existe con el interruptor de recordatorio: **agregar** a ese ViewModel `dispositivos` y `cambiarNotificacionesWeb`, y poner esta tarjeta debajo de la del recordatorio. Si no existe, crearlo como abajo.

- [x] **Step 1: ViewModel**

En el mismo archivo (como `PaletaWebClienteViewModel` en el suyo):

```kotlin
class WebClienteViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val dispositivoRepository: DispositivoRepository = AppContainer.dispositivoRepository
) : ViewModel() {

    val cliente: StateFlow<Cliente?> = clienteRepository.observarCliente(clienteId)
        .catch { emit(null) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val dispositivos: StateFlow<Int> = dispositivoRepository.contarDispositivos(clienteId)
        .catch { emit(0) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    fun cambiarNotificacionesWeb(habilitada: Boolean) {
        viewModelScope.launch {
            runCatching { clienteRepository.actualizarNotificacionesWeb(clienteId, habilitada) }
        }
    }
}
```

- [x] **Step 2: Tarjeta con el interruptor**

En `WebClienteScreen`, obtener el ViewModel:

```kotlin
    val viewModel: WebClienteViewModel = viewModel(
        factory = viewModelFactory { initializer { WebClienteViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val dispositivos by viewModel.dispositivos.collectAsState()
```

Y al final del `LazyColumn`, después de la rejilla:

```kotlin
            // No es una sección de `seccionesWeb`: no navega a ningún lado, es un sí/no.
            item {
                val habilitada = cliente?.notificacionesWeb == true
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("🔔 Notificaciones", style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.weight(1f))
                            Switch(
                                checked = habilitada,
                                onCheckedChange = { viewModel.cambiarNotificacionesWeb(it) },
                                enabled = cliente != null
                            )
                        }
                        Text(
                            when {
                                !habilitada -> "Apagado: no recibe los avisos que mandes desde Avisos."
                                dispositivos == 0 -> "Todavía no las activó en su teléfono. En iPhone tiene que instalar la página en su inicio y abrirla desde ahí."
                                dispositivos == 1 -> "Activadas en 1 teléfono."
                                else -> "Activadas en $dispositivos teléfonos."
                            },
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
```

Imports nuevos: `Card`, `Column`, `Switch`, `Alignment`, `collectAsState`, `getValue`, `viewModel`, `viewModelFactory`, `initializer`, `ViewModel`, `viewModelScope`, `StateFlow`, `SharingStarted`, `stateIn`, `catch`, `launch`, `Cliente`, `ClienteRepository`, `DispositivoRepository`, `AppContainer`.

Actualizar el comentario de cabecera de `WebClienteScreen`: lo que navega entra por `seccionesWeb`; los sí/no van como tarjetas con interruptor debajo de la rejilla.

- [x] **Step 3: Compilar**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit y push**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/WebClienteScreen.kt
git commit -m "feat: per-client notifications switch in the Web section"
git push origin main
```

---

### Task 11: Pantalla "Avisos"

**Files:**
- Create: `app/.../ui/avisos/AvisosViewModel.kt`, `app/.../ui/avisos/AvisosScreen.kt`
- Modify: `app/.../ui/navigation/Screen.kt`, `app/.../ui/navigation/OSfitNavHost.kt`, `app/.../ui/OSfitApp.kt`

- [x] **Step 1: ViewModel**

`app/.../ui/avisos/AvisosViewModel.kt`:

```kotlin
package com.osfit.app.ui.avisos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Notificacion
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.NotificacionRepository
import com.osfit.app.domain.Avisos
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class AvisosViewModel(
    clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val notificacionRepository: NotificacionRepository = AppContainer.notificacionRepository
) : ViewModel() {

    val texto = MutableStateFlow("")
    /** `null` = todas las habilitadas; un conjunto = las que eligió. */
    val elegidos = MutableStateFlow<Set<String>?>(null)

    /** Solo las habilitadas y activas: son las únicas que se pueden elegir. */
    val habilitadas: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .map { Avisos.destinatarias(it, null).sortedBy { c -> c.nombre.lowercase() } }
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val destinatarias: StateFlow<Int> = combine(habilitadas, elegidos) { h, e ->
        Avisos.destinatarias(h, e).size
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val historial: StateFlow<List<Notificacion>> = notificacionRepository.observarHistorial()
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun usarRapido(rapido: String) { texto.value = rapido }

    fun cambiarTexto(nuevo: String) { texto.value = nuevo.take(Avisos.LARGO_MAXIMO) }

    fun elegirTodas() { elegidos.value = null }

    fun alternar(clienteId: String) {
        val actual = elegidos.value ?: emptySet()
        elegidos.value = if (clienteId in actual) actual - clienteId else actual + clienteId
    }

    fun puedeEnviar(): Boolean = texto.value.isNotBlank() && destinatarias.value > 0

    fun enviar() {
        if (!puedeEnviar()) return
        val e = elegidos.value
        notificacionRepository.enviar(
            Notificacion(
                texto = texto.value.trim(),
                destino = if (e == null) Notificacion.DESTINO_TODAS else Notificacion.DESTINO_ELEGIDAS,
                clientesElegidos = e?.toList().orEmpty()
            )
        )
        texto.value = ""
        elegidos.value = null
    }
}
```

- [x] **Step 2: Pantalla**

`app/.../ui/avisos/AvisosScreen.kt` — Compose con, de arriba abajo:

1. Título "Avisos".
2. Fila con un `AssistChip` por cada `Avisos.RAPIDOS` → `viewModel.usarRapido(it)`. Etiquetas cortas: "Ya llegamos", "Ya nos fuimos", "Llegaremos más tarde".
3. `OutlinedTextField` multilínea con `texto`, contador `n/500`.
4. Dos `RadioButton`: "Todas las habilitadas (N)" → `elegirTodas()`; "Elegir…" → `elegidos.value = emptySet()`. Con "Elegir…", la lista de `habilitadas` con `Checkbox` → `alternar(id)`.
   Si `habilitadas` está vacía: texto "Ninguna clienta tiene las notificaciones habilitadas. Actívalas en el apartado Web de cada una."
5. `Button("Enviar")`, habilitado con `puedeEnviar()`, que abre un `AlertDialog`:
   título "¿Enviar aviso?", cuerpo con el texto entre comillas y "Le llegará a N clientas que tengan las notificaciones activadas en su teléfono. Un aviso enviado no se puede retirar.", botones "Enviar" (→ `enviar()`) y "Cancelar".
6. "Enviados": `historial` con fecha y hora de `creada` (formato `d MMM HH:mm`, zona del teléfono), el texto en una línea con `maxLines = 1`, y `Avisos.resumen(it)` debajo, en `bodySmall`.

Todo el texto del aviso se pinta con `Text(...)` (nunca HTML), así que no hay nada que escapar.

El ViewModel se obtiene con `viewModel()` (constructor sin argumentos obligatorios).

- [x] **Step 3: Navegación**

`Screen.kt`, junto a `ConfigVideo`:

```kotlin
    data object Avisos : Screen("avisos")
```

`OSfitNavHost.kt`, junto a `Screen.Top`:

```kotlin
        composable(Screen.Avisos.route) {
            com.osfit.app.ui.avisos.AvisosScreen()
        }
```

`OSfitApp.kt`, en el menú lateral, **primera** entrada (es lo que más se va a usar a diario, antes que "Top"):

```kotlin
                        NavigationDrawerItem(
                            label = { Text("Avisos") },
                            selected = rutaActual == Screen.Avisos.route,
                            onClick = {
                                scope.launch { drawerState.close() }
                                navController.navigate(Screen.Avisos.route)
                            },
                            modifier = Modifier.padding(12.dp)
                        )
```

- [x] **Step 4: Compilar y tests**

Run: `./gradlew test assembleDebug`
Expected: BUILD SUCCESSFUL, tests en verde.

- [ ] **Step 5: Commit y push**

```bash
git add app/src/main/java/com/osfit/app/ui
git commit -m "feat: Avisos screen to send push notices to clients"
git push origin main
```

---

### Task 12: Despliegue y verificación en dispositivos (con confirmación)

- [x] **Step 1: Suites y builds**

```bash
cd functions && npm test && npm run build
cd ../web && npm test && npm run build
cd .. && ./gradlew test assembleDebug
```

Expected: todo en verde.

- [x] **Step 2: Pedir confirmación y desplegar**

Preguntar al entrenador. Con su sí:

```bash
firebase deploy --only firestore:rules,functions,hosting
```

El primer despliegue de un trigger de Firestore puede pedir habilitar APIs (Eventarc, Pub/Sub); aceptar. Si falla por región, volver a la Task 4, Step 1.

Instalar la app: `./gradlew installDebug`.

- [ ] **Step 3: Verificación en iPhone**

1. App: en el apartado Web de la clienta de prueba, prender "Notificaciones" → dice "Todavía no las activó…".
2. iPhone: abrir el link en WhatsApp → Ajustes de la página → aparecen los pasos (empezando por "Abrir en Safari").
3. Seguir los pasos: Safari → Compartir → Agregar a inicio → abrir desde el ícono → entra sin candado.
4. Inicio muestra la invitación; tocar "Activar notificaciones" → aparece el permiso del sistema → Permitir → Ajustes dice "✅ Notificaciones activadas".
5. App: el interruptor dice "Activadas en 1 teléfono".
6. App → Avisos → "Ya llegamos" → Enviar → confirmar. El historial pasa de "Enviando…" a "Llegó a 1 teléfono".
7. iPhone **con la página cerrada y la pantalla bloqueada**: llega "OSfit — ¡Ya llegamos! Los esperamos 💪". Tocarla abre la página instalada.
8. App: apagar el interruptor de esa clienta → enviar otro aviso → **no** le llega, y el historial dice "Nadie tenía las notificaciones activadas".
9. Volver a prender, enviar `<b>hola</b>` → llega como texto tal cual, sin negritas.

- [ ] **Step 4: Verificación en Android/Chrome**

Abrir el link en Chrome → Ajustes → botón directo, sin pasos de instalación → activar → enviar un aviso → llega.

- [ ] **Step 5: Cerrar**

- Anotar al final de este archivo qué se verificó, en qué modelos y versiones, y lo que haya fallado.
- En `docs/backlog-2.md`, cambiar el encabezado del punto 1 a `## 1. Notificaciones en iPhone: convertir la web en PWA — ✅ HECHO (<fecha>)` y agregar un párrafo breve de qué quedó y qué no.

```bash
git add docs
git commit -m "docs: record device verification of client push notifications"
git push origin main
```

---

## Registro de verificación

- 2026-10-08 — Task 1 verificada en iPhone (modelo y versión de iOS sin anotar): instalada
  desde `/c/<token>` en Safari, abierta desde el ícono, entra sin candado; también al cerrarla
  y reabrirla. Desplegados hosting, reglas, `registrarDispositivo` (`us-west1`) y
  `enviarNotificacion` (`us-central1`); app con Avisos instalada en el teléfono del entrenador.
- 2026-10-08 — Aviso de punta a punta verificado en ese iPhone: mandado desde Avisos en la app,
  llegó como notificación. Sin verificar todavía: interruptor apagado → no llega, texto con
  HTML, y Android/Chrome.
