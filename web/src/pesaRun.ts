/**
 * Pesa Run (entrenador, 2026-11-27): el cuarto juego del Arcade. Un corredor sin fin de tres
 * carriles por el pasillo del gimnasio: la protagonista es una mancuerna con ojos y patitas que
 * corre sola hacia adelante. Con el dedo se cambia de carril (deslizar a los lados), se salta
 * (hacia arriba) y se barre por el piso (hacia abajo).
 *
 * Los obstáculos son del gimnasio:
 *  - la banca plana, bajita: se salta;
 *  - la barra en sus soportes, a la altura del pecho: se pasa barriéndose por debajo;
 *  - el rack de sentadillas, una jaula entera: hay que cambiarse de carril.
 * Por el camino hay batidos de proteína; cada uno vale `PUNTOS_BATIDO`. Cada metro corrido es un
 * punto. La velocidad sube poco a poco.
 *
 * Siempre hay por dónde pasar: en cada fila de obstáculos al menos un carril no tiene rack, y
 * entre una fila y la siguiente siempre da tiempo de cambiarse de carril.
 *
 * Aquí solo la lógica (la pinta `ui/pesaRun.ts`). Unidades: metros y segundos; los carriles
 * son -1, 0 y 1. El azar llega como función para poder probarlo.
 */

export const CARRILES = [-1, 0, 1] as const;
export type Carril = (typeof CARRILES)[number];

export const VEL_INICIAL = 11;
export const VEL_MAXIMA = 26;
/** Cuánto sube la velocidad por cada metro corrido. */
export const ACELERACION = 0.012;
export const GRAVEDAD = 30;
export const SALTO = 10;
/** Lo más alto que llega un salto: v² / 2g (≈ 1.67 m). */
export const ALTURA_SALTO = (SALTO * SALTO) / (2 * GRAVEDAD);
/** Cuánto dura barrerse por el piso. */
export const DURACION_BARRIDA = 0.65;
/** Carriles por segundo al cambiarse de carril. */
export const VEL_CARRIL = 11;
export const PUNTOS_BATIDO = 5;

export const ALTO_BANCA = 0.55;
/** La barra está a esta altura: barriéndose se pasa por debajo; de pie o saltando, no. */
export const ALTO_BARRA = 1.0;
/** De la mitad del cuerpo de la mancuerna a cada lado, de frente. */
const PROFUNDIDAD_JUGADORA = 0.35;

export type TipoObstaculo = "banca" | "barra" | "rack";

export const LARGO: Readonly<Record<TipoObstaculo, number>> = { banca: 1.4, barra: 0.3, rack: 1.6 };

export interface Obstaculo {
  carril: Carril;
  /** Dónde empieza (la orilla más cercana), en metros desde la salida. */
  z: number;
  tipo: TipoObstaculo;
}

export interface Batido {
  carril: Carril;
  z: number;
  /** Altura a la que flota (sobre una banca va más alto). */
  alto: number;
  tomado: boolean;
}

export interface Carrera {
  /** Los metros corridos: dónde va la jugadora. */
  z: number;
  vel: number;
  /** Dónde está de lado (de -1 a 1) y a qué carril va. */
  x: number;
  carril: Carril;
  /** Altura del salto y su velocidad. */
  y: number;
  vy: number;
  /** Lo que le queda de barrida (0 = de pie). */
  barrida: number;
  /** Se barre en cuanto toque el piso (se pidió en el aire). */
  barrerAlCaer: boolean;
  obstaculos: Obstaculo[];
  batidos: Batido[];
  batidosTomados: number;
  /** Dónde va la siguiente fila de obstáculos. */
  proximaFila: number;
  terminada: boolean;
  /** Con qué chocó (para pintarlo). */
  choque: Obstaculo | null;
  azar: () => number;
}

/** Qué tan lejos se generan las filas por delante. */
export const VISTA = 90;

export function metros(c: Carrera): number {
  return Math.floor(Math.max(0, c.z));
}

export function puntos(c: Carrera): number {
  return metros(c) + c.batidosTomados * PUNTOS_BATIDO;
}

export function velocidad(z: number): number {
  return Math.min(VEL_MAXIMA, VEL_INICIAL + Math.max(0, z) * ACELERACION);
}

/** Cada 250 m se sube de nivel (más racks y filas más juntas): hasta el 8. */
export const METROS_POR_NIVEL = 250;
export const NIVELES = 8;
export const ZONAS = ["Recepción", "Cardio", "Pesas libres", "Máquinas", "Crossfit", "Powerlifting", "Box", "Olimpo"] as const;

export function nivel(m: number): number {
  return Math.min(NIVELES, 1 + Math.floor(Math.max(0, m) / METROS_POR_NIVEL));
}

/** El tiempo entre fila y fila, en segundos: [mínimo, máximo]. Nunca menos de lo que tarda un salto. */
export function separacion(n: number): [number, number] {
  const tabla: [number, number][] = [[1.25, 1.6], [1.15, 1.5], [1.05, 1.4], [0.98, 1.3], [0.92, 1.2], [0.86, 1.12], [0.8, 1.05], [0.76, 1]];
  return tabla[Math.min(NIVELES, Math.max(1, n)) - 1]!;
}

/** Cuántos obstáculos lleva una fila: más con el nivel, nunca tres racks. */
export function probDos(n: number): number { return [0.25, 0.35, 0.45, 0.52, 0.58, 0.62, 0.66, 0.7][Math.min(NIVELES, n) - 1]!; }
export function probTres(n: number): number { return [0, 0.05, 0.1, 0.15, 0.2, 0.24, 0.28, 0.32][Math.min(NIVELES, n) - 1]!; }
export function probRack(n: number): number { return [0.2, 0.26, 0.32, 0.36, 0.4, 0.43, 0.46, 0.5][Math.min(NIVELES, n) - 1]!; }

function elegir<T>(lista: readonly T[], azar: () => number): T {
  return lista[Math.min(lista.length - 1, Math.floor(azar() * lista.length))]!;
}

function nuevaFila(c: Carrera): void {
  const z = c.proximaFila;
  const n = nivel(z);
  const az = c.azar;
  const r = az();
  const cuantos = r < probTres(n) ? 3 : r < probTres(n) + probDos(n) ? 2 : 1;
  const libres = [...CARRILES].sort(() => az() - 0.5);
  const ocupados = libres.slice(0, cuantos);
  const fila: Obstaculo[] = ocupados.map((carril) => ({
    carril, z, tipo: az() < probRack(n) ? "rack" : az() < 0.5 ? "banca" : "barra",
  }));
  // Nunca los tres carriles con rack: con uno o dos obstáculos queda un carril vacío; con tres,
  // el último rack de más se vuelve banca.
  if (fila.length === 3 && fila.every((o) => o.tipo === "rack")) fila[2]!.tipo = "banca";
  c.obstaculos.push(...fila);

  // Batidos: una línea en un carril libre de esta fila, antes de llegar a ella.
  const [min, max] = separacion(n);
  const gap = (min + az() * (max - min)) * velocidad(z);
  const sinNada = CARRILES.filter((k) => !fila.some((o) => o.carril === k));
  const conBanca = fila.filter((o) => o.tipo === "banca").map((o) => o.carril);
  if (az() < 0.65) {
    const opciones = sinNada.length > 0 ? sinNada : conBanca;
    if (opciones.length > 0) {
      const carril = elegir(opciones, az);
      const sobreBanca = !sinNada.includes(carril);
      const cuantosB = 4 + Math.floor(az() * 3);
      for (let k = 0; k < cuantosB; k++) {
        const bz = z + LARGO.banca / 2 + (k - (cuantosB - 1) / 2) * 1.6;
        if (bz < c.z + 8) continue;
        // Sobre la banca van en arco, para tomarlos saltando.
        const alto = sobreBanca ? 0.6 + Math.max(0, 1.1 - Math.abs(k - (cuantosB - 1) / 2) * 0.3) : 0.5;
        c.batidos.push({ carril, z: bz, alto, tomado: false });
      }
    }
  }
  c.proximaFila = z + Math.max(10, gap);
}

export function nuevaCarrera(azar: () => number = Math.random): Carrera {
  const c: Carrera = {
    z: 0, vel: VEL_INICIAL, x: 0, carril: 0, y: 0, vy: 0, barrida: 0, barrerAlCaer: false,
    obstaculos: [], batidos: [], batidosTomados: 0, proximaFila: 30, terminada: false, choque: null, azar,
  };
  // Al arrancar, unos batidos derechito para calentar.
  for (let k = 0; k < 5; k++) c.batidos.push({ carril: 0, z: 12 + k * 1.6, alto: 0.5, tomado: false });
  while (c.proximaFila < c.z + VISTA) nuevaFila(c);
  return c;
}

export type Accion = "izquierda" | "derecha" | "saltar" | "barrer";

export function accion(c: Carrera, a: Accion): boolean {
  if (c.terminada) return false;
  if (a === "izquierda" || a === "derecha") {
    const nuevo = Math.max(-1, Math.min(1, c.carril + (a === "izquierda" ? -1 : 1))) as Carril;
    if (nuevo === c.carril) return false;
    c.carril = nuevo;
    return true;
  }
  if (a === "saltar") {
    if (c.y > 0.001) return false;
    c.barrida = 0;
    c.vy = SALTO;
    return true;
  }
  // Barrerse: en el aire baja de golpe y se barre al tocar el piso.
  if (c.y > 0.001) { c.vy = Math.min(c.vy, -SALTO * 1.4); c.barrerAlCaer = true; return true; }
  c.barrida = DURACION_BARRIDA;
  return true;
}

export type Evento = "batido" | "choque" | null;

/** ¿Choca con este obstáculo en esta posición? */
export function choca(o: Obstaculo, x: number, y: number, barriendo: boolean): boolean {
  if (Math.abs(x - o.carril) > 0.5) return false;
  if (o.tipo === "rack") return true;
  if (o.tipo === "banca") return y < ALTO_BANCA;
  return !barriendo;
}

/** Avanza `dt` segundos. Devuelve si tomó un batido o si chocó. */
export function avanzar(c: Carrera, dt: number): Evento {
  if (c.terminada) return null;
  c.vel = velocidad(c.z);
  const antes = c.z;
  c.z += c.vel * dt;

  // De lado: va hacia su carril, rápido.
  const d = c.carril - c.x;
  const paso = VEL_CARRIL * dt;
  c.x = Math.abs(d) <= paso ? c.carril : c.x + Math.sign(d) * paso;

  // Salto.
  if (c.y > 0 || c.vy > 0) {
    c.vy -= GRAVEDAD * dt;
    c.y += c.vy * dt;
    if (c.y <= 0) {
      c.y = 0; c.vy = 0;
      if (c.barrerAlCaer) { c.barrida = DURACION_BARRIDA; c.barrerAlCaer = false; }
    }
  }
  if (c.barrida > 0) c.barrida = Math.max(0, c.barrida - dt);
  const barriendo = c.barrida > 0;

  // Choques: lo que pasó por donde va su cuerpo en este cuadro.
  for (const o of c.obstaculos) {
    const ini = o.z - PROFUNDIDAD_JUGADORA, fin = o.z + LARGO[o.tipo] + PROFUNDIDAD_JUGADORA;
    if (c.z < ini || antes > fin) continue;
    if (choca(o, c.x, c.y, barriendo)) {
      c.terminada = true;
      c.choque = o;
      // Se queda justo antes del obstáculo (si venía de frente).
      if (antes <= ini) c.z = ini;
      return "choque";
    }
  }

  let evento: Evento = null;
  for (const b of c.batidos) {
    if (b.tomado || Math.abs(b.carril - c.x) > 0.5) continue;
    if (b.z < antes - 0.5 || b.z > c.z + 0.5) continue;
    // La mancuerna mide ~0.9 m de pie y ~0.4 m barriéndose.
    const alto = barriendo ? 0.4 : 0.95;
    if (b.alto >= c.y - 0.3 && b.alto <= c.y + alto + 0.3) {
      b.tomado = true;
      c.batidosTomados++;
      evento = "batido";
    }
  }

  while (c.proximaFila < c.z + VISTA) nuevaFila(c);
  c.obstaculos = c.obstaculos.filter((o) => o.z + LARGO[o.tipo] > c.z - 6);
  c.batidos = c.batidos.filter((b) => b.z > c.z - 6);
  return evento;
}
