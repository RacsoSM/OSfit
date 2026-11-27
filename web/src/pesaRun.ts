/**
 * Correle pa (entrenador, 2026-11-27): el cuarto juego del Arcade. Un corredor sin fin de tres
 * carriles por el pasillo del gimnasio: la protagonista es una mancuerna con ojos y patitas que
 * corre sola hacia adelante. Con el dedo se cambia de carril (deslizar a los lados), se salta
 * (hacia arriba) y se barre por el piso (hacia abajo).
 *
 * Los obstáculos son del gimnasio:
 *  - la banca plana, bajita: se salta;
 *  - la barra en sus soportes, a la altura del pecho: se pasa barriéndose por debajo o brincándola;
 *  - la máquina de proteína, una expendedora alta y maciza: solo se esquiva (entrenador,
 *    2026-11-27: antes era un rack, pero por ser jaula daba la impresión de que se pasaba abajo);
 *  - las colchonetas apiladas, largas y altas: solo se sube por la cuña que a veces traen (de un
 *    brinco desde el piso, no). Arriba se corre por encima (con batidos) y al final se cae al piso.
 *    Chocar de frente o de lado contra ellas, abajo de su tapa, termina la carrera.
 *  - el carrito de discos, que viene rodando por un carril directo hacia la mancuerna: solo se
 *    esquiva cambiándose de carril (entrenador, 2026-11-27).
 * Desde el nivel 2 hay rutas elevadas de unos 15 segundos (entrenador, 2026-11-27): el piso se
 * vuelve una fosa de cubos de hule espuma (caer ahí es perder) y se va por encima de las
 * colchonetas, brincando huecos, pasándose de una pila a otra y esquivando lo que hay arriba.
 * También hay circuitos de colchonetas más cortos: un tramo en que el piso de los tres carriles
 * está cerrado por máquinas y hay que subir por la cuña e ir pasándose de una pila a la de al
 * lado antes de que se acabe la que se pisa.
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
export const VEL_MAXIMA = 28;
/** Cuánto sube la velocidad por cada metro corrido. */
export const ACELERACION = 0.014;
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

export type TipoObstaculo = "banca" | "barra" | "maquina" | "colchoneta" | "carro" | "fosa";

/** El largo de cada obstáculo; las colchonetas traen el suyo (`largo`). */
export const LARGO: Readonly<Record<TipoObstaculo, number>> = { banca: 1.4, barra: 0.3, maquina: 1.0, colchoneta: 12, carro: 1.4, fosa: 20 };

/** La altura de la pila de colchonetas y el largo de su cuña de subida. */
/**
 * Más altas que lo que alcanza un salto (`ALTURA_SALTO`, ~1.67 m): a la vista queda claro que
 * sin cuña no se llega (entrenador, 2026-11-27). La cuña, larga, para que la subida no sea tan
 * empinada.
 */
export const ALTO_COLCHONETA = 2.0;
export const RAMPA = 5;
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
  /** Si se mueve: su velocidad a lo largo (negativa = viene hacia la mancuerna). */
  vz?: number;
  /** Si espera: empieza a moverse cuando la mancuerna está a esta distancia (o menos). */
  activa?: number;
  /** Hasta dónde llega rodando (la orilla de la colchoneta por la que va): ahí se detiene. */
  tope?: number;
  /** Si está encima de unas colchonetas: la altura de donde se apoya. */
  base?: number;
}

/** Qué tan rápido rueda el carrito de discos hacia la mancuerna. */
export const VEL_CARRO = 7;

export function largoDe(o: Obstaculo): number {
  return o.tipo === "colchoneta" || o.tipo === "fosa" ? o.largo ?? LARGO[o.tipo] : LARGO[o.tipo];
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
  /** Desde qué altura despegó en el último salto o caída: desde el piso no se sube a las colchonetas. */
  despegue: number;
  obstaculos: Obstaculo[];
  batidos: Batido[];
  batidosTomados: number;
  /** Dónde va la siguiente fila de obstáculos. */
  proximaFila: number;
  /** Dónde terminó el último circuito de colchonetas y dónde salió el último carrito. */
  ultimoCircuito: number;
  ultimoCarro: number;
  ultimaRuta: number;
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
/**
 * Dónde empieza cada nivel, en metros (entrenador, 2026-11-27: "que tardes más en pasar de nivel
 * ya que vas notablemente más rápido"). Cada nivel es más largo que el anterior: 250, 400, 550,
 * 700, 900, 1100 y 1300 m, así duran de ~20 s al principio a ~46 s en los últimos; el 8 no acaba.
 */
export const INICIO_NIVEL = [0, 250, 650, 1200, 1900, 2800, 3900, 5200] as const;
export const NIVELES = 8;
export const ZONAS = ["Recepción", "Cardio", "Pesas libres", "Máquinas", "Crossfit", "Powerlifting", "Box", "Olimpo"] as const;

/** El nivel (de 1 a 8) en ese metro. */
export function nivel(m: number): number {
  let n = 1;
  while (n < NIVELES && Math.max(0, m) >= INICIO_NIVEL[n]!) n++;
  return n;
}

/** El tramo de metros de la zona `i` (de 0 a 7): el último no acaba. */
export function tramoZona(i: number): [number, number] {
  return [INICIO_NIVEL[i]!, i + 1 < NIVELES ? INICIO_NIVEL[i + 1]! : Number.POSITIVE_INFINITY];
}

/** El tiempo entre fila y fila, en segundos: [mínimo, máximo]. Nunca menos de lo que tarda un salto. */
export function separacion(n: number): [number, number] {
  const tabla: [number, number][] = [[1.15, 1.5], [1.05, 1.4], [0.98, 1.3], [0.92, 1.2], [0.86, 1.12], [0.82, 1.05], [0.78, 1], [0.75, 0.95]];
  return tabla[Math.min(NIVELES, Math.max(1, n)) - 1]!;
}

/** Cuántos obstáculos lleva una fila: más con el nivel, nunca tres máquinas. */
export function probDos(n: number): number { return [0.3, 0.42, 0.5, 0.56, 0.6, 0.62, 0.64, 0.66][Math.min(NIVELES, n) - 1]!; }
export function probTres(n: number): number { return [0.03, 0.1, 0.16, 0.22, 0.27, 0.31, 0.34, 0.37][Math.min(NIVELES, n) - 1]!; }
/** Los circuitos de colchonetas (desde el nivel 2, separados al menos 250 m) y los carritos (desde el 3). */
export function probCircuito(n: number): number { return n < 2 ? 0 : 0.14; }
export const SEPARACION_CIRCUITOS = 250;
/** Las rutas elevadas: desde el nivel 2, separadas al menos 450 m. */
export function probRuta(n: number): number { return n < 2 ? 0 : 0.3; }
export const SEPARACION_RUTAS = 450;
export const SEGUNDOS_RUTA = 15;
/** Carritos (entrenador, 2026-11-27: "que existan más carritos"): desde el nivel 2, cada vez más; desde el 5, a veces dos a la vez. */
export function probCarro(n: number): number { return n < 2 ? 0 : [0, 0.16, 0.22, 0.26, 0.3, 0.33, 0.36, 0.4][Math.min(NIVELES, n) - 1]!; }
export function probDosCarros(n: number): number { return n < 5 ? 0 : [0, 0, 0, 0, 0.25, 0.32, 0.38, 0.45][Math.min(NIVELES, n) - 1]!; }
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

/** ¿Hay unas colchonetas en ese carril que tapen de `z0` a `z1`? */
function tapada(c: Carrera, carril: Carril, z0: number, z1: number): boolean {
  return c.obstaculos.some((o) => o.tipo === "colchoneta" && o.carril === carril && o.z < z1 && o.z + largoDe(o) > z0);
}

/**
 * Un circuito de colchonetas (entrenador, 2026-11-27: "puntos donde obligatoriamente tengas que
 * subir por colchonetas y que tengas que cambiar entre ellas"). De tres a cuatro pilas, cada una
 * en el carril de al lado de la anterior y encimadas un tramo, para pasarse de una a otra por
 * arriba. La primera trae cuña. Abajo, máquinas cierran el piso: al empezar, en los otros dos
 * carriles; en cada cambio, en el carril que queda libre; y al final de cada pila, en su
 * carril. Arriba, batidos marcan el camino.
 */
export function circuito(c: Carrera, z: number): void {
  const az = c.azar;
  const vel = velocidad(z);
  // Lo encimado: tiempo de sobra para cambiarse de carril arriba.
  const encimado = Math.max(7, vel * 0.8);
  const n = 3 + (az() < 0.5 ? 1 : 0);
  const pilas: Obstaculo[] = [];
  let carril = elegir(CARRILES, az);
  let ini = z;
  for (let k = 0; k < n; k++) {
    const largo = (k === 0 ? RAMPA + 12 : 12) + Math.floor(az() * 5) + encimado;
    pilas.push({ carril, z: ini, tipo: "colchoneta", largo, rampa: k === 0 });
    ini = ini + largo - encimado;
    carril = (carril === 0 ? (az() < 0.5 ? -1 : 1) : 0) as Carril;
  }
  c.obstaculos.push(...pilas);
  const maquina = (carril: Carril, zm: number) => {
    if (!tapada(c, carril, zm - 0.5, zm + LARGO.maquina + 0.5)) c.obstaculos.push({ carril, z: zm, tipo: "maquina" });
  };
  for (const k of CARRILES) if (k !== pilas[0]!.carril) maquina(k, z + 1);
  pilas.forEach((p, k) => {
    const sig = pilas[k + 1];
    if (sig) {
      for (const l of CARRILES) if (l !== p.carril && l !== sig.carril) maquina(l, sig.z);
      maquina(p.carril, p.z + largoDe(p) + 0.4);
    }
    // Los batidos van arriba, hasta la mitad de lo encimado: ahí toca cambiarse.
    const desde = p.z + (p.rampa ? RAMPA + 1 : 1.5), hasta = sig ? sig.z + encimado * 0.4 : p.z + largoDe(p) - 1;
    for (let bz = desde; bz < hasta; bz += 1.6) c.batidos.push({ carril: p.carril, z: bz, alto: ALTO_COLCHONETA + 0.5, tomado: false });
  });
  const fin = pilas[pilas.length - 1]!;
  c.ultimoCircuito = fin.z + largoDe(fin);
  c.proximaFila = c.ultimoCircuito + Math.max(12, vel * 1.1);
}

/**
 * Un carrito de discos que rueda hacia la mancuerna por un carril (entrenador, 2026-11-27: "algún
 * obstáculo que venga en algún carril directo hacia ti"). Sale lejos, fuera de la vista; se
 * calcula dónde se van a cruzar y en su carril, de ahí hasta donde sale, se quita todo lo demás
 * (que no lo atraviese). Cerca del cruce, las máquinas de los otros carriles se vuelven bancas:
 * siempre hay a dónde hacerse a un lado. No sale si en su camino hay colchonetas.
 */
export function carro(c: Carrera, z: number, dos = false): boolean {
  const az = c.azar;
  const t = Math.max(0, z - c.z) / (c.vel + VEL_CARRO);
  const cruce = c.z + c.vel * t;
  const desde = cruce - 18;
  if (c.obstaculos.some((o) => (o.tipo === "colchoneta" || o.tipo === "fosa") && o.z < z + 8 && o.z + largoDe(o) > desde)) return false;
  // Con dos: en dos carriles distintos, el segundo un poco más atrás; el tercero queda libre.
  const carriles = [...CARRILES].sort(() => az() - 0.5).slice(0, dos ? 2 : 1);
  for (const carril of carriles) {
    c.obstaculos = c.obstaculos.filter((o) => !(o.carril === carril && o.z + largoDe(o) > desde && o.z < z + 8));
    c.batidos = c.batidos.filter((b) => !(b.carril === carril && b.z > desde && b.z < z + 8));
  }
  for (const o of c.obstaculos) if (o.tipo === "maquina" && Math.abs(o.z - cruce) < 18) o.tipo = "banca";
  carriles.forEach((carril, k) => c.obstaculos.push({ carril, z: z + k * 6, tipo: "carro", vz: -VEL_CARRO }));
  c.ultimoCarro = z;
  return true;
}

/**
 * La ruta elevada (entrenador, 2026-11-27: "15 segundos enteros donde el juego te obligue a ir
 * por encima de las colchonetas y tengas que brincar entre ellas o esquivar algún obstáculo
 * ahí"). Unos `SEGUNDOS_RUTA` de colchonetas encadenadas sobre una fosa de hule espuma que cubre
 * los tres carriles. Se entra por una cuña y luego, tramo por tramo, toca:
 *  - brincar un hueco a la siguiente pila del mismo carril;
 *  - pasarse a la pila del carril de al lado, encimada un tramo;
 *  - en una pila doble (dos carriles juntos), esquivar una máquina pasándose a la otra;
 *  - en una pila doble, esquivar un carrito de discos que viene rodando por encima de una de
 *    ellas (entrenador, 2026-11-27);
 * y encima hay bancas para saltar y barras para barrerse. Los batidos marcan el camino.
 */
export function rutaElevada(c: Carrera, z: number): void {
  const az = c.azar;
  const vel = velocidad(z);
  const fin = z + RAMPA + vel * SEGUNDOS_RUTA;
  const encimado = Math.max(7, vel * 0.8);
  const hueco = Math.max(2.5, vel * 0.28);
  const arriba = ALTO_COLCHONETA;
  const batidos = (carril: Carril, z0: number, z1: number, alto = arriba + 0.5) => {
    for (let bz = z0; bz < z1; bz += 1.6) c.batidos.push({ carril, z: bz, alto, tomado: false });
  };
  // Empieza en una orilla: el primer cambio es el cruce de extremo a extremo.
  let carril: Carril = az() < 0.5 ? -1 : 1;
  let zc = z;
  let primera = true;
  let cruces = 0;
  let trasCruce = false;
  while (zc < fin - 10) {
    // Largas según la velocidad: cabe algo encima, el aterrizaje y el siguiente brinco.
    const largo = Math.min(fin - zc, (primera ? RAMPA : 0) + 12 + vel * 1.8 + Math.floor(az() * 8));
    const pila: Obstaculo = { carril, z: zc, tipo: "colchoneta", largo, rampa: primera };
    c.obstaculos.push(pila);
    // Lo de encima, lejos del final: tras brincarlo (o barrerse) hay que alcanzar a aterrizar y
    // todavía brincar el hueco o cambiarse de pila.
    // Y lejos del principio: tras brincar el hueco anterior hay que alcanzar a aterrizar.
    // El cruce de extremo a extremo (entrenador, 2026-11-27): en una orilla, una máquina corta la
    // pila y el camino sigue en la otra orilla; en medio solo hay fosa. Hay que brincar y dar
    // dos swipes en el aire. Siempre hay al menos uno por ruta; los demás, de vez en cuando.
    const cruce = carril !== 0 && zc + largo < fin - 20 && (cruces === 0 || az() < 0.3);
    const util0 = zc + (primera ? RAMPA + 2 : vel * 0.75 + 2), util1 = zc + largo - (cruce ? vel * 1.5 + 3 : vel * 0.8 + 3);
    // Lo de encima: a veces una pila doble con una máquina que obliga a cambiarse; si no, una banca o una barra.
    const r = az();
    let destino = carril;
    // (La pila que sigue a un cruce no es doble: su gemela quedaría en medio y bastaría un swipe.)
    if (!cruce && !trasCruce && !primera && r < 0.2 && util1 - util0 > 10) {
      // Pila doble con un carrito que viene por encima de una de las dos: hay que estar en la otra.
      const otro = (carril === 0 ? (az() < 0.5 ? -1 : 1) : 0) as Carril;
      c.obstaculos.push({ carril: otro, z: zc, tipo: "colchoneta", largo, rampa: false });
      const conCarro = az() < 0.5 ? carril : otro, libre = conCarro === carril ? otro : carril;
      // Espera quieto al fondo de la pila y arranca cuando la mancuerna se acerca: así se cruzan
      // dentro de la pila, con tiempo de sobra para cambiarse (~1.5 s).
      const zCarro = zc + largo - LARGO.carro - 0.5;
      const activa = Math.min(48, Math.max(25, 1.5 * (vel + VEL_CARRO)));
      c.obstaculos.push({ carril: conCarro, z: zCarro, tipo: "carro", vz: -VEL_CARRO, base: arriba, activa, tope: zc + 1 });
      batidos(libre, util0, util1);
      destino = libre;
    } else if (!cruce && !trasCruce && !primera && r < 0.45 && util1 - util0 > 10) {
      const otro = (carril === 0 ? (az() < 0.5 ? -1 : 1) : 0) as Carril;
      c.obstaculos.push({ carril: otro, z: zc, tipo: "colchoneta", largo, rampa: false });
      const zm = (util0 + util1) / 2;
      c.obstaculos.push({ carril, z: zm, tipo: "maquina", base: arriba });
      batidos(carril, util0, zm - vel * 0.6);
      batidos(otro, zm - vel * 0.35, util1);
      destino = otro;
    } else if (r < 0.8 && util1 - util0 > 6) {
      const zo = util0 + (util1 - util0) * (0.4 + az() * 0.2);
      const tipo: TipoObstaculo = az() < 0.5 ? "banca" : "barra";
      c.obstaculos.push({ carril, z: zo, tipo, base: arriba });
      batidos(carril, util0, zo - 3);
      if (tipo === "banca") for (let k = -1; k <= 1; k++) c.batidos.push({ carril, z: zo + LARGO.banca / 2 + k * 1.6, alto: arriba + ALTO_BANCA + 0.9 - Math.abs(k) * 0.3, tomado: false });
      batidos(carril, zo + 3, util1);
    } else batidos(carril, util0, util1);
    carril = destino;
    if (cruce) {
      const zm = zc + largo - LARGO.maquina;
      c.obstaculos.push({ carril, z: zm, tipo: "maquina", base: arriba });
      const otro = -carril as Carril;
      // Los batidos dibujan el brinco: sobre la fosa de en medio y aterrizando del otro lado.
      c.batidos.push({ carril: 0, z: zm - vel * 0.12, alto: arriba + 1.3, tomado: false });
      c.batidos.push({ carril: otro, z: zm + vel * 0.12, alto: arriba + 0.9, tomado: false });
      // La pila de la otra orilla empieza antes de la máquina: el brinco cae en ella.
      zc = zm - vel * 0.55;
      carril = otro;
      primera = false;
      cruces++;
      trasCruce = true;
      continue;
    }
    trasCruce = false;
    zc = zc + largo;
    primera = false;
    if (zc >= fin - 10) break;
    // La transición al siguiente tramo: brincar un hueco o pasarse al carril de al lado.
    if (az() < 0.5) {
      // Batidos en arco sobre el hueco.
      for (let k = 0; k < 3; k++) c.batidos.push({ carril, z: zc - 1 + k * (hueco + 2) / 2, alto: arriba + 0.9 + (k === 1 ? 0.6 : 0), tomado: false });
      zc += hueco;
    } else {
      const sig = (carril === 0 ? (az() < 0.5 ? -1 : 1) : 0) as Carril;
      // La siguiente empieza antes de que se acabe esta (encimadas), en el carril de al lado.
      const ultima = c.obstaculos.filter((o) => o.tipo === "colchoneta" && o.carril === carril).at(-1)!;
      ultima.largo = largoDe(ultima) + encimado;
      zc = zc + encimado * 0.1;
      carril = sig;
    }
  }
  const finReal = Math.max(...c.obstaculos.filter((o) => o.tipo === "colchoneta" && o.z >= z).map((o) => o.z + largoDe(o)));
  // La fosa de hule espuma bajo todo, después de la cuña.
  for (const k of CARRILES) c.obstaculos.push({ carril: k, z: z + RAMPA + 0.5, tipo: "fosa", largo: finReal - (z + RAMPA + 0.5) });
  c.ultimoCircuito = finReal;
  c.ultimaRuta = finReal;
  c.proximaFila = finReal + Math.max(12, vel * 1.1);
}

function nuevaFila(c: Carrera): void {
  const z = c.proximaFila;
  const n = nivel(z);
  const az = c.azar;
  if (z - c.ultimaRuta > SEPARACION_RUTAS && z - c.ultimoCircuito > 120 && az() < probRuta(n)) { rutaElevada(c, z); return; }
  if (z - c.ultimoCircuito > SEPARACION_CIRCUITOS && az() < probCircuito(n)) { circuito(c, z); return; }
  if (z - c.ultimoCarro > 40 && az() < probCarro(n) && carro(c, z, az() < probDosCarros(n))) {
    const [min, max] = separacion(n);
    c.proximaFila = z + Math.max(10, (min + az() * (max - min)) * velocidad(z));
    return;
  }
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
    z: 0, vel: VEL_INICIAL, x: 0, carril: 0, y: 0, vy: 0, barrida: 0, barrerAlCaer: false, suelo: 0, despegue: 0,
    obstaculos: [], batidos: [], batidosTomados: 0, proximaFila: 30, ultimoCircuito: 0, ultimoCarro: 0, ultimaRuta: 0, terminada: false, choque: null, azar,
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
    c.despegue = c.suelo;
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

/**
 * ¿Se estrella contra la parte maciza de unas colchonetas? De frente o de lado abajo de su tapa,
 * o llegando por el aire desde el piso (entrenador, 2026-11-27: "que no puedas subir a las
 * colchonetas de un salto, solamente subiendo por la rampa"). Desde otra colchoneta o desde la
 * cuña sí se llega brincando.
 */
function contraColchonetas(c: Carrera): Obstaculo | null {
  const delPiso = c.y > c.suelo + 0.01 && c.despegue < 0.05;
  for (const o of c.obstaculos) {
    if (o.tipo !== "colchoneta" || !sobreCarril(o, c.x)) continue;
    const ini = o.z + (o.rampa ? RAMPA : 0) - PROFUNDIDAD_JUGADORA;
    if (c.z < ini || c.z > o.z + largoDe(o)) continue;
    if (c.y < ALTO_COLCHONETA - TOLERANCIA_TAPA || delPiso) return o;
  }
  return null;
}

/** ¿Choca con este obstáculo en esta posición? */
export function choca(o: Obstaculo, x: number, y: number, barriendo: boolean): boolean {
  if (Math.abs(x - o.carril) > 0.5) return false;
  if (o.tipo === "colchoneta") return y < ALTO_COLCHONETA - TOLERANCIA_TAPA;
  // La fosa: solo si se cae hasta el fondo.
  if (o.tipo === "fosa") return y < 0.15;
  // Lo que está encima de unas colchonetas cuenta desde su tapa.
  y -= o.base ?? 0;
  if (o.tipo === "maquina" || o.tipo === "carro") return true;
  if (o.tipo === "banca") return y < ALTO_BANCA;
  // La barra: barriéndose por debajo o brincándola por encima (entrenador, 2026-11-27).
  return !barriendo && y < ALTO_BARRA + 0.1;
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

  // Lo que rueda (el carrito de discos) avanza hacia ella; el que espera, hasta que se acerca; el
  // que va encima de unas colchonetas se detiene en la orilla.
  for (const o of c.obstaculos) {
    if (!o.vz || (o.activa !== undefined && o.z - c.z > o.activa)) continue;
    o.z += o.vz * dt;
    if (o.tope !== undefined && o.z < o.tope) o.z = o.tope;
  }
  // Las colchonetas: chocar contra su parte maciza termina la carrera.
  const pila = contraColchonetas(c);
  if (pila) {
    c.terminada = true;
    c.choque = pila;
    return "choque";
  }
  // Salto y caída: sobre el piso, la cuña o la tapa de las colchonetas.
  const pisaba = c.y <= c.suelo + 0.01, sueloAntes = c.suelo;
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
  // Si se le acabó lo que pisaba (salió de una orilla), cae desde esa altura.
  if (pisaba && c.y > suelo + 0.01 && c.vy <= 0) c.despegue = sueloAntes;
  c.suelo = suelo;
  if (c.barrida > 0) c.barrida = Math.max(0, c.barrida - dt);
  const barriendo = c.barrida > 0;

  // Choques: lo que pasó por donde va su cuerpo en este cuadro.
  for (const o of c.obstaculos) {
    if (o.tipo === "colchoneta") continue;
    // Si se mueve, cuenta también lo que recorrió en este cuadro (no se "atraviesan").
    const ini = o.z - PROFUNDIDAD_JUGADORA, fin = o.z + largoDe(o) + PROFUNDIDAD_JUGADORA + Math.abs(o.vz ?? 0) * dt;
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
