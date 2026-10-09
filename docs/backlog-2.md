# Backlog 2

A diferencia de `docs/backlog.md`, este archivo **sí está versionado**. Por eso aquí no van
nombres de clientes reales: si una entrada necesita nombrar a alguien, va en `backlog.md`.

Misma convención que el otro backlog: las entradas se marcan (`— ✅ HECHO (fecha)`), no se
borran.

## 1. Notificaciones en iPhone: convertir la web en PWA — ✅ HECHO (2026-10-08)

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

Plan: `superpowers/plans/2026-10-08-notificaciones-web-pwa.md`. La Task 1 es la puerta:
instalar en un iPhone real desde `/c/<token>` y comprobar que entra sin candado.

Estado (2026-10-08):

- Código de las Tasks 1–11 escrito, con los tests de `functions/`, `web/` y la app en verde.
  La clave VAPID y la región del trigger (Firestore en `nam5` → `us-central1`) ya están puestas.
- **Desplegado:** web (hosting), reglas de Firestore, `registrarDispositivo` (`us-west1`) y
  `enviarNotificacion` (`us-central1`). Para el trigger hubo que dar a mano tres roles a cuentas
  internas de Google: Creador de tokens de cuenta de servicio a
  `service-754891137796@gcp-sa-pubsub…`, e Invocador de Cloud Run y Receptor de eventos de
  Eventarc a `754891137796-compute@…`.
- **App con Avisos instalada** en el teléfono del entrenador.
- **Verificado en iPhone (2026-10-08):** una clienta instaló la página desde su link en
  Safari, la abrió desde el ícono y entró a su página sin candado, también al cerrarla y
  volver a abrirla. Era la puerta del plan (Task 1, Step 8). Modelo y versión de iOS sin
  anotar.
- **Verificado de punta a punta (2026-10-08):** un aviso mandado desde Avisos en la app le
  llegó como notificación al iPhone de la clienta.

El entrenador dio el punto por terminado. La lista de abajo era el orden de verificación; lo
que no está marcado arriba como verificado queda como comprobación pendiente:

1. **La puerta (Task 1, Step 8):** en un iPhone, abrir el link `/c/<token>` de una clienta de
   prueba en Safari → Compartir → Agregar a inicio → cerrar Safari → abrir desde el ícono.
   Tiene que entrar sin candado; cerrar, esperar un minuto y volver a abrir. Si abre en el
   candado, se para todo y se revisa la sesión antes de seguir.
2. **Un aviso de punta a punta (Task 12, Step 3):** prender "Notificaciones" en el apartado Web
   de la clienta → en el iPhone, "Activar notificaciones" y aceptar el permiso → la app dice
   "Activadas en 1 teléfono" → mandar "Ya llegamos" desde Avisos → llega con la página cerrada
   y la pantalla bloqueada, y el historial dice "Llegó a 1 teléfono".
3. **Que la llave del entrenador manda:** apagar el interruptor de esa clienta → mandar otro
   aviso → no le llega. Mandar `<b>hola</b>` → llega como texto, sin negritas.
4. **Android/Chrome (Task 12, Step 4):** abrir el link en Chrome → Ajustes → botón directo, sin
   pasos de instalación → activar → mandar un aviso → llega.
5. **Cerrar:** anotar en el plan qué se verificó y en qué modelos y versiones, y marcar este
   punto como hecho.

Cabos sueltos que salieron al desplegar:

- **`guardarEstilo`** está desplegada en Firebase (`us-west1`) pero no existe en el repo ni en
  su historial. Averiguar de dónde salió. Mientras tanto, desplegar funciones siempre por
  nombre (`--only functions:<nombre>`): un `--only functions` a secas intentaría borrarla.
- **Limpieza de imágenes en `us-central1`:** Firebase no pudo configurar la política que borra
  las imágenes viejas de las funciones. No afecta el funcionamiento; sin ella se acumulan unos
  centavos de almacenamiento al mes. Se arregla con `firebase functions:artifacts:setpolicy`.
- ~~Ícono provisional~~ — ✅ HECHO (2026-10-08): logo del entrenador (silueta blanca sobre
  `#7B1E3A`). iOS guarda el ícono al instalar y no lo actualiza: quien ya la instaló con el
  provisional tiene que borrarla, volver a agregarla desde su link y reactivar las
  notificaciones.

## 2. Recordatorio de pago en la web del cliente — ✅ HECHO (2026-10-08)

> "quiero que, desde mi app móvil tenga un botón nuevo en el apartado de Web de cada cliente, ese botón debe de ser "recordatorios de pago" y solamente debe de ser si o no, por defecto será no, ese botón lo que hará es que el que lo tenga activado, de recibirá un nuevo card en su inicio de la app, está card solo se activará cuando falten dos días o menos para que se termine su periodo de pago, y solamente dirá, Tu periodo de entrenamiento vence en x días, estando de verde si está vigente o rojo si ya venció, pero este card deberá aparecer solamente a los que yo seleccione desde la app, crea el spec"

Resumen:

- **App:** interruptor "Recordatorios de pago" (sí/no, apagado por defecto) en el apartado
  **Web** de cada cliente. Se guarda como `recordatorioPago` en `clientes/{id}`.
- **Web:** tarjeta hasta arriba de **Inicio**, solo para quien tenga el interruptor prendido
  y fecha de próximo pago, cuando falten 2 días o menos o ya haya vencido.
- **Texto y color:** verde "vence en 2 días / en 1 día / hoy"; rojo "venció hace N días"
  (singular con 1). Se queda en rojo hasta que se registre el pago.
- Sin cambios en `firestore.rules` ni en `functions/`.

Spec: `superpowers/specs/2026-10-07-recordatorio-pago-web-design.md`.

Decisiones confirmadas (2026-10-08): el día del pago va en verde ("vence hoy"); ya vencido
dice "Tu periodo de entrenamiento venció hace X días".

Plan: `superpowers/plans/2026-10-08-recordatorio-pago-web.md`. Implementado (web con tests;
app sin compilar todavía: la sesión donde se hizo no tenía Android SDK).

Verificado por el entrenador (2026-10-08).

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

**Referencia visual (2026-10-09).** El entrenador compartió una imagen libre de uso como
referencia "casi exacta" del estilo buscado: `docs/mapa-muscular/referencia.png`.

Dibujo calcado de esa imagen: `web/public/mapa-muscular-frente.svg` (hombre de frente). Se
genera con los scripts de `docs/mapa-muscular/` (ver su README). Cada músculo es un `path` con
`id` (`musculo-pecho-der`, `musculo-abdomen`…) y `data-musculo`, para pintarlo por nivel desde
CSS; las líneas internas y el contorno van aparte y no cambian de color.

- En la imagen el color identifica el grupo (hombro verde, pecho rojo, bíceps azul claro,
  antebrazo morado, abdomen amarillo, pierna azul, pantorrilla roja). En OSfit el color debe
  salir del **nivel**: el spec tiene que decidir si se respeta esa paleta o si solo se toma
  el dibujo y la escala la pone el nivel. El SVG trae la paleta de la foto como valor por
  defecto.
- Versión de mujer (2026-10-09): `web/public/mapa-muscular-frente-mujer.svg`, calcada de otra
  referencia del entrenador con los scripts de `docs/mapa-muscular/mujer/`. Mismos ids que el
  del hombre, salvo que no tiene trapecio (en esa referencia esa zona es gris).
- Vista de espalda del hombre (2026-10-09): `web/public/mapa-muscular-espalda.svg`, calcada de
  otra referencia con los scripts de `docs/mapa-muscular/espalda/`. Misma escala que la de
  frente. Músculos nuevos: trapecio, infraespinoso, tríceps, dorsal, lumbar, glúteo e
  isquiotibiales; los que también salen de frente (hombro, antebrazo, cuádriceps, pantorrilla)
  usan el mismo id, así que un nivel pinta las dos vistas.
- Falta la vista de espalda de la mujer.

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

## 6. Revocar el enlace de un cliente de verdad

> "agrega al backlog el revocar el enlace de un cliente"

**Lo que ya existe:** la ficha del cliente tiene "Revocar acceso"
(`ClienteDetailScreen` → `AccesoWebRepository.revocarAcceso`). Borra el documento de
`accesosWeb` y apaga `tieneAccesoWeb`. Desde ese momento el link ya no se puede canjear, y
"Volver a compartir" genera uno nuevo.

**Lo que falta (sin verificar en dispositivo; sale de leer el código):**

- **Las sesiones ya abiertas siguen vivas.** Revocar solo impide canjear el link otra vez. Un
  teléfono que ya había entrado conserva su sesión de Firebase: el SDK la renueva sola cada
  hora, el claim `clienteId` sigue dentro, y las reglas (`esCliente`) solo miran ese claim.
  O sea que quien ya tenía la página abierta o guardada puede seguir viéndola indefinidamente.
- **Sin confirmación.** El botón revoca al primer toque; un toque accidental obliga a mandarle
  un link nuevo al cliente.
- **No dice a quién afecta.** No se ve cuándo fue el último acceso antes de revocar
  (`AccesoWeb.ultimoAcceso` ya existe y se podría mostrar).

Idea para cerrar la sesión de verdad (a decidir en el spec):

- Al borrar el acceso, un trigger (`onDocumentDeleted("accesosWeb/{token}")`) llama a
  `getAuth().revokeRefreshTokens(clienteId)`: la sesión deja de poder renovarse.
- Eso no corta el token que ya tiene en la mano, que dura hasta una hora. Para cortarlo al
  instante, guardar `accesoRevocadoEn` en `clientes/{id}` y que `esCliente` exija
  `request.auth.token.auth_time` posterior a esa fecha. Un link nuevo canjeado después sí
  pasa. Es un cambio en `firestore.rules` y `storage.rules`: leerlas completas antes.
- La web debería mostrar el candado ("Tu acceso ya no está activo") en vez de errores de
  permisos, y olvidar el token recordado.
- Si ya existe el punto 1 (notificaciones), borrar también sus `dispositivos` para que no le
  sigan llegando avisos.

Pendiente: spec de diseño.
