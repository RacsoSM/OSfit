/**
 * El cronómetro del entrenamiento: corre desde que tocó "Iniciar entrenamiento" (Registro) o
 * "Empezar entrenamiento guiado ▶" (tarjeta del día). No guarda nada propio: cuenta desde
 * `Borrador.iniciado`, que ya vive en el navegador, así que cerrar la pestaña o cambiar de
 * ventana no lo reinicia.
 *
 * Se pinta como cualquier otro HTML (`cronometro`) y un solo intervalo actualiza cada segundo
 * todo lo que lleve `data-desde`. Así no hace falta repintar la página cada segundo, que
 * cerraría el teclado bajo el dedo mientras escribe sus series.
 */

/** "4:07", "12:30", "1:05:09". */
export function tiempoTranscurrido(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function cronometro(desde: number, ahora = Date.now()): string {
  return `
    <div class="cronometro" role="timer" aria-label="Tiempo entrenando">
      <span aria-hidden="true">⏱</span>
      <span class="cronometro-tiempo" data-desde="${desde}">${tiempoTranscurrido(ahora - desde)}</span>
    </div>`;
}

let intervalo: ReturnType<typeof setInterval> | null = null;

/** Una sola vez al armar la página. */
export function iniciarCronometros(): void {
  if (intervalo !== null) return;
  intervalo = setInterval(() => {
    const ahora = Date.now();
    document.querySelectorAll<HTMLElement>("[data-desde]").forEach((el) => {
      const texto = tiempoTranscurrido(ahora - Number(el.dataset.desde));
      if (el.textContent !== texto) el.textContent = texto;
    });
  }, 1000);
}
