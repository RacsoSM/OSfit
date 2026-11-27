import { describe, expect, it } from "vitest";
import {
  ALTO_BANCA, ALTO_COLCHONETA, ALTURA_SALTO, RAMPA, SEGUNDOS_RUTA, VEL_CARRO, carro, circuito, enAire, rutaElevada, largoDe, sueloEn, CARRILES, PUNTOS_BATIDO, VEL_INICIAL, VEL_MAXIMA, accion, avanzar, choca, metros, nivel, nuevaCarrera, puntos,
  separacion, velocidad, type Carrera, type Obstaculo,
} from "./pesaRun";

function semilla(n: number): () => number {
  let s = n;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function vacia(): Carrera {
  const c = nuevaCarrera(semilla(1));
  c.obstaculos = []; c.batidos = []; c.proximaFila = 1e9;
  return c;
}

describe("Correle pa", () => {
  it("corre sola hacia adelante y acelera hasta un tope", () => {
    const c = vacia();
    for (let i = 0; i < 60; i++) avanzar(c, 1 / 60);
    expect(c.z).toBeCloseTo(VEL_INICIAL, 0);
    expect(metros(c)).toBeGreaterThan(9);
    expect(velocidad(100_000)).toBe(VEL_MAXIMA);
  });

  it("cambia de carril sin salirse de los tres", () => {
    const c = vacia();
    expect(accion(c, "izquierda")).toBe(true);
    expect(accion(c, "izquierda")).toBe(false);
    for (let i = 0; i < 20; i++) avanzar(c, 1 / 60);
    expect(c.x).toBe(-1);
    accion(c, "derecha"); accion(c, "derecha"); accion(c, "derecha");
    for (let i = 0; i < 20; i++) avanzar(c, 1 / 60);
    expect(c.x).toBe(1);
  });

  it("el salto pasa la banca; la barrida pasa la barra; la máquina de proteína solo se esquiva", () => {
    const banca: Obstaculo = { carril: 0, z: 0, tipo: "banca" };
    const barra: Obstaculo = { carril: 0, z: 0, tipo: "barra" };
    const maquina: Obstaculo = { carril: 0, z: 0, tipo: "maquina" };
    expect(ALTURA_SALTO).toBeGreaterThan(ALTO_BANCA * 2);
    expect(choca(banca, 0, 0, false)).toBe(true);
    expect(choca(banca, 0, ALTO_BANCA + 0.1, false)).toBe(false);
    expect(choca(barra, 0, 0, false)).toBe(true);
    expect(choca(barra, 0, 1, false)).toBe(true);
    expect(choca(barra, 0, 0, true)).toBe(false);
    // La barra también se brinca por encima.
    expect(choca(barra, 0, 1.2, false)).toBe(false);
    expect(choca(maquina, 0, 0, false)).toBe(true);
    expect(choca(maquina, 0, 1.5, false)).toBe(true);
    expect(choca(maquina, 0, 0, true)).toBe(true);
    expect(choca(maquina, 1, 0, false)).toBe(false);
  });

  it("chocar termina la carrera; saltar a tiempo no", () => {
    const c = vacia();
    c.obstaculos = [{ carril: 0, z: 6, tipo: "banca" }];
    let ev = null;
    for (let i = 0; i < 120 && !c.terminada; i++) ev = avanzar(c, 1 / 60);
    expect(ev).toBe("choque");
    expect(c.choque?.tipo).toBe("banca");

    const d = vacia();
    d.obstaculos = [{ carril: 0, z: 8, tipo: "banca" }];
    for (let i = 0; i < 120 && !d.terminada; i++) {
      if (d.z > 4 && d.y === 0 && d.vy === 0) accion(d, "saltar");
      avanzar(d, 1 / 60);
    }
    expect(d.terminada).toBe(false);
  });

  it("barrerse en el aire baja de golpe y se barre al caer", () => {
    const c = vacia();
    accion(c, "saltar");
    for (let i = 0; i < 6; i++) avanzar(c, 1 / 60);
    expect(c.y).toBeGreaterThan(0);
    accion(c, "barrer");
    for (let i = 0; i < 30 && c.y > 0; i++) avanzar(c, 1 / 60);
    expect(c.y).toBe(0);
    expect(c.barrida).toBeGreaterThan(0);
  });

  it("los batidos suman puntos", () => {
    const c = vacia();
    c.batidos = [{ carril: 0, z: 3, alto: 0.5, tomado: false }, { carril: 1, z: 4, alto: 0.5, tomado: false }];
    for (let i = 0; i < 40; i++) avanzar(c, 1 / 60);
    expect(c.batidosTomados).toBe(1);
    expect(puntos(c)).toBe(metros(c) + PUNTOS_BATIDO);
  });

  it("siempre hay por dónde pasar: ninguna fila tiene los tres carriles con máquina", () => {
    for (let s = 1; s < 40; s++) {
      const c = nuevaCarrera(semilla(s));
      // Corre lejos (sin chocar: se quitan los obstáculos ya revisados).
      for (let i = 0; i < 4000; i++) {
        const filas = new Map<number, Obstaculo[]>();
        for (const o of c.obstaculos) filas.set(o.z, [...(filas.get(o.z) ?? []), o]);
        for (const fila of filas.values()) {
          // Lo que no se puede pasar desde el piso: máquinas y colchonetas sin cuña.
          const racks = fila.filter((o) => o.tipo === "maquina" || (o.tipo === "colchoneta" && !o.rampa)).map((o) => o.carril);
          expect(CARRILES.some((k) => !racks.includes(k))).toBe(true);
        }
        c.obstaculos = c.obstaculos.filter((o) => o.z > c.z + 20);
        avanzar(c, 1 / 30);
      }
      expect(nivel(metros(c))).toBeGreaterThan(1);
    }
  });

  it("entre filas siempre da tiempo de un salto completo", () => {
    for (let n = 1; n <= 8; n++) expect(separacion(n)[0]).toBeGreaterThan((2 * 10) / 30);
    const c = nuevaCarrera(semilla(7));
    const zs = [...new Set(c.obstaculos.map((o) => o.z))].sort((a, b) => a - b);
    for (let i = 1; i < zs.length; i++) expect(zs[i]! - zs[i - 1]!).toBeGreaterThanOrEqual(10);
  });

  it("por la cuña se sube corriendo, arriba se corre por encima y al final se cae", () => {
    const c = vacia();
    c.obstaculos = [{ carril: 0, z: 5, tipo: "colchoneta", largo: 14, rampa: true }];
    let maxY = 0;
    for (let i = 0; i < 180 && !c.terminada; i++) {
      avanzar(c, 1 / 60);
      if (c.z > 5 + RAMPA + 0.5 && c.z < 18) { expect(c.y).toBeCloseTo(ALTO_COLCHONETA, 5); expect(enAire(c)).toBe(false); }
      maxY = Math.max(maxY, c.y);
    }
    expect(c.terminada).toBe(false);
    expect(maxY).toBeCloseTo(ALTO_COLCHONETA, 5);
    expect(c.y).toBe(0);
  });

  it("arriba se puede saltar", () => {
    const c = vacia();
    c.obstaculos = [{ carril: 0, z: 0, tipo: "colchoneta", largo: 60, rampa: false }];
    c.y = ALTO_COLCHONETA; c.suelo = ALTO_COLCHONETA;
    avanzar(c, 1 / 60);
    expect(accion(c, "saltar")).toBe(true);
    for (let i = 0; i < 6; i++) avanzar(c, 1 / 60);
    expect(c.y).toBeGreaterThan(ALTO_COLCHONETA + 0.3);
  });

  it("sin cuña: de frente se choca, y de un brinco desde el piso tampoco se sube", () => {
    const c = vacia();
    c.obstaculos = [{ carril: 0, z: 6, tipo: "colchoneta", largo: 12, rampa: false }];
    for (let i = 0; i < 120 && !c.terminada; i++) avanzar(c, 1 / 60);
    expect(c.terminada).toBe(true);
    expect(c.choque?.tipo).toBe("colchoneta");

    const d = vacia();
    d.obstaculos = [{ carril: 0, z: 8, tipo: "colchoneta", largo: 12, rampa: false }];
    for (let i = 0; i < 90 && !d.terminada; i++) {
      if (d.z > 8 - d.vel * 0.3 && !enAire(d) && d.y === 0) accion(d, "saltar");
      avanzar(d, 1 / 60);
    }
    expect(d.terminada).toBe(true);
    expect(d.choque?.tipo).toBe("colchoneta");
  });

  it("cambiarse de carril contra el costado de unas colchonetas es chocar; desde arriba a otra, no", () => {
    const c = vacia();
    c.obstaculos = [{ carril: 1, z: 0, tipo: "colchoneta", largo: 60, rampa: false }];
    for (let i = 0; i < 5; i++) avanzar(c, 1 / 60);
    accion(c, "derecha");
    for (let i = 0; i < 20 && !c.terminada; i++) avanzar(c, 1 / 60);
    expect(c.terminada).toBe(true);

    const d = vacia();
    d.obstaculos = [{ carril: 0, z: 0, tipo: "colchoneta", largo: 60, rampa: false }, { carril: 1, z: 0, tipo: "colchoneta", largo: 60, rampa: false }];
    d.y = ALTO_COLCHONETA; d.suelo = ALTO_COLCHONETA;
    accion(d, "derecha");
    for (let i = 0; i < 20; i++) avanzar(d, 1 / 60);
    expect(d.terminada).toBe(false);
    expect(d.x).toBe(1);
    expect(sueloEn(d.obstaculos, d.x, d.z)).toBe(ALTO_COLCHONETA);
  });

  it("las carreras traen colchonetas, y con tres juntas al menos una tiene cuña", () => {
    let vistas = 0;
    for (let s = 1; s < 30; s++) {
      const c = nuevaCarrera(semilla(s));
      for (let i = 0; i < 3000; i++) {
        const pilas = c.obstaculos.filter((o) => o.tipo === "colchoneta");
        vistas += pilas.length;
        const porZ = new Map<number, Obstaculo[]>();
        for (const o of pilas) porZ.set(o.z, [...(porZ.get(o.z) ?? []), o]);
        for (const f of porZ.values()) if (f.length === 3) expect(f.some((o) => o.rampa)).toBe(true);
        c.obstaculos = c.obstaculos.filter((o) => o.z > c.z + 25);
        avanzar(c, 1 / 30);
      }
    }
    expect(vistas).toBeGreaterThan(0);
  });

  it("circuito de colchonetas: por el piso no se pasa; por arriba, pasándose de pila en pila, sí", () => {
    for (let sem = 1; sem <= 25; sem++) {
      const base = (): Carrera => { const c = vacia(); c.azar = semilla(sem); circuito(c, 20); c.proximaFila = 1e9; return c; };
      // Quedándose en el piso, en cualquier carril, se choca.
      for (const k of CARRILES) {
        const c = base();
        c.carril = k; c.x = k;
        for (let i = 0; i < 1200 && !c.terminada; i++) avanzar(c, 1 / 60);
        expect(c.terminada).toBe(true);
      }
      // Subiendo por la cuña y cambiándose a la pila siguiente en lo encimado, se sale entero.
      const c = base();
      const pilas = c.obstaculos.filter((o) => o.tipo === "colchoneta").sort((a, b) => a.z - b.z);
      c.carril = pilas[0]!.carril; c.x = c.carril;
      let k = 0, batidos = 0;
      const fin = pilas.at(-1)!.z + largoDe(pilas.at(-1)!);
      for (let i = 0; i < 3000 && !c.terminada && c.z < fin + 30; i++) {
        const sig = pilas[k + 1];
        if (sig && c.z > sig.z + 1) { accion(c, sig.carril < c.carril ? "izquierda" : "derecha"); k++; }
        if (avanzar(c, 1 / 60) === "batido") batidos++;
      }
      expect(c.terminada).toBe(false);
      expect(c.z).toBeGreaterThan(fin);
      expect(batidos).toBeGreaterThan(5);
    }
  });

  it("los circuitos salen solos desde el nivel 2", () => {
    const c = nuevaCarrera(semilla(3));
    let vistos = 0;
    for (let i = 0; i < 9000; i++) {
      c.obstaculos = c.obstaculos.filter((o) => o.z > c.z + 25 || o.tipo === "colchoneta");
      const antes = c.ultimoCircuito;
      avanzar(c, 1 / 30);
      if (c.terminada) { c.terminada = false; c.y = c.suelo; }
      if (c.ultimoCircuito !== antes) { vistos++; expect(antes === 0 || c.ultimoCircuito - antes > 250).toBe(true); }
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it("el carrito de discos rueda hacia ella: en su carril choca, a un lado pasa", () => {
    const c = vacia();
    c.obstaculos = [{ carril: 0, z: 40, tipo: "carro", vz: -VEL_CARRO }];
    for (let i = 0; i < 300 && !c.terminada; i++) avanzar(c, 1 / 60);
    expect(c.terminada).toBe(true);
    expect(c.choque?.tipo).toBe("carro");
    expect(c.z).toBeLessThan(40 - VEL_CARRO * 0.5);

    const d = vacia();
    d.obstaculos = [{ carril: 0, z: 40, tipo: "carro", vz: -VEL_CARRO }];
    accion(d, "izquierda");
    for (let i = 0; i < 300; i++) avanzar(d, 1 / 60);
    expect(d.terminada).toBe(false);
    // Ya pasó (y se quitó al quedar atrás).
    expect(d.obstaculos.length).toBe(0);
  });

  it("el carrito sale con su carril despejado hasta el cruce, y siempre hay a dónde hacerse a un lado", () => {
    for (let sem = 1; sem < 40; sem++) {
      const c = nuevaCarrera(semilla(sem));
      c.z = 600; c.vel = 18;
      c.obstaculos = [];
      for (let z = 610; z < 690; z += 8) for (const k of CARRILES) c.obstaculos.push({ carril: k, z, tipo: k === 1 ? "banca" : "maquina" });
      if (!carro(c, 690)) continue;
      const cr = c.obstaculos.find((o) => o.tipo === "carro")!;
      const cruce = c.z + c.vel * ((690 - c.z) / (c.vel + VEL_CARRO));
      expect(c.obstaculos.some((o) => o !== cr && o.carril === cr.carril && o.z > cruce - 18 && o.z < 690)).toBe(false);
      for (const o of c.obstaculos) if (Math.abs(o.z - cruce) < 18) expect(o.tipo).not.toBe("maquina");
    }
  });

  /** Un piloto que solo mira lo que tiene adelante en la ruta elevada y hace lo correcto. */
  function piloto(c: Carrera, plan: { cruzarA?: number }): void {
    // En un cruce de extremo a extremo: ya en el aire, los dos swipes, uno tras otro.
    if (plan.cruzarA !== undefined) {
      if (c.carril !== plan.cruzarA && Math.abs(c.x - c.carril) < 0.05) accion(c, plan.cruzarA < c.carril ? "izquierda" : "derecha");
      if (c.x === plan.cruzarA && !enAire(c)) plan.cruzarA = undefined;
      return;
    }
    if (enAire(c) || Math.abs(c.x - c.carril) > 0.05) return;
    const mats = c.obstaculos.filter((o) => o.tipo === "colchoneta");
    const cubre = (l: number, z: number) => mats.some((m) => m.carril === l && z >= m.z && z <= m.z + largoDe(m));
    // Continua de `z0` a `z1` (sin huecos en medio).
    const continua = (l: number, z0: number, z1: number) => { for (let z = z0; z <= z1; z += 0.5) if (!cubre(l, z)) return false; return true; };
    const vecinos = CARRILES.filter((l) => Math.abs(l - c.carril) === 1);
    const cambiar = (l: number) => accion(c, l < c.carril ? "izquierda" : "derecha");
    const arriba = c.obstaculos.filter((o) => o.base && o.carril === c.carril && o.z > c.z - 0.2);
    const maq = arriba.find((o) => o.tipo === "maquina" && o.z - c.z < c.vel * 0.55);
    if (maq) {
      const l = vecinos.find((l) => continua(l, c.z, maq.z + 1));
      if (l !== undefined) cambiar(l);
      // Nada al lado: la otra orilla, brincando (cuando ya está cerca la máquina).
      else if (c.carril !== 0 && cubre(-c.carril, maq.z) && maq.z - c.z < c.vel * 0.3) { accion(c, "saltar"); plan.cruzarA = -c.carril; }
      return;
    }
    const obs = arriba.find((o) => o.tipo !== "maquina" && o.z - c.z < c.vel * 0.25 + 0.4);
    if (obs) { accion(c, obs.tipo === "banca" ? "saltar" : "barrer"); return; }
    if (c.suelo > 0 && !cubre(c.carril, c.z + c.vel * 0.22)) {
      const l = vecinos.find((l) => continua(l, c.z, c.z + c.vel * 0.5));
      if (l !== undefined) cambiar(l); else accion(c, "saltar");
    }
  }

  it("ruta elevada: unos 15 s sobre una fosa; por el piso se cae, y con buen juego se sale entera", () => {
    for (let sem = 1; sem <= 40; sem++) {
      for (const z0 of [600, 1600]) {
        const base = (): Carrera => { const c = vacia(); c.azar = semilla(sem); c.z = z0 - 30; rutaElevada(c, z0); c.proximaFila = 1e9; return c; };
        const r = base();
        const fin = r.ultimaRuta;
        expect((fin - z0) / velocidad(z0)).toBeGreaterThan(SEGUNDOS_RUTA - 1);
        // Hay de todo: huecos, cambios, obstáculos encima.
        // Por el piso, en cualquier carril, se cae a la fosa o se choca.
        for (const k of CARRILES) {
          const c = base();
          const rampa = c.obstaculos.find((o) => o.rampa)!;
          if (k === rampa.carril) continue;
          c.carril = k; c.x = k;
          for (let i = 0; i < 3000 && !c.terminada; i++) avanzar(c, 1 / 60);
          expect(c.terminada).toBe(true);
        }
        const c = base();
        const rampa = c.obstaculos.find((o) => o.rampa)!;
        c.carril = rampa.carril; c.x = c.carril;
        const plan = {};
        for (let i = 0; i < 4000 && !c.terminada && c.z < fin + 20; i++) { piloto(c, plan); avanzar(c, 1 / 60); }
        if (c.terminada) throw new Error(`semilla ${sem}, z0 ${z0}: chocó con ${c.choque?.tipo} en ${c.z.toFixed(1)} (carril ${c.carril}, y ${c.y.toFixed(2)})`);
        expect(c.z).toBeGreaterThan(fin);
        expect(c.batidosTomados).toBeGreaterThan(10);
      }
    }
  });

  it("las rutas traen huecos, cambios de pila y obstáculos encima", () => {
    let huecos = 0, encima = 0, maquinas = 0;
    for (let sem = 1; sem <= 30; sem++) {
      const c = vacia(); c.azar = semilla(sem); rutaElevada(c, 600);
      const mats = c.obstaculos.filter((o) => o.tipo === "colchoneta").sort((a, b) => a.z - b.z);
      for (const a of mats) if (mats.some((b) => b.carril === a.carril && b.z > a.z + largoDe(a) + 1 && b.z < a.z + largoDe(a) + 10)) huecos++;
      encima += c.obstaculos.filter((o) => o.base).length;
      maquinas += c.obstaculos.filter((o) => o.base && o.tipo === "maquina").length;
    }
    expect(huecos).toBeGreaterThan(10);
    expect(encima).toBeGreaterThan(20);
    expect(maquinas).toBeGreaterThan(5);
  });

  it("desde el nivel 5 a veces vienen dos carritos, y siempre queda un carril libre", () => {
    for (let sem = 1; sem < 30; sem++) {
      const c = nuevaCarrera(semilla(sem));
      c.z = 1300; c.vel = 24; c.obstaculos = [];
      carro(c, 1390, true);
      const carros = c.obstaculos.filter((o) => o.tipo === "carro");
      expect(carros.length).toBe(2);
      expect(new Set(carros.map((o) => o.carril)).size).toBe(2);
    }
  });

  it("cada ruta trae un cruce de extremo a extremo: sin brincar se cae; brincando con un solo swipe, también", () => {
    for (let sem = 1; sem <= 30; sem++) {
      const r = vacia(); r.azar = semilla(sem); rutaElevada(r, 600);
      // El cruce: una máquina encima, en una orilla, al final de su pila; la pila de la otra orilla
      // ya empezó, y en medio no hay colchonetas.
      const mats = r.obstaculos.filter((o) => o.tipo === "colchoneta");
      const cruce = r.obstaculos.find((o) => o.tipo === "maquina" && o.base && o.carril !== 0
        && mats.some((m) => m.carril === -o.carril && m.z < o.z && m.z + largoDe(m) > o.z + 2)
        && !mats.some((m) => m.carril === 0 && m.z < o.z + 1 && m.z + largoDe(m) > o.z - 8));
      expect(cruce).toBeDefined();
      // Llegando a ese cruce por arriba: sin brincar, o brincando y moviéndose un solo carril, se pierde.
      for (const swipes of [0, 1]) {
        const c = vacia(); c.azar = semilla(sem); rutaElevada(c, 600); c.proximaFila = 1e9;
        const m = c.obstaculos.find((o) => o.tipo === "maquina" && o.base && o.carril === cruce!.carril && Math.abs(o.z - cruce!.z) < 0.01)!;
        c.z = m.z - c.vel * 0.6; c.carril = m.carril; c.x = m.carril; c.y = ALTO_COLCHONETA; c.suelo = ALTO_COLCHONETA;
        let hechos = 0;
        for (let i = 0; i < 200 && !c.terminada; i++) {
          if (m.z - c.z < c.vel * 0.3 && !enAire(c) && swipes > 0 && hechos === 0) accion(c, "saltar");
          if (enAire(c) && hechos < swipes && Math.abs(c.x - c.carril) < 0.05) { accion(c, m.carril > 0 ? "izquierda" : "derecha"); hechos++; }
          avanzar(c, 1 / 60);
        }
        expect(c.terminada).toBe(true);
      }
    }
  });
});
