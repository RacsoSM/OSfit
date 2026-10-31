import { guardarRegistroEnLibras } from "../unidadPeso";
import { guardarAutollenar } from "../autollenado";
import { guardarDescansoActivo } from "../descanso";

/**
 * Ajustes › "Registrar en libras" (entrenador, 2026-10-22). Con el interruptor prendido, en
 * Registro el selector suma Lb a Barras y Kg, y el peso libre abre en libras; se guarda en kg y
 * en todo lo demás de la página se sigue viendo en kg. Mismo interruptor que el del modo sin datos.
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
        ? "Al registrar tus ejercicios eliges entre barras, kg o libras (abren en libras). Las convertimos a kg por ti: en el resto de la página todo se sigue viendo en kg."
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

/**
 * Ajustes › "Autollenar con lo de la vez pasada" (entrenador, 2026-10-22): al agregar un
 * ejercicio que ya hizo, trae sus series de la última vez. Mismo interruptor que los demás.
 */
export function tarjetaAutollenado(activo: boolean): string {
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Autollenado</p>
      <div class="ajuste-interruptor">
        <span class="ajuste-etiqueta" id="autollenar-etiqueta">Autollenar con lo de la vez pasada</span>
        <button type="button" class="interruptor" id="interruptor-autollenar" role="switch"
                aria-checked="${activo}" aria-labelledby="autollenar-etiqueta" aria-describedby="autollenar-nota">
          <span class="interruptor-bolita" aria-hidden="true"></span>
        </button>
      </div>
      <p class="ajuste-nota" id="autollenar-nota">${activo
        ? "Al agregar en Registro un ejercicio que ya hiciste, aparece con tus series de la última vez. Revísalas antes de terminar: se guardan tal cual."
        : "Al agregar un ejercicio que ya hiciste, aparece sin series para que anotes lo de hoy. Actívalo si prefieres que traiga tus series de la última vez."}</p>
      <p class="ajuste-nota ajuste-tenue">Se guarda en este teléfono.</p>
    </div>`;
}

/** Cuelga el interruptor. Como el resto de `conectar*`, se vuelve a llamar en cada repintado. */
export function conectarAutollenado(repintar: () => void): void {
  const boton = document.querySelector<HTMLButtonElement>("#interruptor-autollenar");
  boton?.addEventListener("click", () => {
    guardarAutollenar(boton.getAttribute("aria-checked") !== "true");
    repintar();
  });
}

/**
 * Ajustes › "Cronómetro de descanso" (entrenador, 2026-10-31): en Registro cuenta cuánto lleva
 * descansando desde la última serie y anota en cada serie lo que descansó antes. Sin duración
 * fija ni alarma. Mismo interruptor que los demás.
 */
export function tarjetaDescanso(activo: boolean): string {
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Descanso entre series</p>
      <div class="ajuste-interruptor">
        <span class="ajuste-etiqueta" id="descanso-etiqueta">Cronómetro de descanso</span>
        <button type="button" class="interruptor" id="interruptor-descanso" role="switch"
                aria-checked="${activo}" aria-labelledby="descanso-etiqueta" aria-describedby="descanso-nota">
          <span class="interruptor-bolita" aria-hidden="true"></span>
        </button>
      </div>
      <p class="ajuste-nota" id="descanso-nota">${activo
        ? "En Registro, junto al tiempo del entrenamiento, ves cuánto llevas descansando desde tu última serie, y en cada serie cuánto descansaste antes. Arranca solo al anotar cada serie. Al terminar el entrenamiento esos tiempos se borran."
        : "Actívalo para ver en Registro cuánto llevas descansando entre series. Arranca solo al anotar cada serie, sin tiempo fijo."}</p>
      <p class="ajuste-nota ajuste-tenue">Se guarda en este teléfono.</p>
    </div>`;
}

/** Cuelga el interruptor. Como el resto de `conectar*`, se vuelve a llamar en cada repintado. */
export function conectarDescanso(repintar: () => void): void {
  const boton = document.querySelector<HTMLButtonElement>("#interruptor-descanso");
  boton?.addEventListener("click", () => {
    guardarDescansoActivo(boton.getAttribute("aria-checked") !== "true");
    repintar();
  });
}
