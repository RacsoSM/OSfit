# Backlog 2

A diferencia de `docs/backlog.md`, este archivo **sí está versionado**. Por eso aquí no van
nombres de clientes reales: si una entrada necesita nombrar a alguien, va en `backlog.md`.

Misma convención que el otro backlog: las entradas se marcan (`— ✅ HECHO (fecha)`), no se
borran.

## 1. Notificaciones en iPhone: convertir la web en PWA

> "agrega al backlog de este proyecto el activar las notificaciones haciendo la web una pwa para ios"

Objetivo: que la página del cliente pueda mandar notificaciones push en iPhone (por ejemplo,
el recordatorio de pago de `superpowers/specs/2026-10-07-recordatorio-pago-web-design.md`).

Lo que hay que saber antes de diseñarlo:

- **iOS solo permite push web desde iOS 16.4 y solo si la página está instalada** en la
  pantalla de inicio ("Compartir → Agregar a inicio"). En Safari normal o en el navegador
  que abre WhatsApp, no hay notificaciones. El cliente tiene que instalarla a mano; Apple no
  deja mostrar un aviso automático de instalación.
- **El permiso se pide con un toque del cliente** (un botón "Activar notificaciones"), no al
  cargar la página.
- **Falta todo lo de PWA:** `manifest.webmanifest` (nombre, íconos, `display: standalone`),
  un service worker y las etiquetas `apple-touch-icon` / `apple-mobile-web-app-*` en
  `web/index.html`. Hoy no existe nada de eso.
- **Ojo con la sesión:** la app instalada tiene un almacenamiento distinto al de Safari, así
  que no hereda la sesión. Además, el `start_url` del manifest es fijo y pierde el token del
  link. Hay que decidir cómo entra la clienta la primera vez en la versión instalada
  (por ejemplo, un `start_url` por cliente o que vuelva a canjear el link al instalar).
- **Backend:** guardar la suscripción del cliente con FCM Web Push (VAPID). Como la página
  no escribe en Firestore, eso pasa por una Cloud Function nueva en `acciones.ts`. Luego
  hace falta una función programada (cron en Mazatlán) que decida a quién avisar.
- Android/Chrome sale casi gratis con lo mismo; el caso difícil es iOS.

Spec: `superpowers/specs/2026-10-08-notificaciones-web-pwa-design.md`. Alcance definido:
avisos escritos a mano por el entrenador desde la app ("ya llegamos", "ya nos fuimos",
"llegaremos más tarde" o texto libre), solo a clientas habilitadas por él y que además
dieron permiso en su teléfono.

Pendiente: revisar el spec y escribir el plan.

## 2. Recordatorio de pago en la web del cliente

> "quiero que, desde mi app móvil tenga un botón nuevo en el apartado de Web de cada cliente, ese botón debe de ser "recordatorios de pago" y solamente debe de ser si o no, por defecto será no, ese botón lo que hará es que el que lo tenga activado, de recibirá un nuevo card en su inicio de la app, está card solo se activará cuando falten dos días o menos para que se termine su periodo de pago, y solamente dirá, Tu periodo de entrenamiento vence en x días, estando de verde si está vigente o rojo si ya venció, pero este card deberá aparecer solamente a los que yo seleccione desde la app, crea el spec"

Resumen:

- **App:** interruptor "Recordatorios de pago" (sí/no, apagado por defecto) en el apartado
  **Web** de cada cliente. Se guarda como `recordatorioPago` en `clientes/{id}`.
- **Web:** tarjeta hasta arriba de **Inicio**, solo para quien tenga el interruptor prendido
  y fecha de próximo pago, cuando falten 2 días o menos o ya haya vencido.
- **Texto y color:** verde "vence en 2 días / en 1 día / hoy"; rojo "venció ayer / hace N
  días". Se queda en rojo hasta que se registre el pago.
- Sin cambios en `firestore.rules` ni en `functions/`.

Spec: `superpowers/specs/2026-10-07-recordatorio-pago-web-design.md`.

Pendiente: confirmar las dos decisiones abiertas del spec (el día del pago cuenta como
vigente; el texto cambia a "venció hace N días") y escribir el plan.

## 3. GIF para cada ejercicio

> "agrega también el agregar gifs para cada ejercicio al backlog"

Idea: que cada ejercicio tenga un GIF que muestre cómo se hace, visible en la rutina de la
web del cliente (y posiblemente en la app).

A decidir en el spec:

- **Dónde se asocia el GIF.** `Ejercicio` vive copiado dentro de cada rutina y plantilla, así
  que poner el GIF ahí obliga a repetirlo en cada copia. Lo natural es un catálogo por nombre
  normalizado (como `pesoPorEjercicio`, ver `domain/PesosPropios.kt`), para subirlo una vez y
  que aparezca en todas las rutinas.
- **De dónde salen los GIF:** subidos por el entrenador desde la app a Storage, o una
  biblioteca externa. Si son de terceros, revisar licencia (ver `docs/licencias/`).
- **Peso y formato:** un GIF pesa mucho para datos móviles; considerar MP4/WebM corto en
  bucle, que pesa varias veces menos y se ve igual.
- **Acceso:** reglas de Storage para que cualquier clienta con sesión pueda leerlos (no son
  datos personales), y guardar la ruta, no la URL de descarga, como con canciones y videos.

Pendiente: spec de diseño.

## 4. Mapa muscular: ventana con el cuerpo coloreado por nivel

> "agrega al backlog también el agregar una ventana nueva donde aparezca el esqueleto de un hombre o mujer dependiendo el caso y colorear cada músculo según su nivel de fuerza o desarrollo como en algunas apps de gimnasios que rankean músculos"

Idea: una ventana nueva en la web del cliente con una figura de cuerpo (hombre o mujer, de
frente y de espalda) donde cada grupo muscular se pinta según su nivel, al estilo de las
apps que "rankean" músculos.

A decidir en el spec:

- **Hombre o mujer:** `Cliente` no tiene ese dato hoy. Hace falta un campo nuevo que el
  entrenador asigne desde la app (opcional, por la regla de siempre de Firestore).
- **De dónde sale el nivel de cada músculo.** Es la decisión grande. Hoy solo hay
  `RecordPersonal.marca` (texto libre) y `pesoONota` (texto libre), así que no hay números
  confiables. Opciones: que el entrenador asigne el nivel a mano por músculo; o calcularlo de
  récords con peso numérico, relativo al peso corporal (`Cliente.peso`).
- **Qué ejercicio entrena qué músculo:** un catálogo ejercicio → músculos, por nombre
  normalizado. Puede ser el mismo catálogo del punto 3 (GIFs).
- **Escala:** cuántos niveles (por ejemplo, 5 de gris a color fuerte) y que se lea bien en
  todos los estilos de la web (neón, cómic, pixel, sakura, minimalista).
- **Dibujo:** SVG con un `path` por músculo, para pintarlo con CSS desde una función pura
  en `ui/` (testeable como las demás). Si las figuras son de terceros, revisar licencia.
- **Registro:** entrada nueva en `ventanas.ts`.

Pendiente: spec de diseño.

## 5. Que la web cargue más rápido al abrirla

> "agrega al backlog el hacer que la carga de la web no tarde tanto en cuanto abre"

Problema: la página del cliente tarda en mostrar algo útil al abrirla, sobre todo desde el
link de WhatsApp.

**Primer paso: medir antes de cambiar nada.** Abrirla desde el link de WhatsApp en un
teléfono real (iPhone y Android) y ver en qué se va el tiempo. Sin medición, cualquier
"optimización" es adivinar.

Sospechosos a revisar (sin confirmar):

- **Arranque en frío de la función `sesion`.** En el navegador que abre WhatsApp no
  sobrevive la sesión guardada, así que cada apertura vuelve a canjear el token llamando a
  `sesion` (`us-west1`, sin instancias mínimas). Si la función estaba dormida, eso puede
  sumar varios segundos. Opción: `minInstances: 1` (cuesta dinero al mes) o acortar lo que
  hace la función al arrancar.
- **Todo espera a la sesión.** Nada se pinta hasta que `iniciarSesion()` termina; se podría
  mostrar antes el esqueleto con lo que haya en caché.
- **Las cinco hojas de estilos alternativos** (pixel, neón, cómic, minimalista, sakura) se
  cargan siempre aunque la clienta use el clásico.
- **Tamaño del bundle:** Firebase completo (auth, firestore, functions, storage). Revisar
  qué pesa y cargar aparte lo que no se usa en Inicio (storage solo hace falta en Videos).
- **Los videos:** comprobar que pedir las URLs de descarga no retrase el primer pintado.

Relacionado con el punto 1 (PWA): una versión instalada con service worker abriría casi al
instante desde caché.

Pendiente: medir y luego escribir el spec.
