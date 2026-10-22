import { guardarRegistroEnLibras } from "../unidadPeso";

/**
 * Ajustes › "Registrar en libras" (entrenador, 2026-10-22). Con el interruptor prendido, en
 * Registro el peso se anota en libras o en barras, nunca en kg; se guarda en kg y en todo lo
 * demás de la página se sigue viendo en kg. Mismo interruptor que el del modo sin datos.
 */
export function tarjetaUnidadPeso(enLibras: boolean): string {
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Peso en Registro</p>
      <div class="ajuste-interruptor">
        <span class="ajuste-etiqueta" id="libras-etiqueta">Registrar en libras</span>
        <button type="button" class="interruptor" id="interruptor-libras" role="switch"
                aria-checked="${enLibras}" aria-labelledby="libras-etiqueta" aria-describedby="libras-nota">
          <span class="interruptor-bolita" aria-hidden="true"></span>
        </button>
      </div>
      <p class="ajuste-nota" id="libras-nota">${enLibras
        ? "Al registrar tus ejercicios eliges entre libras o barras. Las convertimos a kg por ti: en el resto de la página todo se sigue viendo en kg."
        : "Si tus pesas o discos están en libras, actívalo: en Registro podrás anotar en libras en vez de kg."}</p>
      <p class="ajuste-nota ajuste-tenue">Se guarda en este teléfono.</p>
    </div>`;
}

/** Cuelga el interruptor. Como el resto de `conectar*`, se vuelve a llamar en cada repintado. */
export function conectarUnidadPeso(repintar: () => void): void {
  const boton = document.querySelector<HTMLButtonElement>("#interruptor-libras");
  boton?.addEventListener("click", () => {
    guardarRegistroEnLibras(boton.getAttribute("aria-checked") !== "true");
    repintar();
  });
}
