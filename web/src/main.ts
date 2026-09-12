import { observarCliente, observarAsistencias } from "./datos";
import type { Cliente, Asistencia } from "./datos";
import { hoyEnMazatlan } from "./fecha";
import { iniciarSesion } from "./firebase";
import { escapar, tarjetaDia } from "./ui/tarjetaDia";
import { tarjetasStats } from "./ui/tarjetasStats";
import { accionDia, conectarAccionDia } from "./ui/accionDia";
import { accionFalta, conectarAccionFalta } from "./ui/accionFalta";
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

  function pintar(): void {
    if (!cliente) {
      app.innerHTML = `<div class="tarjeta vacio"><p>No encontramos tus datos.</p></div>`;
      return;
    }
    app.innerHTML = `
      <h1 style="font-size:20px;margin:4px 2px 14px">Hola, ${escapar(cliente.nombre)} 👋</h1>
      ${tarjetaDia(cliente, hoy)}
      ${tarjetasStats(asistencias, hoy)}
      ${accionDia(cliente, hoy, asistencias)}
      ${accionFalta(cliente, hoy, asistencias)}
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
