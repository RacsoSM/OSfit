import type { EstadoNotificaciones } from "../notificaciones";

/**
 * Los pasos para instalar en iPhone. Es la parte que más importa de toda la función: sin
 * instalar, iOS no deja recibir notificaciones, y Apple no permite mostrar un aviso
 * automático de instalación, así que la página solo puede explicarlo.
 */
const PASOS_INSTALAR = `
  <ol class="pasos-instalar">
    <li>Si estás dentro de WhatsApp, toca <strong>⋯</strong> y elige <strong>Abrir en Safari</strong>.</li>
    <li>En Safari, toca <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).</li>
    <li>Elige <strong>Agregar a inicio</strong> y luego <strong>Agregar</strong>.</li>
    <li>Cierra Safari y abre <strong>OSfit</strong> desde el ícono nuevo de tu pantalla de inicio.</li>
    <li>Ahí te aparecerá el botón para activar las notificaciones.</li>
  </ol>`;

function boton(ocupado: boolean): string {
  return `<button class="boton" id="activar-notificaciones"${ocupado ? " disabled" : ""}>
      ${ocupado ? "Activando…" : "Activar notificaciones"}
    </button>`;
}

/** La sección de Ajustes. Vacía si el entrenador no la habilitó. */
export function seccionNotificaciones(estado: EstadoNotificaciones, ocupado: boolean): string {
  const cuerpo: Record<Exclude<EstadoNotificaciones, "no-habilitada">, string> = {
    "instalar": `<p class="ajuste-nota">Para recibir avisos de tus coaches en iPhone, instala esta página en tu pantalla de inicio:</p>${PASOS_INSTALAR}`,
    "instalar-desde-link": `<p class="ajuste-nota">Abre esta página desde tu link de WhatsApp y desde ahí instálala en tu pantalla de inicio.</p>`,
    "no-soportado": `<p class="ajuste-nota">Este teléfono no puede recibir avisos de una página web. En iPhone hace falta iOS 16.4 o más reciente.</p>`,
    "pedir-permiso": `<p class="ajuste-nota">Recibe los avisos de tus coaches: cuando llegan, cuando se van o si se retrasan.</p>${boton(ocupado)}`,
    "activadas": `<p class="ajuste-nota">✅ Notificaciones activadas en este teléfono.</p>`,
    "bloqueadas": `<p class="ajuste-nota">Las notificaciones están bloqueadas. Actívalas en Ajustes del teléfono → Notificaciones → OSfit.</p>`,
  };
  if (estado === "no-habilitada") return "";
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Notificaciones</p>
      ${cuerpo[estado]}
    </div>`;
}

/**
 * La invitación de Inicio. Solo para quien puede dar el siguiente paso; los demás estados
 * se explican en Ajustes, que es donde la clienta va a buscarlo.
 */
export function invitacionNotificaciones(estado: EstadoNotificaciones, descartada: boolean): string {
  if (descartada) return "";
  if (estado !== "pedir-permiso" && estado !== "instalar") return "";
  const accion =
    estado === "pedir-permiso"
      ? boton(false)
      : `<p class="ajuste-nota">Mira cómo instalar la página en <strong>Ajustes</strong> (menú ☰).</p>`;
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">🔔 Avisos de tus coaches</p>
      <p class="ajuste-nota">Entérate cuando llegan, cuando se van o si se retrasan.</p>
      ${accion}
      <button class="boton-texto" id="descartar-notificaciones">Ahora no</button>
    </div>`;
}

/** Se vuelve a colgar en cada repintado, como el resto de `conectar*`. */
export function conectarNotificaciones(alActivar: () => void, alDescartar: () => void): void {
  document.querySelector("#activar-notificaciones")?.addEventListener("click", alActivar);
  document.querySelector("#descartar-notificaciones")?.addEventListener("click", alDescartar);
}
