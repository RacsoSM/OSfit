/*
 * Service worker de la página. Hace dos cosas:
 *
 * 1. Guarda la página en el teléfono para que abra sin internet (backlog 2, punto 11): el HTML,
 *    el JS y el CSS del build, los SVG del mapa y los íconos. Sin señal, Registro sigue
 *    funcionando y lo que se termine se manda después (`src/cola.ts`).
 * 2. Muestra los avisos del entrenador y abre la página al tocarlos.
 * 3. El modo sin datos de Ajustes (`src/sinDatos.ts`): con él puesto no deja salir ningún
 *    pedido a internet y contesta solo con lo guardado. Para que con el modo se vean los GIF
 *    de los ejercicios, las imágenes y las fuentes del estilo, esos se guardan al verlos con
 *    señal (`CACHE_MEDIOS`).
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
/**
 * Con señal pero muy lenta, o con Wi-Fi o datos prendidos sin internet (`src/senal.ts`), a los
 * 3 s se usa la página guardada en vez de seguir esperando. El HTML pesa unos pocos kB: con
 * internet de verdad llega mucho antes.
 */
const ESPERA_RED_MS = 3000;
/**
 * Los GIF e imágenes de Storage y las fuentes de Google, guardados al verlos. Los GIF pesan
 * ~40 kB, así que el banco entero cabe en unos 5 MB. Los videos (`.mp4`) no se guardan: pesan
 * más y el navegador los pide por pedazos.
 */
const CACHE_MEDIOS = "osfit-medios-v1";
/** GEMELOS de `CACHE_AJUSTES` y `MARCA_SIN_DATOS` en `src/sinDatos.ts`. */
const CACHE_AJUSTES = "osfit-ajustes";
const MARCA_SIN_DATOS = "/__modo-sin-datos";

/**
 * Si el modo sin datos está puesto; `null` mientras se lee. El service worker se apaga solo
 * cuando no lo usan y al volver a prender pierde lo que tenía en memoria, por eso la página
 * deja el modo en un caché y aquí se lee al arrancar. Con la página abierta, el cambio llega
 * además por mensaje, sin esperar a que se apague.
 */
let sinDatos = null;
const leyendoModo = caches
  .open(CACHE_AJUSTES)
  .then((cache) => cache.match(MARCA_SIN_DATOS))
  .then((marca) => { if (sinDatos === null) sinDatos = !!marca; })
  .catch(() => { if (sinDatos === null) sinDatos = false; });

self.addEventListener("message", (evento) => {
  if (evento.data && evento.data.tipo === "modo-sin-datos") sinDatos = !!evento.data.activo;
});

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
  if (sinDatos === true) {
    evento.respondWith(soloGuardado(evento.request));
    return;
  }
  // Recién prendido y sin saber todavía el modo: se toman todos los pedidos hasta saberlo.
  // Es solo el primer instante después de prender; lo normal es saberlo ya.
  if (sinDatos === null) {
    evento.respondWith(
      leyendoModo.then(() => (sinDatos ? soloGuardado(evento.request) : respuestaNormal(evento) || fetch(evento.request)))
    );
    return;
  }
  const respuesta = respuestaNormal(evento);
  if (respuesta) evento.respondWith(respuesta);
});

/**
 * La respuesta con señal, o `null` para dejar que el navegador vaya directo a la red, como si
 * no hubiera service worker.
 */
function respuestaNormal(evento) {
  const pedido = evento.request;
  if (pedido.method !== "GET") return null;
  const url = new URL(pedido.url);
  if (esMedio(url)) return medioGuardado(evento);
  // Del resto, solo lo de este sitio. Firebase va directo, como siempre.
  if (url.origin !== self.location.origin) return null;
  // `/version.json` siempre a la red y sin guardar: dice si hay un deploy más nuevo (`src/version.ts`).
  if (url.pathname === "/sw.js" || url.pathname === "/version.json" || url.pathname.startsWith("/__/")) return null;

  if (pedido.mode === "navigate") return paginaRedPrimero(evento);
  if (url.pathname.startsWith("/assets/")) return cachePrimero(pedido);
  return redPrimero(pedido);
}

/**
 * Con el modo sin datos: lo guardado o nada. `Response.error()` la página lo ve como un fallo
 * de red, que es lo que ya sabe manejar.
 */
async function soloGuardado(pedido) {
  if (pedido.method !== "GET") return Response.error();
  const url = new URL(pedido.url);
  const llave = pedido.mode === "navigate" && url.origin === self.location.origin ? PAGINA : pedido;
  // `ignoreVary`: lo guardado con un pedido que traía `Origin` (los `<script type="module">`)
  // no empataría con uno que no lo trae si el servidor contestó `Vary: Origin`.
  return (await caches.match(llave, { ignoreVary: true })) || Response.error();
}

/** Los archivos de Storage (menos los videos) y las fuentes de Google. */
function esMedio(url) {
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return true;
  // `alt=media` es el archivo; sin él es la consulta de metadatos de `getDownloadURL`.
  return url.hostname === "firebasestorage.googleapis.com" &&
    url.searchParams.get("alt") === "media" && !url.pathname.endsWith(".mp4");
}

/**
 * Lo guardado al instante y, por detrás, se refresca de la red para la próxima vez (casi
 * siempre lo contesta el caché HTTP del navegador sin gastar datos). Se pide con `cors`, no
 * como lo pide un `<img>`: así la respuesta se puede leer y guardar con su tamaño real (las
 * opacas cuentan como varios MB contra la cuota). Storage y Google Fonts mandan CORS abierto.
 */
async function medioGuardado(evento) {
  const pedido = evento.request;
  const cache = await caches.open(CACHE_MEDIOS);
  const guardado = await cache.match(pedido.url);
  // Sin copia guardada, "reload": el caché HTTP puede tener el GIF de antes de que el bucket
  // tuviera CORS, sin sus cabeceras, y con él el pedido CORS fallaba (ver `almacenDelNavegador`
  // en `src/sinDatos.ts`). Con copia, el refresco de fondo usa el caché HTTP para no gastar datos.
  const deRed = fetch(pedido.url, { mode: "cors", credentials: "omit", cache: guardado ? "default" : "reload" }).then((respuesta) => {
    if (respuesta.ok) return cache.put(pedido.url, respuesta.clone()).then(() => respuesta, () => respuesta);
    return respuesta;
  });
  if (guardado) {
    evento.waitUntil(deRed.catch(() => {}));
    return guardado;
  }
  // Si el pedido con CORS falla, el de siempre.
  return deRed.catch(() => fetch(pedido));
}

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
  // Qué abrir al tocarla (hoy, Resumen mensual en el mes que cerró). Viene como JSON porque
  // FCM solo manda strings; uno roto se ignora y la notificación abre la página como siempre.
  let abrir = null;
  try {
    abrir = typeof datos.abrir === "string" ? JSON.parse(datos.abrir) : null;
  } catch (e) {
    abrir = null;
  }
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: texto,
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      data: { abrir },
    })
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const abrir = (evento.notification.data && evento.notification.data.abrir) || null;
  const ventana = abrir && typeof abrir.ventana === "string" ? abrir.ventana : null;
  const mes = abrir && typeof abrir.mes === "string" ? abrir.mes : null;
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const v of ventanas) {
        if ("focus" in v) {
          // La página ya abierta abre la ventana ella misma (`abrirDesdeAviso.ts` en `main.ts`).
          if (ventana) v.postMessage({ tipo: "abrir", abrir: { ventana, mes } });
          return v.focus();
        }
      }
      // Sin ventana abierta se abre la raíz: la página instalada guarda su propia sesión y
      // el token recordado, así que la escalera de `resolverSesion` la deja entrar. El `?abrir`
      // no lo ve `resolverSesion` (lee la ruta y el `#`); lo usa `main.ts` y lo borra.
      if (!ventana) return self.clients.openWindow("/");
      const params = new URLSearchParams({ abrir: ventana });
      if (mes) params.set("mes", mes);
      return self.clients.openWindow(`/?${params.toString()}`);
    })()
  );
});
