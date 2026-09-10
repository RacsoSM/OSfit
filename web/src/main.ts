import { observarCliente } from "./datos";
import { hoyEnMazatlan } from "./fecha";
import { iniciarSesion } from "./firebase";
import { escapar, tarjetaDia } from "./ui/tarjetaDia";

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
  observarCliente(clienteId, (cliente) => {
    if (!cliente) {
      app.innerHTML = `<div class="tarjeta vacio"><p>No encontramos tus datos.</p></div>`;
      return;
    }
    app.innerHTML = `
      <h1 style="font-size:20px;margin:4px 2px 14px">Hola, ${escapar(cliente.nombre)} 👋</h1>
      ${tarjetaDia(cliente, hoy)}
    `;
  });
}

arrancar();
