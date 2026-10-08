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

Pendiente: spec de diseño.

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

Spec: `superpowers/specs/2026-10-07-recordatorio-pago-web-design.md` (por ahora en la rama
`ccr-d1c56144-kzwcds`, todavía no en `main`).

Pendiente: confirmar las dos decisiones abiertas del spec (el día del pago cuenta como
vigente; el texto cambia a "venció hace N días") y escribir el plan.
