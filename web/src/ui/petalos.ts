/**
 * Los pétalos de sakura que caen por la ventana, dibujados en dos `<canvas>`.
 *
 * Dos capas y no una, por la profundidad: la mayoría cae DETRÁS de las tarjetas, chicos y
 * nítidos, y unos pocos caen DELANTE, más grandes y desenfocados (el CSS les pone el `blur`),
 * como si pasaran cerca de la cámara. Los de adelante no atrapan toques (`pointer-events`), así
 * que nunca estorban un botón.
 *
 * `<canvas>` y no un `<div>` por pétalo: cuarenta nodos animados con `transform` obligan al
 * navegador a recomponer la página en cada cuadro, y en un teléfono de gama baja eso se nota.
 * Acá cada cuadro es un solo dibujo.
 *
 * La física (`crearPetalo`, `avanzarPetalo`) es pura y recibe el azar como parámetro, para
 * probarla en Node sin DOM. Lo que toca `window` está abajo, en `iniciarPetalos`.
 */

export interface Petalo {
  x: number;
  y: number;
  /** Medio largo del pétalo, en px. */
  tam: number;
  /** Lo que baja por segundo. Los grandes caen un poco más rápido: pesan más. */
  vy: number;
  /** El vaivén de lado a lado: fase, frecuencia (rad/s) y amplitud (px/s). */
  fase: number;
  frecuencia: number;
  amplitud: number;
  /** Empujón de una ráfaga (px/s); se apaga solo. */
  empuje: number;
  giro: number;
  vGiro: number;
  /** El volteo: el pétalo gira sobre su eje largo y se ve de canto un instante. */
  volteo: number;
  vVolteo: number;
  color: string;
}

export const COLORES_PETALO = ["#ffd3df", "#ffc1d3", "#fbb0c6", "#ffe3eb", "#f7a1bb"];

/** Un pétalo nuevo en algún punto de la ventana. `arriba` lo pone justo sobre el borde. */
export function crearPetalo(
  azar: () => number, ancho: number, alto: number, tamMin: number, tamMax: number, arriba: boolean
): Petalo {
  const tam = tamMin + azar() * (tamMax - tamMin);
  return {
    x: azar() * ancho,
    y: arriba ? -tam * 2 - azar() * 40 : azar() * alto,
    tam,
    vy: 22 + tam * 2.2 + azar() * 18,
    fase: azar() * Math.PI * 2,
    frecuencia: 0.8 + azar() * 1.2,
    amplitud: 14 + azar() * 26,
    empuje: 0,
    giro: azar() * Math.PI * 2,
    vGiro: (azar() - 0.5) * 2.4,
    volteo: azar() * Math.PI * 2,
    vVolteo: 1.5 + azar() * 2.5,
    color: COLORES_PETALO[Math.floor(azar() * COLORES_PETALO.length)],
  };
}

/**
 * Mueve un pétalo `dt` segundos con una brisa de `viento` px/s. Devuelve `false` cuando ya
 * salió de la ventana, para que quien lo lleva lo vuelva a soltar desde arriba.
 */
export function avanzarPetalo(p: Petalo, dt: number, viento: number, ancho: number, alto: number): boolean {
  p.fase += p.frecuencia * dt;
  p.x += (viento + Math.cos(p.fase) * p.amplitud + p.empuje) * dt;
  // Mientras se ve de canto ofrece menos aire y cae un poco más rápido; de plano, planea.
  p.y += p.vy * (0.75 + 0.35 * (1 - Math.abs(Math.cos(p.volteo)))) * dt;
  p.empuje *= Math.exp(-1.6 * dt);
  p.giro += p.vGiro * dt;
  p.volteo += p.vVolteo * dt;
  // Al salir por un costado entra por el otro: con brisa constante, si no, se vaciaría un lado.
  const margen = p.tam * 3;
  if (p.x > ancho + margen) p.x = -margen;
  else if (p.x < -margen) p.x = ancho + margen;
  return p.y < alto + margen;
}

/**
 * La brisa: sopla hacia la derecha y cambia de fuerza despacio, con dos ondas que no se
 * sincronizan, así nunca se siente un ciclo que se repite.
 */
export function brisa(t: number): number {
  // Base mayor que la suma de las dos ondas (10 + 5): así nunca cambia de sentido, que se
  // vería como pétalos que de pronto suben contra el viento.
  return 18 + Math.sin(t * 0.21) * 10 + Math.sin(t * 0.53 + 1.3) * 5;
}

/** El empujón que le da al pétalo un toque en (tx, ty): lo aparta del dedo, más si está cerca. */
export function empujonDeToque(p: Petalo, tx: number, ty: number): number {
  const dx = p.x - tx;
  const distancia = Math.hypot(dx, p.y - ty);
  return Math.sign(dx || 1) * 260 * Math.exp(-distancia / 160);
}

/**
 * La forma del pétalo de sakura: una gota con una muesca en la punta. La muesca es lo que lo
 * distingue de cualquier otro pétalo, así que no se puede simplificar a una elipse.
 */
function trazarPetalo(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(s * 0.95, s * 0.35, s * 0.75, -s * 0.75, s * 0.2, -s);
  ctx.lineTo(0, -s * 0.74);
  ctx.lineTo(-s * 0.2, -s);
  ctx.bezierCurveTo(-s * 0.75, -s * 0.75, -s * 0.95, s * 0.35, 0, s);
  ctx.closePath();
}

function dibujar(ctx: CanvasRenderingContext2D, p: Petalo): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.giro);
  // El volteo es una escala en x: de plano mide entero, de canto casi nada. Nunca cero, o el
  // pétalo desaparecería un cuadro y se vería un parpadeo.
  ctx.scale(Math.max(0.12, Math.abs(Math.cos(p.volteo))), 1);
  trazarPetalo(ctx, p.tam);
  ctx.fillStyle = p.color;
  ctx.fill();
  // La base, donde el pétalo se unía a la flor, es de un rosa más hondo.
  ctx.beginPath();
  ctx.ellipse(0, p.tam * 0.62, p.tam * 0.28, p.tam * 0.34, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(232, 110, 150, 0.45)";
  ctx.fill();
  ctx.restore();
}

interface Capa {
  lienzo: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  petalos: Petalo[];
  tamMin: number;
  tamMax: number;
}

let animacion = 0;
let capas: Capa[] = [];
let quitarEscuchas: (() => void) | null = null;

/** Cuántos pétalos por capa, según el tamaño de la ventana: en un teléfono, menos. */
function cantidad(base: number): number {
  return Math.round(base * Math.min(1.6, Math.max(0.7, (window.innerWidth * window.innerHeight) / (390 * 844))));
}

function ajustarTamano(capa: Capa): void {
  // Tope de 2: en una pantalla de densidad 3 el lienzo pesaría más del doble sin que se note.
  const densidad = Math.min(2, window.devicePixelRatio || 1);
  capa.lienzo.width = Math.round(window.innerWidth * densidad);
  capa.lienzo.height = Math.round(window.innerHeight * densidad);
  capa.ctx.setTransform(densidad, 0, 0, densidad, 0, 0);
}

/**
 * Arranca la caída. Se puede llamar de más: si ya está corriendo, no hace nada. Quien pidió
 * menos movimiento no ve pétalos cayendo; el árbol en flor sigue ahí.
 */
export function iniciarPetalos(fondo: HTMLCanvasElement | null, frente: HTMLCanvasElement | null): void {
  if (animacion || !fondo || !frente) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const ctxFondo = fondo.getContext("2d");
  const ctxFrente = frente.getContext("2d");
  if (!ctxFondo || !ctxFrente) return;

  const ancho = () => window.innerWidth;
  const alto = () => window.innerHeight;
  const nuevaCapa = (lienzo: HTMLCanvasElement, ctx: CanvasRenderingContext2D, n: number, min: number, max: number) => {
    const capa: Capa = { lienzo, ctx, petalos: [], tamMin: min, tamMax: max };
    ajustarTamano(capa);
    for (let i = 0; i < n; i++) capa.petalos.push(crearPetalo(Math.random, ancho(), alto(), min, max, false));
    return capa;
  };
  capas = [nuevaCapa(fondo, ctxFondo, cantidad(32), 4, 8), nuevaCapa(frente, ctxFrente, cantidad(7), 9, 14)];

  const alRedimensionar = () => capas.forEach(ajustarTamano);
  const alTocar = (e: PointerEvent) => {
    for (const capa of capas) for (const p of capa.petalos) p.empuje += empujonDeToque(p, e.clientX, e.clientY);
  };
  window.addEventListener("resize", alRedimensionar);
  // `passive`: el toque solo sopla los pétalos, nunca frena el scroll ni el clic de un botón.
  window.addEventListener("pointerdown", alTocar, { passive: true });
  quitarEscuchas = () => {
    window.removeEventListener("resize", alRedimensionar);
    window.removeEventListener("pointerdown", alTocar);
  };

  let anterior = performance.now();
  const cuadro = (ahora: number) => {
    // Tope al paso: al volver de otra pestaña `dt` sería de minutos y todos los pétalos
    // saltarían de golpe al fondo.
    const dt = Math.min(0.05, (ahora - anterior) / 1000);
    anterior = ahora;
    const viento = brisa(ahora / 1000);
    for (const capa of capas) {
      capa.ctx.clearRect(0, 0, ancho(), alto());
      // Los de adelante, más cerca, se ven moverse más rápido: es la paralaje que da la
      // profundidad.
      const cerca = capa.tamMin > 8 ? 1.5 : 1;
      for (let i = 0; i < capa.petalos.length; i++) {
        const p = capa.petalos[i];
        if (!avanzarPetalo(p, dt * cerca, viento, ancho(), alto())) {
          capa.petalos[i] = crearPetalo(Math.random, ancho(), alto(), capa.tamMin, capa.tamMax, true);
        }
        dibujar(capa.ctx, capa.petalos[i]);
      }
    }
    animacion = requestAnimationFrame(cuadro);
  };
  animacion = requestAnimationFrame(cuadro);
}

/** La detiene y borra los lienzos. `requestAnimationFrame` ya se pausa solo en otra pestaña. */
export function detenerPetalos(): void {
  if (animacion) cancelAnimationFrame(animacion);
  animacion = 0;
  quitarEscuchas?.();
  quitarEscuchas = null;
  for (const capa of capas) capa.ctx.clearRect(0, 0, capa.lienzo.width, capa.lienzo.height);
  capas = [];
}

/**
 * La ráfaga de la transición: pétalos de CSS que cruzan la pantalla de izquierda a derecha.
 * Devuelve el estilo en línea de cada uno; `azar` entra para probarla.
 */
export function rafagaDePetalos(n: number, azar: () => number = Math.random): string[] {
  return Array.from({ length: n }, () => {
    const y = Math.round(azar() * 110 - 5);
    const caida = Math.round(10 + azar() * 25);
    const retraso = Math.round(azar() * 420);
    const tam = Math.round(10 + azar() * 16);
    const vueltas = Math.round(1 + azar() * 3);
    const color = COLORES_PETALO[Math.floor(azar() * COLORES_PETALO.length)];
    return `--y:${y}vh;--caida:${caida}vh;--retraso:${retraso}ms;--tam:${tam}px;--vueltas:${vueltas}turn;--color:${color}`;
  });
}
