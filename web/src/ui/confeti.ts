/**
 * El confeti que cae sin parar detrás de las historias del resumen mensual (entrenador,
 * 2026-11-24). Un `<canvas>` por debajo del contenido (`.rh-confeti` en `estilos.css`): no
 * recibe toques y las tarjetas lo tapan.
 *
 * Las piezas viven en el módulo y no en el canvas: `pintar()` rehace el visor en cada snapshot
 * de Firestore y, sin esto, el confeti volvería a empezar desde arriba a cada rato. Hay un solo
 * ciclo de animación a la vez; se detiene solo cuando el canvas sale de la página.
 *
 * Con "reducir movimiento" del teléfono no se anima: se dibuja una vez, quieto.
 */

/** Los colores de la paleta fija del resumen: el azul y sus tonos, los de estado y blanco. */
const COLORES = ["#3987e5", "#86b6ef", "#1c5cab", "#0ca30c", "#fab219", "#d03b3b", "#f0efec"];
const PIEZAS = 36;

interface Pieza {
  x: number; y: number; ancho: number; alto: number; color: string;
  vy: number; giro: number; vgiro: number; fase: number; vaiven: number; redonda: boolean;
}

let piezas: Pieza[] = [];
let ciclo = 0;
let lienzo: HTMLCanvasElement | null = null;

function nueva(ancho: number, alto: number, arriba: boolean): Pieza {
  return {
    x: Math.random() * ancho,
    y: arriba ? -20 - Math.random() * alto * 0.3 : Math.random() * alto,
    ancho: 5 + Math.random() * 5,
    alto: 8 + Math.random() * 6,
    color: COLORES[Math.floor(Math.random() * COLORES.length)],
    vy: 35 + Math.random() * 45,
    giro: Math.random() * Math.PI * 2,
    vgiro: (Math.random() - 0.5) * 5,
    fase: Math.random() * Math.PI * 2,
    vaiven: 12 + Math.random() * 18,
    redonda: Math.random() < 0.25,
  };
}

function dibujar(ctx: CanvasRenderingContext2D, ancho: number, alto: number): void {
  ctx.clearRect(0, 0, ancho, alto);
  for (const p of piezas) {
    ctx.save();
    ctx.translate(p.x + Math.sin(p.fase) * p.vaiven, p.y);
    ctx.rotate(p.giro);
    // El "voltearse" del papel: se achica de un lado según gira.
    ctx.scale(Math.abs(Math.cos(p.giro * 0.7)) * 0.8 + 0.2, 1);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = p.color;
    if (p.redonda) {
      ctx.beginPath();
      ctx.arc(0, 0, p.ancho / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto);
    }
    ctx.restore();
  }
}

/** Pone a llover el confeti en el canvas del visor (o deja de hacerlo si ya no está). */
export function lluviaDeConfeti(canvas: HTMLCanvasElement | null): void {
  cancelAnimationFrame(ciclo);
  lienzo = canvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ajustar = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ancho: width, alto: height };
  };
  let { ancho, alto } = ajustar();
  if (piezas.length === 0) piezas = Array.from({ length: PIEZAS }, () => nueva(ancho, alto, false));

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    dibujar(ctx, ancho, alto);
    return;
  }
  let antes = performance.now();
  const paso = (ahora: number) => {
    if (lienzo !== canvas || !canvas.isConnected) return;
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    if (canvas.width !== Math.round(canvas.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2))) {
      ({ ancho, alto } = ajustar());
    }
    for (let i = 0; i < piezas.length; i++) {
      const p = piezas[i];
      p.y += p.vy * dt;
      p.fase += dt * 1.6;
      p.giro += p.vgiro * dt;
      if (p.y > alto + 20) piezas[i] = nueva(ancho, alto, true);
    }
    dibujar(ctx, ancho, alto);
    ciclo = requestAnimationFrame(paso);
  };
  ciclo = requestAnimationFrame(paso);
}
