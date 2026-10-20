import {
  alFallarDatos,
  alPerderAcceso,
  alVolverDatos,
  observarCliente,
  observarAsistencias,
  observarAvisoFalta,
  observarMedallas,
  observarLogrosPersonales,
  observarVideos,
  observarTirada,
  observarBanco,
  observarSesiones,
  observarConfigGrupos,
  observarHistorial,
} from "./datos";
import type {
  Cliente,
  Asistencia,
  MedallaOtorgada,
  LogroPersonalOtorgado,
  VideoResumen,
  EjercicioBanco,
  Sesion,
  ConfigGrupos,
} from "./datos";
import { hoyEnMazatlan } from "./fecha";
import { mesAnterior, type Tirada } from "./tirada";
import {
  borrarSesion, compararMusculos, editarSesion, elegirMostrarEnAmigos, guardarPeso, marcarAsistencia, obtenerRanking, registrarEntrada, registrarSesion,
} from "./acciones";
import { modalRuleta, conectarRuleta } from "./ui/ruleta";
import { conectarRanking, type EstadoRanking } from "./ui/tarjetaRanking";
import { conectarAjustes } from "./ui/tarjetaAjustes";
import { estadoNotificaciones, plataforma } from "./notificaciones";
import { activarNotificaciones, entornoDelNavegador, sincronizarToken } from "./notificacionesNavegador";
import { conectarNotificaciones } from "./ui/tarjetaNotificaciones";
import { conectarAvisoReviveExtra } from "./ui/avisoReviveExtra";
import { almacenDeEstilo, ponerEstilo } from "./ui/cambioDeEstilo";
import { estiloGuardado, type IdEstilo } from "./estilo";
import { cerrarSesion, credencialLista, huellaDeLaSesion, iniciarSesion, redDeFirestore, urlDeDescarga } from "./firebase";
import {
  alBloquear, almacenDelNavegador, conexionDelNavegador, esWifi, guardarFaltantes, guardarModoSinDatos, modoSinDatos,
  sugerirApagar,
} from "./sinDatos";
import { conectarSinDatos } from "./ui/tarjetaSinDatos";
import { conectarEstadisticas } from "./ui/estadisticas";
import { mostrarAvisoSinDatos, quitarAvisoSinDatos } from "./ui/avisoSinDatos";
import { almacenesDelNavegador, saludDeLosAlmacenes } from "./sesion";
import type { MotivoSinAcceso, ResultadoSesion } from "./sesion";
import { aplicarPaleta } from "./paleta";
import { almacenCola, encolar, enviarPendientes, pendientesDe } from "./cola";
import type { Envio } from "./registro";
import { indiceBanco, urlGif, type IndiceBanco } from "./banco";
import { saludo, conectarSaludo, actualizarNombre } from "./ui/saludo";
import { conectarAccionDia } from "./ui/accionDia";
import { conectarAccionFalta } from "./ui/accionFalta";
import { moverMes } from "./ui/calendario";
import { tarjetaVideos, ultimosRangoDescendente, firmaVideos, MAXIMO_VIDEOS } from "./ui/tarjetaVideos";
import {
  BARRA, VENTANAS, contenidoDe, datosRegistro, fuerzaDelCliente, tituloCabecera, ventana, type IdVentana,
} from "./ventanas";
import {
  cabeceraRegistro, cerrarSiVencido, conectarRegistro, empezarGuiado, entrenamientoAbierto, vistaDesdeHistorial,
} from "./ui/registro";
import { barraInferior, conectarBarra, marcarSexoBarra } from "./ui/barraInferior";
import { archivosMapa, conectarMapa, type EstadoSvg } from "./ui/mapaMuscular";
import { conectarPeso } from "./ui/pesoCorporal";
import { conectarDeslizarMenu } from "./ui/deslizarMenu";
import {
  abrirMenu, abrirVentana, alRetrocederSub, cerrarMenu, historialDelNavegador, iniciarNavegacion, irSub, marcarSub,
  menuAbierto,
  ventanaActiva, ventanaDeBarra,
} from "./navegacion";
import {
  conectarComparar, reiniciarComparar, sexosAComparar, type EstadoComparar,
} from "./ui/comparar";
import { marcarBotonAtras } from "./ui/botonAtras";
import { mostrarAvisoVersion } from "./ui/avisoVersion";
import { vigilarVersion } from "./version";
import {
  actualizarCabecera, aplicarMenuAbierto, cabecera, conectarCabecera, conectarMenu,
  marcarSinDatos, marcarVentanaActiva, panelMenu,
} from "./ui/menuLateral";
import type { VideoConUrl } from "./ui/tarjetaVideos";
import { iniciarCronometros } from "./ui/cronometro";

const app = document.querySelector<HTMLElement>("#app")!;

/**
 * El estilo se pone antes que nada, incluso antes de la sesión: así el candado y la pantalla
 * de sin conexión también salen en el estilo que eligió. El atributo ya lo puso el script de
 * `index.html`; esto agrega lo que el CSS del estilo necesita (fuentes, paisaje).
 */
let estilo: IdEstilo = estiloGuardado(almacenDeEstilo());
ponerEstilo(estilo);

/**
 * De qué bundle salió esta pantalla.
 *
 * Va junto al motivo porque sin esto no se puede saber si un reporte viene del código de
 * hoy o de uno que el navegador tenía guardado: hosting servía el `index.html` con una hora
 * de caché, así que un teléfono podía seguir corriendo el bundle viejo mucho después del
 * deploy y el candado se veía idéntico. El nombre del archivo lleva el hash del build.
 */
function versionDelBundle(): string {
  const src = document.querySelector<HTMLScriptElement>('script[src*="/assets/"]')?.src ?? "";
  return src.split("/").pop()?.replace(/^index-|\.js$/g, "") ?? "?";
}

/**
 * El candado, con una línea que dice cuál de los tres escalones falló.
 *
 * La clienta no necesita el código, pero el entrenador sí cuando ella le manda la captura:
 * `sin-rastro` en una recarga significa que se perdieron sesión y token a la vez —el
 * callejón que ya arreglamos, y que no debería reaparecer—, mientras que
 * `recordado-rechazado` o `link-rechazado` son un acceso de verdad revocado. Antes los tres
 * se veían igual y la única forma de distinguirlos era adivinando.
 */
function mostrarEnlaceInvalido(motivo?: MotivoSinAcceso): void {
  // `sin-rastro` no es un link muerto: es haber llegado sin él. Pasa al abrir el navegador
  // de cero y entrar al sitio sin tocar el link —ahí no hay nada que diga quién es ella— y
  // mandarla a pedir uno nuevo sería mentirle, porque el suyo sigue vivo. Lo único que
  // necesita es volver a abrirlo.
  const perdida = motivo === "sin-rastro";
  // Revocado con la página abierta: lo decidió el entrenador, y se dice tal cual.
  const revocado = motivo === "revocado";
  app.innerHTML = `
    <div class="tarjeta vacio">
      <div class="vacio-emoji">${perdida ? "🔗" : "🔒"}</div>
      <p>${
        perdida
          ? "Abre tu link otra vez."
          : revocado
            ? "Tu acceso ya no está activo."
            : "Este enlace ya no es válido."
      }</p>
      <p style="color: var(--texto-tenue); font-size: 14px">
        ${
          perdida
            ? "Búscalo en tu chat de WhatsApp con tu entrenador: el mismo de siempre sirve."
            : revocado
              ? "Pídele a tu entrenador un link nuevo."
              : "Pídele a tu entrenador que te comparta uno nuevo."
        }
      </p>
      <p style="color: var(--texto-tenue); font-size: 11px; opacity: 0.7">
        ${motivo ?? "desconocido"} · ${versionDelBundle()} · ${saludDeLosAlmacenes(almacenesDelNavegador())} · h${history.state ? "+" : "-"}f${location.hash ? "+" : "-"}
      </p>
    </div>`;
}

/**
 * La red, que no es lo mismo que un link muerto.
 *
 * Antes las dos cosas caían en la pantalla del candado, y el precio lo pagaba la clienta:
 * un bache de señal la mandaba a pedirle al entrenador un link nuevo que no necesitaba,
 * cuando lo único que hacía falta era volver a intentar. De ahí el botón: el reintento
 * está acá y no en su chat de WhatsApp.
 */
function mostrarSinConexion(): void {
  app.innerHTML = `
    <div class="tarjeta vacio">
      <div class="vacio-emoji">📡</div>
      <p>No pudimos conectarte.</p>
      <p style="color: var(--texto-tenue); font-size: 14px">
        Revisa tu conexión e inténtalo de nuevo. Tu enlace sigue sirviendo.
      </p>
      <button class="boton" id="reintentar">Reintentar</button>
    </div>`;
  const boton = document.querySelector<HTMLButtonElement>("#reintentar");
  boton?.addEventListener("click", () => {
    // Se deshabilita en vez de repintar la pantalla entera: así el toque se siente
    // atendido sin que la página parpadee, y no se pueden encimar dos arranques.
    boton.disabled = true;
    boton.textContent = "Conectando…";
    arrancar();
  });
}

async function arrancar(): Promise<void> {
  let sesion: ResultadoSesion;
  try {
    sesion = await iniciarSesion();
  } catch {
    // `iniciarSesion` devuelve sus fallas como estado, así que llegar acá es una falla que
    // no previmos. Se trata como red: deja reintentar, que es lo peor que puede pasar, en
    // vez de mandarla a pedir un link que a lo mejor no tiene nada malo.
    mostrarSinConexion();
    return;
  }
  if (sesion.estado === "sin-acceso") {
    mostrarEnlaceInvalido(sesion.motivo);
    return;
  }
  if (sesion.estado === "sin-conexion") {
    mostrarSinConexion();
    return;
  }
  const clienteId = sesion.clienteId;
  // Después de la sesión, no antes: limpia `history.state`, y la pantalla del candado lo lee
  // para su diagnóstico.
  iniciarNavegacion(historialDelNavegador(), () => pintar());
  // "Atrás" también recorre las pantallas de Registro: al llegar a una, Registro se pone en ella.
  alRetrocederSub((v, s) => { if (v === "registro") vistaDesdeHistorial(s); });
  const hoy = hoyEnMazatlan();

  let cliente: Cliente | null = null;
  let asistencias: Asistencia[] = [];
  let mesVisible = hoy.slice(0, 7);
  let yaAviso = false;
  let medallas: MedallaOtorgada[] = [];
  let logros: LogroPersonalOtorgado[] = [];
  let videos: VideoConUrl[] = [];
  let tiradaEsteMes: Tirada | null = null;
  let tiradaMesAnterior: Tirada | null = null;
  let ranking: EstadoRanking = { estado: "cargando" };
  /** Número del último pedido: una respuesta de un pedido viejo no pisa a la más nueva. */
  let pedidoRanking = 0;
  /** Lo de Amigos; se pide cada vez que se entra, como el ranking. */
  let comparacion: EstadoComparar = { estado: "cargando" };
  let pedidoComparar = 0;
  /** Los SVG del mapa muscular ya pedidos, por archivo. Viven lo que dura la página. */
  const mapas: Record<string, EstadoSvg> = {};
  /** El banco de ejercicios, y por nombre y alias normalizados; vacíos hasta que llega. */
  let banco: EjercicioBanco[] = [];
  let indice: IndiceBanco = new Map();
  /** Sus sesiones de Registro; null hasta que llegan. */
  let sesiones: Sesion[] | null = null;
  /**
   * Todo su historial, para Estadísticas. Se pide la primera vez que entra a esa ventana y
   * sigue escuchando: las demás pantallas abren con las últimas 60 (`sesiones`).
   */
  let historial: Sesion[] | null = null;
  let historialPedido = false;
  /** Los ejercicios por grupo del grid de Registro; null si el entrenador no configura ninguno. */
  let configGrupos: ConfigGrupos | null = null;
  /** Los entrenamientos que se terminaron sin internet, en el teléfono (`cola.ts`). */
  const cola = almacenCola((() => { try { return localStorage; } catch { return null; } })());
  let pendientes = pendientesDe(cola.leer(), clienteId).length;
  let enviandoCola = false;
  let otraVuelta = false;

  /**
   * Manda los entrenamientos que esperan internet. Se llama al abrir, al volver la señal y
   * cada minuto mientras quede alguno: en iOS el evento `online` no siempre llega.
   */
  function enviarCola(): void {
    // Con el modo sin datos esperan a que lo apague (`cambiarSinDatos` la vuelve a llamar).
    if (pendientes === 0 || modoSinDatos()) return;
    // Uno que entra a la cola mientras se manda otra tanda se manda al terminar esa, no un
    // minuto después: es el que la clienta acaba de terminar.
    if (enviandoCola) { otraVuelta = true; return; }
    enviandoCola = true;
    otraVuelta = false;
    enviarPendientes(cola, clienteId, (envio) => registrarSesion(envio))
      .then((quedan) => {
        const cambio = quedan !== pendientes;
        pendientes = quedan;
        if (cambio) pintar();
      })
      .finally(() => {
        enviandoCola = false;
        if (otraVuelta) enviarCola();
      });
  }

  /** Guarda en la cola del teléfono un entrenamiento terminado, para mandarlo (`cola.ts`). */
  function encolarEnvio(envio: Envio): void {
    cola.guardar(encolar(cola.leer(), { clienteId, envio }));
    pendientes = pendientesDe(cola.leer(), clienteId).length;
  }

  /**
   * Un entrenamiento abierto más de 3 horas se cierra solo (`cerrarSiVencido`). Vive solo en el
   * teléfono, así que se revisa al abrir, al volver a la página y cada minuto.
   */
  function revisarCierreAutomatico(): void {
    if (cerrarSiVencido({ encolar: encolarEnvio, enviarAhora: enviarCola })) pintar();
  }

  /** Para saber si hay Wi-Fi; null en los navegadores que no lo dicen (Safari, iPhone). */
  const conexion = conexionDelNavegador();
  /** Dijo "Ahora no" a apagar el modo en este Wi-Fi. Se olvida al salir del Wi-Fi. */
  let wifiDescartado = false;
  /** Los últimos videos que llegaron, para pedir sus URL al apagar el modo sin datos. */
  let videosCrudos: VideoResumen[] = [];

  /** Mientras se bajan los GIF al prender el modo sin datos: el avance que ve en Ajustes. */
  let guardandoGifs: { hechos: number; total: number } | null = null;
  let avisoGifs: string | null = null;

  /** Prende o apaga el modo sin datos (`sinDatos.ts`), desde Ajustes o desde la franja. */
  async function cambiarSinDatos(activo: boolean): Promise<void> {
    if (activo) {
      if (guardandoGifs) return;
      // Antes de cortar la red, los GIF del banco que falten (entrenador, 2026-10-20): sin datos
      // solo se ve lo guardado, y el service worker solo guarda los que se mostraron.
      const urls = banco.flatMap((b) => urlGif(b.gifRuta) ?? []);
      guardandoGifs = { hechos: 0, total: 0 };
      pintar();
      const { fallidos } = await guardarFaltantes(urls, almacenDelNavegador(), (hechos, total) => {
        guardandoGifs = { hechos, total };
        pintar();
      });
      guardandoGifs = null;
      avisoGifs = fallidos === 0 ? null
        : `${fallidos === 1 ? "1 ejercicio no se pudo guardar" : `${fallidos} ejercicios no se pudieron guardar`}: sin datos se verán sin imagen. Desactívalo y actívalo con internet para reintentar.`;
    }
    await guardarModoSinDatos(activo);
    wifiDescartado = false;
    quitarAvisoSinDatos();
    pintar();
    if (activo) {
      await redDeFirestore(false).catch(() => {});
      return;
    }
    // El token pudo vencer mientras tanto (duran una hora): primero la credencial, luego la
    // red, igual que al arrancar.
    await credencialLista().catch(() => {});
    await redDeFirestore(true).catch(() => {});
    enviarCola();
    resolverVideos(videosCrudos);
  }

  /**
   * Con el modo puesto y el teléfono en Wi-Fi, ofrece apagarlo. Si dice "Ahora no", no
   * insiste hasta que vuelva a entrar a un Wi-Fi.
   */
  function revisarWifi(): void {
    if (!esWifi(conexion?.type)) {
      wifiDescartado = false;
      return;
    }
    if (!sugerirApagar(modoSinDatos(), conexion?.type, wifiDescartado)) return;
    mostrarAvisoSinDatos(
      "📶 Estás en Wi-Fi. ¿Desactivar el modo sin datos?",
      () => { cambiarSinDatos(false); },
      () => { wifiDescartado = true; }
    );
  }

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

  /** Llave en el navegador para el aviso del revive extra. Igual que la invitación: si se pierde, sale otra vez. */
  // La versión sube con cada cambio del aviso (ver `avisoReviveExtra.ts`): v2 anunció la llama
  // azul, v3 lo llamó "comodín para revivir la racha", v4 lo volvió ventana emergente.
  const LLAVE_REVIVE_EXTRA = "osfit:revive-extra-visto-v4";
  let reviveExtraVisto = (() => {
    try { return localStorage.getItem(LLAVE_REVIVE_EXTRA) === "1"; } catch { return false; }
  })();

  function alCerrarReviveExtra(): void {
    reviveExtraVisto = true;
    try { localStorage.setItem(LLAVE_REVIVE_EXTRA, "1"); } catch { /* se pierde el recuerdo, no la página */ }
    pintar();
  }

  function alDescartarInvitacion(): void {
    invitacionDescartada = true;
    try { localStorage.setItem(LLAVE_INVITACION, "1"); } catch { /* se pierde el recuerdo, no la página */ }
    pintar();
  }

  /**
   * Pide los dos mapas que le tocan, solo la primera vez: una vez listos se quedan en `mapas`
   * y los repintados ya no van a la red. Si falla, se reintenta solo al volver a entrar
   * (`reintentar`): reintentar en cada repintado sería un ciclo, porque el fallo repinta.
   */
  /** Los mapas de su sexo; en Amigos, también los del sexo de con quién se compara. */
  function cargarMapas(reintentar: boolean, sexos?: readonly ("H" | "M")[]): void {
    const sexo = cliente?.sexo;
    const todos = sexos ?? (sexo === "H" || sexo === "M" ? [sexo] : []);
    for (const archivo of todos.flatMap((s) => Object.values(archivosMapa(s)))) {
      const e = mapas[archivo];
      if (e && (e.estado !== "error" || !reintentar)) continue;
      mapas[archivo] = { estado: "cargando" };
      fetch(archivo)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then(
          (svg) => { mapas[archivo] = { estado: "listo", svg }; },
          () => { mapas[archivo] = { estado: "error" }; }
        )
        .finally(() => pintar());
    }
  }

  /**
   * Pide el ranking cada vez que se entra a la ventana: no hay listener que lo mantenga al día,
   * así que entrar es refrescar. Si ya había datos se siguen mostrando mientras llega la
   * respuesta, y si el refresco falla también se quedan: una lista de hace un rato sirve más
   * que una pantalla de error. No repinta al arrancar: quien lo llama ya está pintando.
   */
  /** Mismo patrón que `cargarRanking`: lo viejo se queda a la vista mientras llega lo nuevo. */
  function cargarComparacion(): void {
    const pedido = ++pedidoComparar;
    if (comparacion.estado === "error") comparacion = { estado: "cargando" };
    compararMusculos({}).then(
      (r) => {
        if (pedido !== pedidoComparar) return;
        comparacion = { estado: "listo", personas: r.data.personas, candidatos: r.data.candidatos };
        pintar();
      },
      () => {
        if (pedido !== pedidoComparar) return;
        if (comparacion.estado !== "listo") comparacion = { estado: "error" };
        pintar();
      }
    );
  }

  function cargarRanking(): void {
    const pedido = ++pedidoRanking;
    if (ranking.estado === "error") ranking = { estado: "cargando" };
    obtenerRanking({}).then(
      (r) => {
        if (pedido !== pedidoRanking) return;
        ranking = { estado: "listo", datos: r.data };
        pintar();
      },
      () => {
        if (pedido !== pedidoRanking) return;
        if (ranking.estado !== "listo") ranking = { estado: "error" };
        pintar();
      }
    );
  }

  /**
   * Resuelve la URL de cada video ANTES de pintar (decisión del brief): así el HTML se arma
   * síncrono y puro. Se limita a los últimos `MAXIMO_VIDEOS` antes de pedirle nada a Storage,
   * no después, para no gastar una llamada por cada quincena del historial. Un `getDownloadURL`
   * que falla (blob borrado, retención a medias) no tumba a los demás: cada uno atrapa su
   * propio error y esa tarjeta queda con `url: null`.
   */
  async function resolverVideos(crudos: VideoResumen[]): Promise<void> {
    videosCrudos = crudos;
    const recientes = ultimosRangoDescendente(crudos, MAXIMO_VIDEOS);
    videos = await Promise.all(
      recientes.map(async (v) => {
        // Sin datos no se pide: la tarjeta queda sin video hasta que apague el modo.
        if (modoSinDatos()) return { ...v, url: null };
        try {
          const url = await urlDeDescarga(v.rutaStorage);
          return { ...v, url };
        } catch {
          return { ...v, url: null };
        }
      })
    );
    pintar();
  }

  /**
   * El saludo vive FUERA de lo que se repinta, y no es un capricho de orden.
   *
   * `observarCliente` y `observarAsistencias` llegan casi a la vez — medido: 2 ms de
   * diferencia — y cada uno repinta. Con el saludo dentro, el segundo repintado borraba el
   * elemento que estaba animándose y lo reemplazaba por uno ya terminado: la máquina de
   * escribir arrancaba y moría a los 2 ms, así que el saludo aparecía de golpe. Sacándolo de
   * ahí, el nodo sobrevive a los repintados y la animación llega hasta el final.
   */
  function prepararEstructura(nombre: string): void {
    if (document.querySelector("#contenido")) return;
    iniciarCronometros();
    // La cabecera (☰ + saludo) y el menú viven fuera de `#contenido` por lo mismo que el
    // saludo: sus nodos tienen estado (la animación, la transición del panel) que un
    // repintado destruiría.
    const barra = barraInferior(BARRA.map(ventana));
    app.innerHTML = `${cabecera(saludo(nombre))}<div id="contenido"></div>` +
      `<div id="videos" hidden></div><div id="barra">${barra}</div>` +
      `<div id="menu"></div><div id="ruleta"></div>`;
    conectarSaludo();
    conectarCabecera(abrirMenu, () => abrirVentana("ajustes"));
    conectarBarra(abrirVentana);
    // Jalar desde la orilla derecha abre el menú, solo en las pestañas de la barra.
    conectarDeslizarMenu(() => !menuAbierto() && BARRA.includes(ventanaActiva()), abrirMenu);
  }

  /** Lo último que se pintó en `#videos`; `null` mientras no se pintó nada. */
  let firmaPintada: string | null = null;

  /**
   * Los videos van FUERA de lo que se repinta, por lo mismo que el saludo: el `<video>` tiene
   * estado propio (posición, buffer ya descargado) y `innerHTML` lo destruye. Con seis
   * listeners vivos más los dos botones de mes, basta con que el entrenador marque una
   * asistencia para que el video que está viendo vuelva a empezar y se recargue con dato móvil.
   *
   * Por eso cambiar de ventana solo oculta el contenedor y nunca lo vacía: al volver, el video
   * sigue donde estaba. Lo que sí se hace al salir es pausarlo, para que no siga sonando
   * detrás de otra ventana.
   */
  function pintarVideos(visible: boolean): void {
    const caja = document.querySelector<HTMLElement>("#videos");
    if (!caja) return;
    if (caja.hidden === visible) {
      caja.hidden = !visible;
      if (!visible) caja.querySelectorAll("video").forEach((v) => v.pause());
    }
    const firma = firmaVideos(videos);
    if (firma === firmaPintada) return;
    firmaPintada = firma;
    caja.innerHTML = tarjetaVideos(videos);
  }

  /** Lo último que se pintó en `#ruleta`; `null` mientras no se pintó nada. */
  let firmaRuletaPintada: string | null = null;

  /**
   * La ruleta se repinta APARTE, por lo mismo que el saludo y los videos: `pintar()` rehace el
   * `innerHTML` de `#contenido` en cada snapshot de Firestore, y una rueda a media vuelta se
   * moriría en cuanto el entrenador marcara una asistencia. Acá el nodo solo se toca cuando
   * cambia el estado del propio modal — igual que `pintarVideos`, comparando contra lo último
   * pintado, porque `pintar()` llama a esta función en CADA snapshot (asistencias, avisos,
   * medallas, logros, cliente, las dos tiradas), y `jugarRuleta` escribe en Firestore antes de
   * responder: esos snapshots pueden llegar a mitad del giro libre o del frenado. Sin la
   * guardia, ese repintado reemplaza el nodo de la rueda por uno sin la clase `.girando` ni el
   * `transform` que `ruletaGiro.ts` le puso a mano, y la rueda se congela en seco.
   */
  function pintarRuleta(): void {
    const caja = document.querySelector<HTMLElement>("#ruleta");
    if (!caja) return;
    const html = modalRuleta();
    if (html === firmaRuletaPintada) return;
    firmaRuletaPintada = html;
    // `innerHTML` reemplaza `#ruleta-rueda` por un nodo nuevo, sin el `transform` que
    // `frenar()` le dejó puesto a mano (ese estilo vive en el DOM, no en el string de
    // `modalRuleta()`). Sin rescatarlo, justo el repintado que muestra el acuse ("cayó en...")
    // haría que la rueda brincara de golpe a su ángulo de reposo, delatando la animación en el
    // instante en que la clienta más está mirando el resultado.
    const ruedaVieja = caja.querySelector<HTMLElement>("#ruleta-rueda");
    const anguloVivo = ruedaVieja ? getComputedStyle(ruedaVieja).transform : null;
    caja.innerHTML = html;
    const ruedaNueva = caja.querySelector<HTMLElement>("#ruleta-rueda");
    if (ruedaNueva && anguloVivo && anguloVivo !== "none") {
      ruedaNueva.style.transition = "none";
      ruedaNueva.style.transform = anguloVivo;
    }
    conectarRuleta(pintarRuleta);
  }

  /** Lo último que se pintó en `#menu`; `null` mientras no se pintó nada. */
  let firmaMenuPintada: string | null = null;

  /**
   * El panel solo se repinta si cambia el nombre. Abrirlo, cerrarlo y cambiar la ventana
   * activa se hacen sobre los nodos que ya están: rehacerlos cortaría la transición, y elegir
   * una ventana cierra el panel justo cuando la activa cambia.
   */
  function pintarMenu(activa: IdVentana, nombre: string): void {
    const caja = document.querySelector<HTMLElement>("#menu");
    if (!caja) return;
    const html = panelMenu(VENTANAS, nombre);
    if (html !== firmaMenuPintada) {
      firmaMenuPintada = html;
      caja.innerHTML = html;
      conectarMenu({ abrirVentana, cerrarMenu });
    }
    marcarVentanaActiva(caja.querySelectorAll<HTMLElement>("[data-ventana]"), activa);
    aplicarMenuAbierto(menuAbierto());
  }

  /** La ventana que se pintó la última vez, para volver arriba solo al cambiar de ventana. */
  let ventanaPintada: IdVentana | null = null;

  function pintar(): void {
    // Con el candado de revocado puesto, ningún listener rezagado lo tapa.
    if (accesoPerdido) return;
    if (!cliente) {
      // Se tira la estructura entera, así que las firmas de videos y ruleta dejan de
      // describir nada.
      firmaPintada = null;
      firmaRuletaPintada = null;
      firmaMenuPintada = null;
      ventanaPintada = null;
      // Callarse mientras el cliente no llegó. Los ocho listeners repintan al llegar, y el de
      // las medallas o el de las asistencias puede ganarle al del cliente —otorgarle algo
      // desde la app es la forma más fácil de provocarlo—: pintar ahí "No encontramos tus
      // datos" es decirle que no existe cuando lo único que pasa es que su documento todavía
      // viene en camino. El esqueleto de carga del HTML aguanta hasta que llegue.
      if (!clienteLlego && !falloDatos) return;
      app.innerHTML = falloDatos
        ? `<div class="tarjeta vacio">
             <div class="vacio-emoji">📡</div>
             <p>No pudimos traer tus datos.</p>
             <p style="color: var(--texto-tenue); font-size: 14px">
               Revisa tu conexión y vuelve a entrar desde tu link.
             </p>
             <p style="color: var(--texto-tenue); font-size: 11px; opacity: 0.7">
               ${falloDatos}${falloSecundario ? ` · ${falloSecundario}` : ""}${huella ? `<br>${huella}` : ""}
             </p>
           </div>`
        : `<div class="tarjeta vacio">
             <p>No encontramos tus datos.</p>
             ${
               falloSecundario
                 ? `<p style="color: var(--texto-tenue); font-size: 11px; opacity: 0.7">${falloSecundario}</p>`
                 : ""
             }
           </div>`;
      return;
    }
    prepararEstructura(cliente.nombre);
    actualizarNombre(cliente.nombre);
    marcarSexoBarra(cliente.sexo);
    marcarSinDatos(modoSinDatos());
    const contenido = document.querySelector<HTMLElement>("#contenido");
    if (!contenido) return;

    const activa = ventana(ventanaActiva());
    // Al entrar a Ranking se pide antes de pintar, así un error viejo ya sale como "cargando".
    if (activa.id === "ranking" && activa.id !== ventanaPintada) cargarRanking();
    // Cada vez y no solo al entrar: si el entrenador le pone el sexo con la ventana abierta,
    // el snapshot del cliente llega aquí y el mapa aparece sin salir y volver.
    if (activa.id === "musculos") cargarMapas(activa.id !== ventanaPintada);
    if (activa.id === "comparar") {
      // Sin acceso no se pide: la función lo rechazaría, y la ventana ya lo dice.
      if (activa.id !== ventanaPintada) { reiniciarComparar(); if (cliente.sinAccesoAmigos !== true || cliente.adminAmigos === true) cargarComparacion(); }
      cargarMapas(false, sexosAComparar(comparacion, cliente.sexo));
    }
    if (activa.id === "estadisticas" && !historialPedido) {
      historialPedido = true;
      observarHistorial(clienteId, (s) => { historial = s; pintar(); });
    }
    actualizarCabecera(tituloCabecera(activa));
    const datos = {
      cliente, hoy, asistencias, mesVisible, yaAviso, medallas, logros,
      tiradaEsteMes, tiradaMesAnterior, ranking, estilo,
      notificaciones: estadoNotificaciones(cliente.notificacionesWeb === true, entornoDelNavegador()),
      invitacionDescartada,
      reviveExtraVisto,
      activandoNotificaciones,
      mapas,
      banco,
      indiceBanco: indice,
      sesiones,
      configGrupos,
      pendientes,
      comparacion,
      sinDatos: modoSinDatos(),
      avisaWifi: conexion?.type !== undefined,
      guardandoGifs,
      avisoGifs,
      historial,
    };
    contenido.innerHTML = contenidoDe(activa, datos);
    marcarBotonAtras(contenido);
    pintarVideos(activa.contenedorPropio === "videos");
    pintarMenu(activa.id, cliente.nombre);
    marcarVentanaActiva(document.querySelectorAll<HTMLElement>("#barra [data-ventana]"), ventanaDeBarra(activa.id));
    pintarRuleta();
    if (activa.id !== ventanaPintada) {
      // Cada ventana arranca arriba. Solo al cambiar: un snapshot no debe mover el scroll.
      if (ventanaPintada !== null) window.scrollTo(0, 0);
      ventanaPintada = activa.id;
    }

    // Las acciones y los meses del calendario solo existen en Inicio. Los listeners se vuelven
    // a colgar en cada repintado: `innerHTML` tira los anteriores junto con los elementos. El
    // estado de las dos acciones no vive acá, sino dentro de sus módulos, justo para que un
    // snapshot a destiempo no lo borre.
    if (activa.id === "musculos") {
      conectarMapa(cliente.sexo, fuerzaDelCliente(datos), cliente.peso ?? null);
      conectarPeso(pintar, (peso) => guardarPeso({ peso }));
      document.querySelector("#abrir-comparar")?.addEventListener("click", () => abrirVentana("comparar"));
      return;
    }
    if (activa.id === "comparar") {
      conectarComparar(
        pintar,
        () => { cargarComparacion(); pintar(); },
        () => abrirVentana("musculos"),
        // Lo que ve cambia con lo que eligió (con "nadie" no ve a nadie): se vuelve a pedir.
        (eleccion) => elegirMostrarEnAmigos(eleccion).then((r) => { cargarComparacion(); return r; })
      );
      return;
    }
    if (activa.id === "registro") {
      // Después de pintar: `ventanaRegistro` decide en qué vista queda (con un entrenamiento
      // abierto se va a él), y de eso depende lo que va en la cabecera.
      const enCurso = cabeceraRegistro();
      if (enCurso) actualizarCabecera(enCurso.titulo, enCurso.detalle);
      conectarRegistro(datosRegistro(datos), pintar, {
        guardar: (envio) => registrarSesion(envio),
        editar: (envio) => editarSesion(envio),
        borrar: (id) => borrarSesion({ id }),
        encolar: encolarEnvio,
        enviarAhora: enviarCola,
        // Sin esperarla ni avisar si falla: sin internet la marca el entrenamiento al llegar.
        alIniciar: () => { marcarAsistencia({}).catch(() => {}); },
        // Inicio es la pantalla de entrada (null): así "volver" a ella retrocede.
        navegar: (vista, modo) => {
          const s = vista === "inicio" ? null : vista;
          if (modo === "marcar") marcarSub(s);
          else irSub(s, modo);
        },
        verMusculos: () => abrirVentana("musculos"),
        apagarSinDatos: () => { cambiarSinDatos(false); },
      });
      return;
    }
    if (activa.id === "estadisticas") {
      conectarEstadisticas(pintar, () => abrirVentana("registro"));
      return;
    }
    if (activa.id === "ranking") {
      conectarRanking(pintar, () => {
        cargarRanking();
        pintar();
      });
      return;
    }
    if (activa.id === "ajustes") {
      conectarAjustes(estilo, (nuevo) => {
        estilo = nuevo;
        pintar();
      });
      conectarSinDatos((activo) => { cambiarSinDatos(activo); });
      conectarNotificaciones(alActivarNotificaciones, alDescartarInvitacion);
      return;
    }
    if (activa.id !== "inicio") return;
    // El entrenamiento guiado vive en Registro: se arma ahí y se abre esa ventana, así
    // "atrás" regresa a Inicio y lo anotado queda en el mismo borrador que Registro.
    document.querySelector("#empezar-entrenamiento")?.addEventListener("click", () => {
      const r = datosRegistro(datos);
      // Sin el banco no se puede ligar ningún ejercicio y saldría un entrenamiento vacío.
      if (!entrenamientoAbierto() && r.banco.length === 0) {
        alert("Todavía estamos cargando tus ejercicios. Intenta otra vez en un momento.");
        return;
      }
      if (entrenamientoAbierto() === "edicion") {
        alert("Estás editando un entrenamiento pasado. Guarda o cancela esos cambios en Registro primero.");
        abrirVentana("registro");
        return;
      }
      if (empezarGuiado(r)) marcarAsistencia({}).catch(() => {});
      abrirVentana("registro");
    });
    conectarAccionDia(pintar);
    conectarAccionFalta(hoy, asistencias, pintar);
    conectarNotificaciones(alActivarNotificaciones, alDescartarInvitacion);
    conectarAvisoReviveExtra(alCerrarReviveExtra);
    document.querySelector("#mes-anterior")?.addEventListener("click", () => {
      mesVisible = moverMes(mesVisible, -1);
      pintar();
    });
    document.querySelector("#mes-siguiente")?.addEventListener("click", () => {
      mesVisible = moverMes(mesVisible, 1);
      pintar();
    });
  }

  /**
   * Si el listener del cliente ya contestó alguna vez, exista o no su documento. Es lo que
   * separa "Firestore dijo que no está" de "todavía no llegó", que hasta hoy se veían igual
   * en pantalla y son cosas distintas.
   */
  let clienteLlego = false;
  /** Lo último que falló del cliente, como `cliente:permission-denied`; `null` si todo va. */
  let falloDatos: string | null = null;
  /** Lo que falló de los listeners de al lado. No tapa la página; se muestra si no hay otra. */
  let falloSecundario: string | null = null;
  /** Qué traía la sesión cuando denegaron. Se pide una sola vez, y solo si deniegan. */
  let huella: string | null = null;
  /** El entrenador revocó el acceso con la página abierta: queda el candado y nada más. */
  let accesoPerdido = false;

  // La credencial antes que los listeners: pedir datos en el hueco entre entrar y que el
  // cliente de Firestore se entere vuelve como `permission-denied`. Sin internet no se puede
  // renovar, y no importa: Firestore muestra lo que tiene guardado en el teléfono.
  // Con el modo sin datos, Firestore ni sale a la red: los listeners entregan lo guardado en el
  // teléfono y la credencial no hace falta hasta que lo apague.
  if (modoSinDatos()) await redDeFirestore(false).catch(() => {});
  else await credencialLista().catch(() => {});

  // Lo que se terminó sin internet sale en cuanto hay señal.
  enviarCola();
  window.addEventListener("online", enviarCola);
  setInterval(enviarCola, 60_000);

  revisarCierreAutomatico();
  setInterval(revisarCierreAutomatico, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") revisarCierreAutomatico();
  });

  alBloquear(() => mostrarAvisoSinDatos(
    "Esto necesita internet y tienes el modo sin datos.",
    () => { cambiarSinDatos(false); },
    () => {}
  ));
  conexion?.addEventListener("change", revisarWifi);
  revisarWifi();

  // Una vez por carga y sin esperarla: es para la ficha del entrenador, no para ella. Si
  // falla, esta apertura no queda anotada y nada más.
  registrarEntrada({ plataforma: plataforma(navigator.userAgent) }).catch(() => {});

  alVolverDatos((origen) => {
    // Volvió: se borra su error. Sin esto, un tropiezo al arrancar dejaría la pantalla de la
    // antena puesta aunque los datos ya estuvieran llegando.
    if (origen === "cliente") falloDatos = null;
    else if (falloSecundario?.startsWith(`${origen}:`)) falloSecundario = null;
  });

  alPerderAcceso(() => {
    if (accesoPerdido) return;
    accesoPerdido = true;
    cerrarSesion();
    mostrarEnlaceInvalido("revocado");
  });

  alFallarDatos((origen, error) => {
    const marca = `${origen}:${error.code}`;
    // Solo el cliente se lleva la pantalla. Que muera un listener de al lado —un aviso que
    // todavía no existe, unos videos que no cargan— no es razón para taparle la página
    // entera: se anota, se ve si de todos modos no hay nada que pintar, y ya.
    if (origen !== "cliente") {
      falloSecundario = marca;
      return;
    }
    falloDatos = marca;
    pintar();
    // La huella llega tarde a propósito: leer el token es asíncrono y la pantalla no puede
    // esperarla. Cuando llega, se repinta con ella.
    if (error.code === "permission-denied" && !huella) {
      huellaDeLaSesion().then((h) => {
        huella = h;
        pintar();
      });
    }
  });

  observarCliente(clienteId, (c) => {
    cliente = c;
    clienteLlego = true;
    // Antes de pintar: así el primer repintado ya sale con los colores buenos y la página no
    // parpadea de morado al color de la clienta.
    aplicarPaleta(c?.paletaWeb, document.documentElement);
    // Con el permiso ya dado, se manda el token vigente una vez por carga: FCM puede rotarlo
    // y así el servidor nunca se queda con uno muerto. Si falla, no se le muestra nada a la
    // clienta; la próxima carga lo vuelve a intentar.
    if (!tokenSincronizado && c?.notificacionesWeb === true &&
        estadoNotificaciones(true, entornoDelNavegador()) === "activadas") {
      tokenSincronizado = true;
      sincronizarToken().catch(() => {});
    }
    pintar();
  });
  observarAsistencias(clienteId, (a) => { asistencias = a; pintar(); });
  observarAvisoFalta(clienteId, hoy, (a) => { yaAviso = a; pintar(); });
  observarMedallas(clienteId, (m) => { medallas = m; pintar(); });
  observarLogrosPersonales(clienteId, (l) => { logros = l; pintar(); });
  observarVideos(clienteId, (v) => { resolverVideos(v); });
  observarBanco((b) => {
    banco = b;
    indice = indiceBanco(b);
    pintar();
  });
  observarSesiones(clienteId, (s) => { sesiones = s; pintar(); });
  observarConfigGrupos((c) => { configGrupos = c; pintar(); });
  observarTirada(clienteId, hoy.slice(0, 7), (t) => { tiradaEsteMes = t; pintar(); });
  observarTirada(clienteId, mesAnterior(hoy.slice(0, 7)), (t) => {
    tiradaMesAnterior = t;
    pintar();
  });
}

/**
 * El service worker guarda la página en el teléfono para que abra sin internet (`sw.js`).
 * Antes solo se registraba al activar los avisos; ahora siempre, y después de cargar para no
 * competir con el arranque.
 */
// Con el modo sin datos no se registra: registrar revisa en la red si hay un `sw.js` nuevo, y
// el que ya está instalado sigue sirviendo la página.
if ("serviceWorker" in navigator && !modoSinDatos()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Con la página abierta desde antes de un deploy, ofrecer actualizar (`version.ts`).
vigilarVersion(__VERSION__, mostrarAvisoVersion);

arrancar();
