/*
 * Service worker de la página. Hace dos cosas:
 *
 * 1. Guarda la página en el teléfono para que abra sin internet (backlog 2, punto 11): el HTML,
 *    el JS y el CSS del build, los SVG del mapa y los íconos. Sin señal, Registro sigue
 *    funcionando y lo que se termine se manda después (`src/cola.ts`).
 * 2. Muestra los avisos del entrenador y abre la página al tocarlos.
 *
 * Cómo no se queda con una versión vieja: el HTML va **red primero**. Con señal siempre llega
 * el del último deploy (hosting lo sirve con `no-cache`), y solo sin señal se usa el guardado.
 * Los archivos de `/assets/` llevan el hash en el nombre, así que uno nuevo nunca pisa a uno
 * viejo: esos van **caché primero**. Al llegar un HTML nuevo se guardan sus archivos y se
 * borran los que ya nadie pide.
 *
 * Los avisos llegan solo con datos (`titulo`, `texto`) y aquí se arma la notificación. En
 * iOS es obligatorio mostrar una notificación por cada push: si llega uno y no se muestra
 * nada, Safari le quita la suscripción a la página.
 */
const CACHE = "osfit-pagina-v1";
/** Todas las rutas sirven el mismo `index.html` (rewrite de hosting): se guarda una vez. */
const PAGINA = "/";
/** Con señal pero muy lenta, a los 5 s se usa la página guardada en vez de seguir esperando. */
const ESPERA_RED_MS = 5000;

self.addEventListener("install", (evento) => {
  self.skipWaiting();
  // Que falle no impide instalar: la página se guarda en la siguiente visita con señal.
  evento.waitUntil(guardarPagina().catch(() => {}));
});

self.addEventListener("activate", (evento) =>
  evento.waitUntil(
    (async () => {
      for (const nombre of await caches.keys()) {
        if (nombre.startsWith("osfit-pagina-") && nombre !== CACHE) await caches.delete(nombre);
      }
      await self.clients.claim();
    })()
  )
);

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  // Solo lo de este sitio. Firebase, Storage y las fuentes van directo, como siempre.
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/__/")) return;

  if (pedido.mode === "navigate") {
    evento.respondWith(paginaRedPrimero(evento));
  } else if (url.pathname.startsWith("/assets/")) {
    evento.respondWith(cachePrimero(pedido));
  } else {
    evento.respondWith(redPrimero(pedido));
  }
});

/** El HTML: el de la red si llega a tiempo; si no, el guardado. */
async function paginaRedPrimero(evento) {
  // La copia se saca antes de que la página lea la respuesta: después ya no se puede.
  let copia = null;
  const deRed = fetch(evento.request).then((respuesta) => {
    if (respuesta.ok) copia = respuesta.clone();
    return respuesta;
  });
  // Guardar los archivos de esta versión no detiene la respuesta, y sigue aunque la página
  // ya haya abierto con la guardada por tardar de más.
  evento.waitUntil(
    deRed.then(() => copia && copia.text()).then((html) => html && guardarVersion(html)).catch(() => {})
  );
  const guardada = caches.match(PAGINA, { cacheName: CACHE });
  try {
    return await conPlazo(deRed, ESPERA_RED_MS);
  } catch {
    // Sin señal (o tardó de más). Si tampoco hay nada guardado, se espera a la red.
    return (await guardada) ?? deRed;
  }
}

async function cachePrimero(pedido) {
  const guardado = await caches.match(pedido, { cacheName: CACHE });
  if (guardado) return guardado;
  const respuesta = await fetch(pedido);
  if (respuesta.ok) (await caches.open(CACHE)).put(pedido, respuesta.clone());
  return respuesta;
}

async function redPrimero(pedido) {
  try {
    const respuesta = await fetch(pedido);
    if (respuesta.ok) (await caches.open(CACHE)).put(pedido, respuesta.clone());
    return respuesta;
  } catch (error) {
    const guardado = await caches.match(pedido, { cacheName: CACHE });
    if (guardado) return guardado;
    throw error;
  }
}

function conPlazo(promesa, ms) {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error("plazo")), ms);
    promesa.then(
      (v) => { clearTimeout(reloj); resolver(v); },
      (e) => { clearTimeout(reloj); rechazar(e); }
    );
  });
}

/** Lo que se guarda al instalar: la página de hoy, sus archivos, el mapa y los íconos. */
async function guardarPagina() {
  const respuesta = await fetch(PAGINA, { cache: "no-store" });
  if (!respuesta.ok) return;
  await guardarVersion(await respuesta.text());
  const cache = await caches.open(CACHE);
  await Promise.all(
    [
      "/manifest.webmanifest",
      "/icono-180.png",
      "/icono-192.png",
      "/mapa-muscular-frente.svg",
      "/mapa-muscular-espalda.svg",
      "/mapa-muscular-frente-mujer.svg",
      "/mapa-muscular-espalda-mujer.svg",
    ].map((ruta) => cache.add(ruta).catch(() => {}))
  );
}

/**
 * Guarda el HTML y los archivos de `/assets/` de una versión: los que nombra el HTML y los que
 * el JS carga después (Vite los nombra como `"./index.esm-….js"`). Después borra los de
 * versiones anteriores.
 */
async function guardarVersion(html) {
  const cache = await caches.open(CACHE);
  await cache.put(PAGINA, new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
  const archivos = new Set(html.match(/\/assets\/[\w.-]+\.(?:js|css)/g) ?? []);
  for (const ruta of [...archivos]) {
    let respuesta = await cache.match(ruta);
    if (!respuesta) {
      respuesta = await fetch(ruta);
      if (!respuesta.ok) continue;
      await cache.put(ruta, respuesta.clone());
    }
    if (ruta.endsWith(".js")) {
      const js = await respuesta.text();
      for (const [, nombre] of js.matchAll(/["'`]\.\/([\w.-]+\.(?:js|css))["'`]/g)) {
        archivos.add(`/assets/${nombre}`);
      }
    }
  }
  for (const ruta of archivos) {
    if (!(await cache.match(ruta))) await cache.add(ruta).catch(() => {});
  }
  for (const pedido of await cache.keys()) {
    const ruta = new URL(pedido.url).pathname;
    if (ruta.startsWith("/assets/") && !archivos.has(ruta)) await cache.delete(pedido);
  }
}

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
