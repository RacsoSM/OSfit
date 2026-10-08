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
