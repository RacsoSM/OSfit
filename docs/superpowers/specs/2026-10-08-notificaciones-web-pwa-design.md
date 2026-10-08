# Notificaciones a los clientes: web instalable (PWA) y avisos desde la app

## Contexto y objetivo

Hoy el entrenador se comunica con las clientas solo por WhatsApp, uno por uno. Hay avisos
que son para todas a la vez y que se repiten: "ya llegamos", "ya nos fuimos", "hoy
llegaremos más tarde". Este spec agrega **notificaciones push** a la página de la clienta,
mandadas **a mano desde la app** del entrenador.

Es el punto 1 de `docs/backlog-2.md`. El nombre del punto habla de iPhone porque ahí está la
dificultad: en iOS, una página web solo puede recibir notificaciones si la clienta la
**instaló** en su pantalla de inicio. Por eso la web se convierte en una PWA (web instalable).
En Android/Chrome el mismo trabajo sirve, con menos fricción.

**Decisiones tomadas:**

- **Las notificaciones las escribe el entrenador.** No hay avisos automáticos en esta versión.
  Desde un botón de la app escribe un texto libre, o elige uno de los rápidos ("Ya llegamos",
  "Ya nos fuimos", "Hoy llegaremos más tarde") que se puede editar antes de enviar.
- **Dos llaves para recibirlas.** El entrenador habilita a cada clienta (interruptor en el
  apartado **Web** de su ficha, **apagado por defecto**), y la clienta además tiene que dar
  permiso desde su página. Sin las dos, no le llega nada. Si el entrenador apaga el
  interruptor, deja de recibir aunque ella haya dado permiso.
- **A quién se manda:** por defecto a **todas las habilitadas**; opcionalmente, a las que el
  entrenador elija de una lista.
- **Queda historial** de lo enviado, con cuántas lo recibieron.

**Fuera de alcance:** avisos automáticos (recordatorio de pago, racha en riesgo, video nuevo,
medallas); programar un aviso para más tarde; respuestas de la clienta; ver el historial de
avisos dentro de la página de la clienta; imágenes o botones dentro de la notificación.
Todo esto se puede construir encima de lo de aquí después — el recordatorio de pago push solo
necesitaría una función programada que escriba en la misma colección.

## Las restricciones de iOS que mandan sobre el diseño

Esto no es configurable; es cómo funciona Safari, y todo lo demás se acomoda a ello:

1. **Solo iOS 16.4 o más nuevo.**
2. **Solo con la página instalada** ("Compartir → Agregar a inicio") y abierta desde ese
   ícono. En Safari normal no existe la API de notificaciones; en el navegador que abre
   WhatsApp, tampoco, y desde ahí **ni siquiera se puede instalar**: hay que abrir el link en
   Safari primero.
3. **Apple no deja mostrar un aviso automático de instalación.** La página solo puede explicar
   los pasos.
4. **El permiso se pide como respuesta a un toque** de la clienta. Pedirlo al cargar la página
   falla en silencio.
5. **La página instalada tiene su propio almacenamiento**, separado del de Safari: no hereda la
   sesión ni el token recordado (`sesion.ts`).

## La sesión en la página instalada (restricción 5)

Es el riesgo más grande del proyecto: si la página instalada abre en la pantalla del candado,
todo lo demás sobra.

Se resuelve **sin tocar la escalera de `resolverSesion`**: el manifest **no declara
`start_url`**. Según el estándar, sin `start_url` la página instalada arranca en la dirección
desde la que se instaló, y la clienta la instala estando en su link `/c/<token>`. Así, cada
vez que abre el ícono entra por el escalón 1 (token en la ruta), igual que si tocara su link
de WhatsApp. Esto solo funciona porque el token ya no se borra de la barra (ver el escalón 1
en `resolverSesion`); si algún día se vuelve a esconder, la página instalada se rompe.

- Si la clienta instaló desde `/mi` (dirección vieja, sin token), el escalón 3 no tiene de
  dónde sacar el token porque el almacenamiento es nuevo, y ve el candado. La guía de
  instalación (abajo) **solo se muestra cuando la ruta trae token**, para que no pase.
- A diferencia de Safari, el almacenamiento de una página instalada no se borra a los 7 días
  sin uso, así que después del primer canje la sesión guardada también sirve.
- **Verificación obligatoria en un iPhone real antes de dar el resto por bueno:** instalar
  desde `/c/<token>`, cerrar, abrir desde el ícono, y confirmar que entra. Es la primera tarea
  del plan.

## Datos

### Campo nuevo en `clientes/{id}`

```
notificacionesWeb: Boolean   // ausente = false
```

La llave del entrenador. Opcional por la regla de siempre. La web lo lee para saber si
ofrece "Activar notificaciones"; la función de envío lo lee para filtrar.

### Subcolección nueva `clientes/{id}/dispositivos/{idDispositivo}`

```
token: String          // token FCM web del navegador instalado
plataforma: String     // "ios" | "android" | "otro", solo para diagnóstico
creado: Timestamp
actualizado: Timestamp
```

- Una clienta puede tener más de un dispositivo (teléfono y tablet). El id del documento es
  un hash del token, para que registrar dos veces el mismo token no duplique.
- **La escribe solo la función `registrarDispositivo`** (Admin SDK), porque la página nunca
  escribe en Firestore.
- Reglas: `allow read, write: if esEntrenador();`. La clienta no necesita leerla, y el token
  es lo único que permitiría mandarle avisos a su teléfono.

### Colección nueva `notificaciones/{id}`

```
titulo: String               // por defecto "OSfit"
texto: String
destino: String              // "todas" | "elegidas"
clientesElegidos: [String]   // ids; vacío si destino == "todas"
creada: Timestamp
estado: String               // "pendiente" | "enviada" | "error"
enviadas: Number             // dispositivos que FCM aceptó
fallidas: Number
```

- **La escribe la app** (como todo lo del entrenador); la función completa `estado`,
  `enviadas` y `fallidas`.
- Reglas: `allow read, write: if esEntrenador();`.
- Es a la vez la cola de envío y el historial.

## Servidor (`functions/`)

### `registrarDispositivo` (callable, nueva)

- `clienteDeLaSesion(request)` → el clienteId sale del claim, nunca del body.
- Recibe `{ token, plataforma }`; valida que `token` sea un string no vacío y de largo sensato.
- Si el cliente no tiene `notificacionesWeb === true`, responde `failed-precondition` y no
  guarda nada.
- Escribe `clientes/{id}/dispositivos/{hash(token)}` con `set(..., { merge: true })`.

### `enviarNotificacion` (trigger `onDocumentCreated("notificaciones/{id}")`, nueva)

Por qué un trigger y no una callable: la app no tiene el SDK de Functions (solo Auth,
Firestore, Storage y Messaging en `app/build.gradle.kts`) y todo lo que hace el entrenador ya
es escribir en Firestore. Además, si el teléfono está sin señal, la escritura queda en la cola
local de Firestore y sale sola al volver la red.

1. Arma la lista de clientas: todas con `notificacionesWeb == true` (y `activo == true`), o
   las `clientesElegidos` que además estén habilitadas. **Una clienta elegida pero no
   habilitada no recibe**: la llave del entrenador manda siempre.
2. Lee los `dispositivos` de cada una.
3. `getMessaging().sendEachForMulticast` en tandas de 500 (límite de FCM), con mensajes
   **solo de datos** (`data: { titulo, texto }`): el service worker arma la notificación,
   así no se ve doble en navegadores que mostrarían `notification` por su cuenta. TTL de
   **4 horas**: un "ya llegamos" que llega al día siguiente confunde más de lo que avisa.
4. Los tokens que FCM rechaza como no registrados (`messaging/registration-token-not-registered`,
   `invalid-argument`) se **borran**: la clienta desinstaló o revocó el permiso.
5. Actualiza `estado`, `enviadas`, `fallidas`.

Se separa la parte pura (filtrar destinatarias, partir en tandas, clasificar errores) en
`notificaciones.ts` para probarla en Node, como `rachas.ts` respecto de `ranking.ts`.

**No se usan temas de FCM** (a diferencia del aviso de falta al entrenador, que va por el tema
`TEMA_ENTRENADOR`): con temas, apagar el interruptor de una clienta exigiría desuscribir sus
tokens, y elegir destinatarias no se puede. Mandando por token, el filtro se decide en el
momento del envío.

### Pruebas (vitest)

- `notificaciones.test.ts`: "todas" excluye a las no habilitadas y a las inactivas;
  "elegidas" excluye a las elegidas no habilitadas; tandas de 500; qué errores borran el token
  y cuáles no (un error de red no debe borrar nada).
- `registrarDispositivo.test.ts`: sin sesión → `unauthenticated`; sin habilitar →
  `failed-precondition`; mismo token dos veces → un solo documento.

## Web (`web/`)

### Volverla instalable

- `web/public/manifest.webmanifest`: `name`, `short_name` "OSfit", `display: "standalone"`,
  `background_color` y `theme_color` = `#121212` (los de `index.html`), íconos 192 y 512.
  **Sin `start_url`** (ver la sección de sesión).
- `web/public/firebase-messaging-sw.js`: el service worker que muestra la notificación con la
  página cerrada. Al tocarla, enfoca la ventana abierta si hay una, o abre `/` (la sesión
  guardada de la página instalada la deja entrar).
- `web/index.html`: `<link rel="manifest">`, `apple-touch-icon`,
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`.
- Íconos: el entrenador tiene que proveer el logo; si no, se genera uno simple con las
  iniciales.
- `firebase.json`: `Cache-Control: no-cache` para el service worker y el manifest, para que
  una versión nueva llegue sin que la clienta reinstale.

### `web/src/notificaciones.ts` (nuevo)

Decide qué ofrecer, como función pura testeable:

```ts
type EstadoNotificaciones =
  | "no-habilitada"        // el entrenador no la habilitó: no se muestra nada
  | "abrir-en-safari"      // iOS dentro de WhatsApp u otro navegador embebido
  | "instalar"             // iOS en Safari, sin instalar
  | "no-soportado"         // iOS < 16.4 o navegador sin Push API
  | "pedir-permiso"        // se puede: mostrar el botón
  | "activadas"            // permiso dado y token registrado
  | "bloqueadas";          // la clienta dijo que no: explicar cómo reactivarlas en Ajustes del teléfono
```

Entradas: `cliente.notificacionesWeb`, el user agent, `display-mode: standalone` /
`navigator.standalone`, `Notification.permission`, si hay token en la ruta.

Y la acción: `activarNotificaciones()` pide permiso, obtiene el token con
`getToken(messaging, { vapidKey, serviceWorkerRegistration })` y llama a
`registrarDispositivo` (en `acciones.ts`, que sigue siendo el único con `httpsCallable`). El
SDK de messaging se importa dinámicamente, solo al tocar el botón, para no engordar la carga
inicial (ver punto 5 del backlog).

### Dónde aparece

- **Ajustes:** una sección "Notificaciones" que muestra el estado y, según el caso, el botón
  "Activar notificaciones" o los pasos para instalar (con capturas o íconos de "Compartir" →
  "Agregar a inicio").
- **Inicio:** una tarjeta, una sola vez, ofreciendo activarlas a las habilitadas que todavía
  no lo hicieron. Se puede descartar, y el descarte se guarda en `localStorage` (si se pierde,
  vuelve a salir, que no es grave).
- Con `no-habilitada` no se muestra nada en ningún lado.

### Pruebas (vitest)

`notificaciones.test.ts` con los siete estados: iPhone en WhatsApp, iPhone en Safari, iPhone
instalado con y sin permiso, iOS 16.3, Android Chrome, cliente no habilitada.

## App Android (`app/`)

### Habilitar por clienta

En `WebClienteScreen`, debajo del interruptor de recordatorio de pago (spec del 2026-10-07),
otro interruptor igual: **"Notificaciones"**, con una línea de estado debajo: "Activadas en
N dispositivos" o "Todavía no las activó en su teléfono". Para eso, `WebClienteViewModel`
observa también `dispositivos`. `ClienteRepository` gana `actualizarNotificacionesWeb`.

### Pantalla "Enviar aviso"

Entrada nueva en el menú lateral (`OSfitApp.kt`), "Avisos", con su `Screen.Avisos`:

```
Avisos
[ Ya llegamos ] [ Ya nos fuimos ] [ Llegaremos más tarde ]

┌──────────────────────────────────────┐
│ Texto del aviso                      │
│ Hoy llegaremos 20 minutos tarde 🙏   │
└──────────────────────────────────────┘
Para: (•) Todas las habilitadas (7)   ( ) Elegir…

                              [ Enviar ]

Enviados
· Hoy 6:02  "Ya llegamos"           Llegó a 7 teléfonos
· Ayer 21:15 "Ya nos fuimos"        Llegó a 6 teléfonos · 1 falló
```

- Los botones rápidos **llenan el campo**, no envían: así "Llegaremos más tarde" se completa
  con la hora antes de mandar, y nada sale por un toque accidental.
- Antes de enviar, un diálogo de confirmación con el texto y cuántas lo van a recibir. Un
  aviso enviado no se puede retirar.
- "Elegir…" abre la lista de clientas habilitadas con casillas.
- El historial lee `notificaciones` ordenado por `creada`, con el estado que escribe la
  función. Los números son de **teléfonos**, no de clientas: una con teléfono y tablet suma
  dos.
- Nuevo `NotificacionRepository` (clase plana, como los demás) registrado en `AppContainer`, y
  `AvisosViewModel`.
- Los textos rápidos van como código (lista en `domain/`), no en Firestore: son tres y cambian
  poco. Se puede editar la lista en el código cuando haga falta.

### Pruebas

JUnit solo para lo que caiga en `domain/` (por ejemplo, el texto de "N de M" del historial).
Lo demás se verifica en dispositivo, como manda `AGENTS.md`.

## Configuración que hay que hacer a mano

- **Clave VAPID**: generarla en la consola de Firebase (Configuración del proyecto → Cloud
  Messaging → Certificados web push) y ponerla en la web. Es pública, puede ir en el código
  como el `firebaseConfig`.
- Desplegar reglas, funciones y hosting.

## Plan de verificación en dispositivo

1. iPhone: link en WhatsApp → la página muestra "Abre este link en Safari".
2. En Safari → muestra los pasos para instalar.
3. Instalar, abrir desde el ícono → **entra sin candado** (el riesgo principal).
4. Activar → aparece el permiso del sistema → aceptar → la app del entrenador muestra
   "Activadas en 1 dispositivo".
5. Enviar "Ya llegamos" desde la app → llega con la página cerrada y con la pantalla bloqueada.
6. Apagar el interruptor de esa clienta → enviar otro → no le llega.
7. Lo mismo en Android/Chrome (sin pasos de instalación).

## Resumen de archivos

| Archivo | Cambio |
| --- | --- |
| `firestore.rules` | `dispositivos` y `notificaciones`, solo entrenador |
| `firebase.json` | sin caché para el service worker y el manifest |
| `functions/src/registrarDispositivo.ts` (+ test) | callable nueva |
| `functions/src/notificaciones.ts` (+ test) | lógica pura de envío |
| `functions/src/enviarNotificacion.ts` | trigger de envío |
| `functions/src/index.ts` | exportar las dos |
| `web/public/manifest.webmanifest`, íconos | nuevos |
| `web/public/firebase-messaging-sw.js` | nuevo |
| `web/index.html` | manifest y etiquetas de Apple |
| `web/src/notificaciones.ts` (+ test) | estados y activación |
| `web/src/acciones.ts` | `registrarDispositivo` |
| `web/src/datos.ts` | `notificacionesWeb?` en `Cliente` |
| `web/src/ui/tarjetaAjustes.ts`, `ventanas.ts` | sección en Ajustes y tarjeta en Inicio |
| `app/.../data/model/Cliente.kt` | `notificacionesWeb` |
| `app/.../data/model/Notificacion.kt` | nuevo |
| `app/.../data/repository/NotificacionRepository.kt` | nuevo |
| `app/.../ui/clientes/WebClienteScreen.kt` | interruptor y estado |
| `app/.../ui/avisos/` | pantalla y ViewModel nuevos |
| `app/.../ui/OSfitApp.kt`, `navigation/` | entrada "Avisos" en el menú |
