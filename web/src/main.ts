import { getDownloadURL, ref } from "firebase/storage";
import {
  alFallarDatos,
  alVolverDatos,
  observarCliente,
  observarAsistencias,
  observarAvisoFalta,
  observarMedallas,
  observarLogrosPersonales,
  observarVideos,
  observarTirada,
} from "./datos";
import type {
  Cliente,
  Asistencia,
  MedallaOtorgada,
  LogroPersonalOtorgado,
  VideoResumen,
} from "./datos";
import { hoyEnMazatlan } from "./fecha";
import { mesAnterior, type Tirada } from "./tirada";
import { modalRuleta, conectarRuleta } from "./ui/ruleta";
import { credencialLista, huellaDeLaSesion, iniciarSesion, storage } from "./firebase";
import { almacenesDelNavegador, saludDeLosAlmacenes } from "./sesion";
import type { MotivoSinAcceso, ResultadoSesion } from "./sesion";
import { aplicarPaleta } from "./paleta";
import { saludo, conectarSaludo, actualizarNombre } from "./ui/saludo";
import { conectarAccionDia } from "./ui/accionDia";
import { conectarAccionFalta } from "./ui/accionFalta";
import { moverMes } from "./ui/calendario";
import { tarjetaVideos, ultimosRangoDescendente, firmaVideos, MAXIMO_VIDEOS } from "./ui/tarjetaVideos";
import { VENTANAS, contenidoDe, ventana, type IdVentana } from "./ventanas";
import {
  abrirMenu, abrirVentana, cerrarMenu, historialDelNavegador, iniciarNavegacion, menuAbierto,
  ventanaActiva,
} from "./navegacion";
import {
  actualizarCabecera, aplicarMenuAbierto, cabecera, conectarCabecera, conectarMenu,
  marcarVentanaActiva, panelMenu,
} from "./ui/menuLateral";
import type { VideoConUrl } from "./ui/tarjetaVideos";

const app = document.querySelector<HTMLElement>("#app")!;

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
  app.innerHTML = `
    <div class="tarjeta vacio">
      <div class="vacio-emoji">${perdida ? "🔗" : "🔒"}</div>
      <p>${perdida ? "Abre tu link otra vez." : "Este enlace ya no es válido."}</p>
      <p style="color: var(--texto-tenue); font-size: 14px">
        ${
          perdida
            ? "Búscalo en tu chat de WhatsApp con tu entrenador: el mismo de siempre sirve."
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

  /**
   * Resuelve la URL de cada video ANTES de pintar (decisión del brief): así el HTML se arma
   * síncrono y puro. Se limita a los últimos `MAXIMO_VIDEOS` antes de pedirle nada a Storage,
   * no después, para no gastar una llamada por cada quincena del historial. Un `getDownloadURL`
   * que falla (blob borrado, retención a medias) no tumba a los demás: cada uno atrapa su
   * propio error y esa tarjeta queda con `url: null`.
   */
  async function resolverVideos(crudos: VideoResumen[]): Promise<void> {
    const recientes = ultimosRangoDescendente(crudos, MAXIMO_VIDEOS);
    videos = await Promise.all(
      recientes.map(async (v) => {
        try {
          const url = await getDownloadURL(ref(storage, v.rutaStorage));
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
    // La cabecera (☰ + saludo) y el menú viven fuera de `#contenido` por lo mismo que el
    // saludo: sus nodos tienen estado (la animación, la transición del panel) que un
    // repintado destruiría.
    app.innerHTML = `${cabecera(saludo(nombre))}<div id="contenido"></div>` +
      `<div id="videos" hidden></div><div id="menu"></div><div id="ruleta"></div>`;
    conectarSaludo();
    conectarCabecera(abrirMenu);
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
    const contenido = document.querySelector<HTMLElement>("#contenido");
    if (!contenido) return;

    const activa = ventana(ventanaActiva());
    actualizarCabecera(activa.id === "inicio" ? null : activa.titulo);
    contenido.innerHTML = contenidoDe(activa, {
      cliente, hoy, asistencias, mesVisible, yaAviso, medallas, logros,
      tiradaEsteMes, tiradaMesAnterior,
    });
    pintarVideos(activa.contenedorPropio === "videos");
    pintarMenu(activa.id, cliente.nombre);
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
    if (activa.id !== "inicio") return;
    conectarAccionDia(pintar);
    conectarAccionFalta(hoy, asistencias, pintar);
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

  // La credencial antes que los listeners: pedir datos en el hueco entre entrar y que el
  // cliente de Firestore se entere vuelve como `permission-denied`.
  await credencialLista();

  alVolverDatos((origen) => {
    // Volvió: se borra su error. Sin esto, un tropiezo al arrancar dejaría la pantalla de la
    // antena puesta aunque los datos ya estuvieran llegando.
    if (origen === "cliente") falloDatos = null;
    else if (falloSecundario?.startsWith(`${origen}:`)) falloSecundario = null;
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
    pintar();
  });
  observarAsistencias(clienteId, (a) => { asistencias = a; pintar(); });
  observarAvisoFalta(clienteId, hoy, (a) => { yaAviso = a; pintar(); });
  observarMedallas(clienteId, (m) => { medallas = m; pintar(); });
  observarLogrosPersonales(clienteId, (l) => { logros = l; pintar(); });
  observarVideos(clienteId, (v) => { resolverVideos(v); });
  observarTirada(clienteId, hoy.slice(0, 7), (t) => { tiradaEsteMes = t; pintar(); });
  observarTirada(clienteId, mesAnterior(hoy.slice(0, 7)), (t) => {
    tiradaMesAnterior = t;
    pintar();
  });
}

arrancar();
