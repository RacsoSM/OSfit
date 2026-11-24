/**
 * Sonidos leves del resumen del mes, sintetizados con Web Audio (sin archivos que descargar).
 * Todos son cortos y bajitos, como de interfaz. Se pueden silenciar con la bocina del visor y
 * la preferencia se recuerda en este teléfono.
 *
 * En iPhone el audio solo arranca dentro de un toque: `prepararSonido()` se llama en los toques
 * del visor para crear o despertar el contexto.
 */

export type Sonido = "pasar" | "foco" | "voltear" | "contar" | "remate" | "compartir";

const LLAVE = "osfit:sonido";
let enMemoria: boolean | null = null;

/** Si el sonido está encendido (lo está, salvo que lo hayan silenciado). */
export function sonidoActivo(): boolean {
  try {
    const v = globalThis.localStorage?.getItem(LLAVE);
    if (v != null) return v !== "no";
  } catch { /* sin almacenamiento: queda en memoria */ }
  return enMemoria ?? true;
}

/** Prende o apaga el sonido y lo recuerda. Devuelve el nuevo estado. */
export function alternarSonido(): boolean {
  const activo = !sonidoActivo();
  enMemoria = activo;
  try { globalThis.localStorage?.setItem(LLAVE, activo ? "si" : "no"); } catch { /* en memoria */ }
  if (!activo) void contexto?.suspend().catch(() => undefined);
  return activo;
}

let contexto: AudioContext | null = null;
let salida: GainNode | null = null;

/** Crea o despierta el audio; llamarlo desde un toque. */
export function prepararSonido(): void {
  if (!sonidoActivo()) return;
  const Ctx = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
    .AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    if (!contexto) {
      contexto = new Ctx();
      salida = contexto.createGain();
      salida.gain.value = VOLUMEN;
      salida.connect(contexto.destination);
    }
    if (contexto.state === "suspended") void contexto.resume().catch(() => undefined);
  } catch {
    contexto = null;
  }
}

/** Toca un sonido ya (si está encendido, el audio listo y la página a la vista). */
export function sonar(s: Sonido): void {
  if (!sonidoActivo() || !contexto || !salida) return;
  if (typeof document !== "undefined" && document.hidden) return;
  if (contexto.state === "suspended") void contexto.resume().catch(() => undefined);
  try {
    SINTES[s](contexto, salida, contexto.currentTime + 0.01);
  } catch { /* un sonido que falla no debe romper el resumen */ }
}

// ── Síntesis ──────────────────────────────────────────────────────────────────

/** Volumen general: bajito. */
export const VOLUMEN = 0.8;

type Sinte = (ctx: BaseAudioContext, destino: AudioNode, t: number) => void;

/** Un tono con envolvente rápida: sube en `ataque` y se apaga en `caida`. */
function tono(ctx: BaseAudioContext, destino: AudioNode, t: number, f: number, vol: number, ataque: number, caida: number,
  tipo: OscillatorType = "sine", fFinal?: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (fFinal) o.frequency.exponentialRampToValueAtTime(fFinal, t + ataque + caida);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + caida);
  o.connect(g).connect(destino);
  o.start(t);
  o.stop(t + ataque + caida + 0.05);
}

/** Ruido blanco filtrado (para el "fssh" y el clic del reflector). */
function ruido(ctx: BaseAudioContext, destino: AudioNode, t: number, dur: number, vol: number,
  filtro: BiquadFilterType, f0: number, f1: number, q = 1): void {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bq = ctx.createBiquadFilter();
  bq.type = filtro;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t);
  bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(g).connect(destino);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const NOTAS = [1046.5, 1318.5, 1568, 1760, 2093]; // Do6 Mi6 Sol6 La6 Do7

export const SINTES: Record<Sonido, Sinte> = {
  // Un "tic" de madera, muy suave.
  pasar: (ctx, d, t) => {
    tono(ctx, d, t, 1500, 0.08, 0.004, 0.05, "triangle", 900);
  },
  // El "clac" grave de un reflector que se prende.
  foco: (ctx, d, t) => {
    ruido(ctx, d, t, 0.05, 0.07, "highpass", 2500, 4000);
    tono(ctx, d, t, 120, 0.3, 0.006, 0.28, "sine", 50);
  },
  // La tarjeta se voltea: un soplido corto que sube.
  voltear: (ctx, d, t) => {
    ruido(ctx, d, t, 0.26, 0.09, "bandpass", 500, 3200, 1.2);
  },
  // El número corre: un tintineo que sube y se va apagando.
  contar: (ctx, d, t) => {
    NOTAS.forEach((f, i) => tono(ctx, d, t + i * 0.14, f, 0.045 - i * 0.004, 0.005, 0.18, "sine"));
  },
  // El remate: un acorde brillante con un arpegio encima.
  remate: (ctx, d, t) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tono(ctx, d, t, f, 0.05, 0.03, 1.8, "triangle"));
    [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => tono(ctx, d, t + 0.05 + i * 0.07, f, 0.03, 0.005, 0.6, "sine"));
  },
  // Compartir: un "ding".
  compartir: (ctx, d, t) => {
    tono(ctx, d, t, 1318.5, 0.07, 0.004, 0.8, "sine");
    tono(ctx, d, t, 2637, 0.02, 0.004, 0.5, "sine");
  },
};

/**
 * Los sonidos del espectáculo final que faltan por sonar, en segundos desde ahora, dado cuánto
 * va (`transcurrido`). `conNumero[i]` dice si la tarjeta `i` tiene un número que corre.
 */
export function sonidosDeLaEscena(
  conNumero: readonly boolean[],
  transcurrido: number,
  e: { intro: number; paso: number; voltear: number; apuntar: number; remate: number },
): { en: number; sonido: Sonido }[] {
  const lista: { en: number; sonido: Sonido }[] = [];
  conNumero.forEach((numero, i) => {
    const turno = e.intro + i * e.paso;
    lista.push({ en: turno - e.apuntar, sonido: "foco" });
    lista.push({ en: turno, sonido: "voltear" });
    if (numero) lista.push({ en: turno + e.voltear, sonido: "contar" });
  });
  lista.push({ en: e.remate, sonido: "remate" });
  return lista
    .map((s) => ({ en: s.en - transcurrido, sonido: s.sonido }))
    .filter((s) => s.en > 0)
    .sort((a, b) => a.en - b.en);
}
