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
