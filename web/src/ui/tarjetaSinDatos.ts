import { escapar } from "./tarjetaDia";

/**
 * La tarjeta del modo sin datos en Ajustes (`sinDatos.ts`).
 *
 * Un interruptor y no un botón de "Activar": es un estado que se queda puesto, y el
 * interruptor dice de un vistazo cómo está. Es un `<button role="switch">` para que el lector
 * de pantalla lo anuncie como tal y se active igual con el dedo que con el teclado.
 *
 * `avisaWifi`: si este navegador dice cuándo hay Wi-Fi. En iPhone no lo dice, y se avisa para
 * que nadie espere la sugerencia de apagarlo.
 */
export function tarjetaSinDatos(activo: boolean, avisaWifi: boolean): string {
  const nota = activo
    ? "No se usa internet. Ves lo guardado en este teléfono, y lo que termines en Registro se envía al desactivarlo. La ruleta, el ranking, Amigos, revivir la racha y los videos necesitan internet."
    : "Para no gastar tus datos móviles: la página usa solo lo guardado en este teléfono, y tus entrenamientos se envían cuando lo desactives.";
  const wifi = avisaWifi
    ? "Cuando te conectes a una red Wi-Fi te sugeriremos desactivarlo."
    : "Este teléfono no avisa cuándo estás en Wi-Fi: desactívalo tú al conectarte.";
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Datos móviles</p>
      <div class="ajuste-interruptor">
        <span class="ajuste-etiqueta" id="sin-datos-etiqueta">Modo sin datos</span>
        <button type="button" class="interruptor" id="interruptor-sin-datos" role="switch"
                aria-checked="${activo}" aria-labelledby="sin-datos-etiqueta" aria-describedby="sin-datos-nota">
          <span class="interruptor-bolita" aria-hidden="true"></span>
        </button>
      </div>
      <p class="ajuste-nota" id="sin-datos-nota">${escapar(nota)}</p>
      <p class="ajuste-nota ajuste-tenue">${escapar(wifi)} Se guarda en este teléfono.</p>
    </div>`;
}

/** Cuelga el interruptor. Como el resto de `conectar*`, se vuelve a llamar en cada repintado. */
export function conectarSinDatos(alCambiar: (activo: boolean) => void): void {
  const boton = document.querySelector<HTMLButtonElement>("#interruptor-sin-datos");
  boton?.addEventListener("click", () => alCambiar(boton.getAttribute("aria-checked") !== "true"));
}
