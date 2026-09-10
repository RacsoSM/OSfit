import { iniciarSesion } from "./firebase";

const app = document.querySelector<HTMLElement>("#app")!;

async function arrancar(): Promise<void> {
  const clienteId = await iniciarSesion();
  if (!clienteId) {
    app.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">🔒</div>
        <p>Este enlace ya no es válido.</p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          Pídele a tu entrenador que te comparta uno nuevo.
        </p>
      </div>`;
    return;
  }
  app.innerHTML = `<p class="cargando">Sesión iniciada: ${clienteId}</p>`;
}

arrancar();
