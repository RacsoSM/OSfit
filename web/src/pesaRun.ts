/**
 * Correle pa (entrenador, 2026-11-27): el cuarto juego del Arcade. Un corredor sin fin de tres
 * carriles por el pasillo del gimnasio: la protagonista es una mancuerna con ojos y patitas que
 * corre sola hacia adelante. Con el dedo se cambia de carril (deslizar a los lados), se salta
 * (hacia arriba) y se barre por el piso (hacia abajo).
 *
 * Los obstáculos son del gimnasio:
 *  - la banca plana, bajita: se salta;
 *  - la barra en sus soportes, a la altura del pecho: se pasa barriéndose por debajo;
 *  - la máquina de proteína, una expendedora alta y maciza: solo se esquiva (entrenador,
 *    2026-11-27: antes era un rack, pero por ser jaula daba la impresión de que se pasaba abajo);
 *  - las colchonetas apiladas, largas y altas: a veces traen una cuña para subir corriendo; si
 *    no, se sube saltando. Arriba se corre por encima (con batidos) y al final se cae al piso.
 *    Chocar de frente o de lado contra ellas, abajo de su tapa, termina la carrera.
 * Por el camino hay batidos de proteína; cada uno vale `PUNTOS_BATIDO`. Cada metro corrido es un
 * punto. La velocidad sube poco a poco.
 *
 * Siempre hay por dónde pasar: en cada fila de obstáculos al menos un carril no tiene máquina, y
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

export type TipoObstaculo = "banca" | "barra" | "maquina" | "colchoneta";

/** El largo de cada obstáculo; las colchonetas traen el suyo (`largo`). */
export const LARGO: Readonly<Record<TipoObstaculo, number>> = { banca: 1.4, barra: 0.3, maquina: 1.0, colchoneta: 12 };

/** La altura de la pila de colchonetas y el largo de su cuña de subida. */
export const ALTO_COLCHONETA = 1.3;
export const RAMPA = 3.5;
/** Cuánto más abajo de la tapa todavía se "sube" al caer encima (en vez de chocar). */
const TOLERANCIA_TAPA = 0.4;

export interface Obstaculo {
  carril: Carril;
  /** Dónde empieza (la orilla más cercana), en metros desde la salida. */
  z: number;
  tipo: TipoObstaculo;
  /** Solo colchonetas: su largo y si traen cuña para subir corriendo. */
  largo?: number;
  rampa?: boolean;
}

export function largoDe(o: Obstaculo): number {
  return o.tipo === "colchoneta" ? o.largo ?? LARGO.colchoneta : LARGO[o.tipo];
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
  /** Altura (sobre el piso del gimnasio) y su velocidad. */
  y: number;
  vy: number;
  /** Lo que le queda de barrida (0 = de pie). */
  barrida: number;
  /** Se barre en cuanto toque el piso (se pidió en el aire). */
  barrerAlCaer: boolean;
  /** La altura de lo que tiene debajo: el piso (0) o la tapa de unas colchonetas. */
  suelo: number;
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

/** Cada 250 m se sube de nivel (más máquinas y filas más juntas): hasta el 8. */
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

/** Cuántos obstáculos lleva una fila: más con el nivel, nunca tres máquinas. */
export function probDos(n: number): number { return [0.25, 0.35, 0.45, 0.52, 0.58, 0.62, 0.66, 0.7][Math.min(NIVELES, n) - 1]!; }
export function probTres(n: number): number { return [0, 0.05, 0.1, 0.15, 0.2, 0.24, 0.28, 0.32][Math.min(NIVELES, n) - 1]!; }
export function probColchonetas(n: number): number { return [0.12, 0.2, 0.24, 0.26, 0.28, 0.3, 0.3, 0.32][Math.min(NIVELES, n) - 1]!; }
export function probMaquina(n: number): number { return [0.2, 0.26, 0.32, 0.36, 0.4, 0.43, 0.46, 0.5][Math.min(NIVELES, n) - 1]!; }

function elegir<T>(lista: readonly T[], azar: () => number): T {
  return lista[Math.min(lista.length - 1, Math.floor(azar() * lista.length))]!;
}

/**
 * Una fila de colchonetas: de una a tres pilas largas, lado a lado. Con tres, al menos una trae
 * cuña (con menos, queda un carril libre). Encima de una, una línea de batidos.
 */
function filaColchonetas(c: Carrera, z: number, n: number): void {
  const az = c.azar;
  const r = az();
  const cuantos = r < 0.25 ? 3 : r < 0.6 ? 2 : 1;
  const carriles = [...CARRILES].sort(() => az() - 0.5).slice(0, cuantos);
  const largo = 9 + Math.floor(az() * 10);
  const pilas: Obstaculo[] = carriles.map((carril) => ({ carril, z, tipo: "colchoneta", largo, rampa: az() < 0.65 }));
  if (cuantos === 3 && !pilas.some((o) => o.rampa)) pilas[0]!.rampa = true;
  c.obstaculos.push(...pilas);
  if (az() < 0.75) {
    const arriba = elegir(pilas, az);
    for (let bz = z + RAMPA + 1; bz < z + largo - 1; bz += 1.6) c.batidos.push({ carril: arriba.carril, z: bz, alto: ALTO_COLCHONETA + 0.5, tomado: false });
  }
  const [min, max] = separacion(n);
  c.proximaFila = z + largo + Math.max(10, (min + az() * (max - min)) * velocidad(z));
}

function nuevaFila(c: Carrera): void {
  const z = c.proximaFila;
  const n = nivel(z);
  const az = c.azar;
  if (az() < probColchonetas(n)) { filaColchonetas(c, z, n); return; }
  const r = az();
  const cuantos = r < probTres(n) ? 3 : r < probTres(n) + probDos(n) ? 2 : 1;
  const libres = [...CARRILES].sort(() => az() - 0.5);
  const ocupados = libres.slice(0, cuantos);
  const fila: Obstaculo[] = ocupados.map((carril) => ({
    carril, z, tipo: az() < probMaquina(n) ? "maquina" : az() < 0.5 ? "banca" : "barra",
  }));
  // Nunca los tres carriles con máquina: con uno o dos obstáculos queda un carril vacío; con
  // tres, la última máquina de más se vuelve banca.
  if (fila.length === 3 && fila.every((o) => o.tipo === "maquina")) fila[2]!.tipo = "banca";
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
    z: 0, vel: VEL_INICIAL, x: 0, carril: 0, y: 0, vy: 0, barrida: 0, barrerAlCaer: false, suelo: 0,
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
    if (enAire(c)) return false;
    c.barrida = 0;
    c.vy = SALTO;
    return true;
  }
  // Barrerse: en el aire baja de golpe y se barre al tocar el piso.
  if (enAire(c)) { c.vy = Math.min(c.vy, -SALTO * 1.4); c.barrerAlCaer = true; return true; }
  c.barrida = DURACION_BARRIDA;
  return true;
}

export type Evento = "batido" | "choque" | null;

/** ¿Va en el aire (más arriba de lo que tiene debajo)? */
export function enAire(c: Carrera): boolean {
  return c.y > c.suelo + 0.01;
}

/** ¿Está su cuerpo dentro de esa pila de colchonetas (de lado)? */
function sobreCarril(o: Obstaculo, x: number): boolean {
  return Math.abs(x - o.carril) <= 0.5;
}

/** La altura de lo que hay debajo en (x, z): el piso, la cuña o la tapa de unas colchonetas. */
export function sueloEn(obstaculos: readonly Obstaculo[], x: number, z: number): number {
  let h = 0;
  for (const o of obstaculos) {
    if (o.tipo !== "colchoneta" || !sobreCarril(o, x) || z < o.z || z > o.z + largoDe(o)) continue;
    const enCuna = o.rampa && z < o.z + RAMPA;
    h = Math.max(h, enCuna ? (ALTO_COLCHONETA * (z - o.z)) / RAMPA : ALTO_COLCHONETA);
  }
  return h;
}

/** ¿Se estrella contra la parte maciza de unas colchonetas (de frente o de lado, abajo de su tapa)? */
function contraColchonetas(c: Carrera): Obstaculo | null {
  for (const o of c.obstaculos) {
    if (o.tipo !== "colchoneta" || !sobreCarril(o, c.x)) continue;
    const ini = o.z + (o.rampa ? RAMPA : 0) - PROFUNDIDAD_JUGADORA;
    if (c.z < ini || c.z > o.z + largoDe(o)) continue;
    if (c.y < ALTO_COLCHONETA - TOLERANCIA_TAPA) return o;
  }
  return null;
}

/** ¿Choca con este obstáculo en esta posición? */
export function choca(o: Obstaculo, x: number, y: number, barriendo: boolean): boolean {
  if (Math.abs(x - o.carril) > 0.5) return false;
  if (o.tipo === "colchoneta") return y < ALTO_COLCHONETA - TOLERANCIA_TAPA;
  if (o.tipo === "maquina") return true;
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

  // Las colchonetas: chocar contra su parte maciza termina la carrera.
  const pila = contraColchonetas(c);
  if (pila) {
    c.terminada = true;
    c.choque = pila;
    return "choque";
  }
  // Salto y caída: sobre el piso, la cuña o la tapa de las colchonetas.
  const suelo = sueloEn(c.obstaculos, c.x, c.z);
  if (c.y > suelo + 0.001 || c.vy > 0) {
    c.vy -= GRAVEDAD * dt;
    c.y += c.vy * dt;
    if (c.y <= suelo) {
      c.y = suelo; c.vy = 0;
      if (c.barrerAlCaer) { c.barrida = DURACION_BARRIDA; c.barrerAlCaer = false; }
    }
  } else {
    // Sube por la cuña, o se sube a la tapa si cayó apenas abajo de ella.
    c.y = suelo; c.vy = 0;
  }
  c.suelo = suelo;
  if (c.barrida > 0) c.barrida = Math.max(0, c.barrida - dt);
  const barriendo = c.barrida > 0;

  // Choques: lo que pasó por donde va su cuerpo en este cuadro.
  for (const o of c.obstaculos) {
    if (o.tipo === "colchoneta") continue;
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
  c.obstaculos = c.obstaculos.filter((o) => o.z + largoDe(o) > c.z - 6);
  c.batidos = c.batidos.filter((b) => b.z > c.z - 6);
  return evento;
}
