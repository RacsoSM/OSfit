/**
 * El cronómetro del entrenamiento: corre desde que tocó "Iniciar entrenamiento" (Registro) o
 * "▶ Empezar entrenamiento guiado" (tarjeta del día). No guarda nada propio: cuenta desde
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

/**
 * `descanso`: con el cronómetro de descanso prendido (Ajustes), desde cuándo cuenta (ms), o null
 * si todavía no completa ninguna serie: va escondido y `mostrarDescanso` lo destapa sin repintar.
 * Sin él (undefined), solo el tiempo entrenando.
 */
export function cronometro(desde: number, ahora = Date.now(), descanso?: number | null): string {
  const extra = descanso === undefined ? "" : `
      <span class="cronometro-descanso"${descanso === null ? " hidden" : ""} role="timer" aria-label="Tiempo descansando">
        <span aria-hidden="true">😮‍💨</span>
        <span class="cronometro-tiempo" data-desde="${descanso ?? ahora}">${tiempoTranscurrido(ahora - (descanso ?? ahora))}</span>
      </span>`;
  return `
    <div class="cronometro" role="timer" aria-label="Tiempo entrenando">
      <span aria-hidden="true">⏱</span>
      <span class="cronometro-tiempo" data-desde="${desde}">${tiempoTranscurrido(ahora - desde)}</span>${extra}
    </div>`;
}

/**
 * El descanso vuelve a 0:00 desde `desde`, sin repintar la página (cerraría el teclado mientras
 * escribe su serie). Si va escondido porque no había ninguna serie completa, se destapa.
 */
export function mostrarDescanso(desde: number): void {
  document.querySelectorAll<HTMLElement>(".cronometro-descanso").forEach((caja) => {
    caja.hidden = false;
    const tiempo = caja.querySelector<HTMLElement>("[data-desde]");
    if (!tiempo) return;
    tiempo.dataset.desde = String(desde);
    tiempo.textContent = tiempoTranscurrido(Date.now() - desde);
  });
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
