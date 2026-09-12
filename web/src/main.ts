import { observarCliente, observarAsistencias } from "./datos";
import type { Cliente, Asistencia } from "./datos";
import { hoyEnMazatlan } from "./fecha";
import { iniciarSesion } from "./firebase";
import { tarjetaDia } from "./ui/tarjetaDia";
import { saludo, conectarSaludo, actualizarNombre } from "./ui/saludo";
import { tarjetasStats } from "./ui/tarjetasStats";
import { accionDia, conectarAccionDia, hojaDeMotivosAbierta } from "./ui/accionDia";
import { accionHoyNoPuedo, tarjetaRevivir, conectarAccionFalta } from "./ui/accionFalta";
import { calendario, moverMes } from "./ui/calendario";

const app = document.querySelector<HTMLElement>("#app")!;

function mostrarEnlaceInvalido(): void {
  app.innerHTML = `
    <div class="tarjeta vacio">
      <div class="vacio-emoji">🔒</div>
      <p>Este enlace ya no es válido.</p>
      <p style="color: var(--texto-tenue); font-size: 14px">
        Pídele a tu entrenador que te comparta uno nuevo.
      </p>
    </div>`;
}

async function arrancar(): Promise<void> {
  let clienteId: string | null;
  try {
    clienteId = await iniciarSesion();
  } catch {
    // Un error de red al canjear el token y un token inválido se ven igual para el
    // cliente: en ambos casos no pudimos meterlo a su sesión, así que reciben el
    // mismo mensaje en vez de quedarse viendo la pantalla de carga para siempre.
    mostrarEnlaceInvalido();
    return;
  }
  if (!clienteId) {
    mostrarEnlaceInvalido();
    return;
  }
  const hoy = hoyEnMazatlan();

  let cliente: Cliente | null = null;
  let asistencias: Asistencia[] = [];
  let mesVisible = hoy.slice(0, 7);

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
    app.innerHTML = `${saludo(nombre)}<div id="contenido"></div>`;
    conectarSaludo();
  }

  function pintar(): void {
    if (!cliente) {
      app.innerHTML = `<div class="tarjeta vacio"><p>No encontramos tus datos.</p></div>`;
      return;
    }
    prepararEstructura(cliente.nombre);
    actualizarNombre(cliente.nombre);
    const contenido = document.querySelector<HTMLElement>("#contenido");
    if (!contenido) return;

    // Cada acción vive junto al dato del que habla: cambiar el día y avisar que hoy no se
    // puede van dentro de la tarjeta del día; revivir la racha va debajo de la racha.
    const accionesDelDia = `
      ${accionDia(cliente, hoy, asistencias)}
      ${hojaDeMotivosAbierta() ? "" : accionHoyNoPuedo(cliente, hoy, asistencias)}`;

    contenido.innerHTML = `
      ${tarjetaDia(cliente, hoy, accionesDelDia)}
      ${tarjetasStats(asistencias, hoy)}
      ${tarjetaRevivir(cliente, hoy, asistencias)}
      ${calendario(asistencias, mesVisible, hoy)}
    `;
    // Los listeners se vuelven a colgar en cada repintado: `innerHTML` tira los anteriores
    // junto con los elementos. El estado de las dos acciones no vive acá, sino dentro de sus
    // módulos, justo para que un snapshot a destiempo no lo borre.
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

  observarCliente(clienteId, (c) => { cliente = c; pintar(); });
  observarAsistencias(clienteId, (a) => { asistencias = a; pintar(); });
}

arrancar();
