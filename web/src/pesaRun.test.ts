import { describe, expect, it } from "vitest";
import {
  ALTO_BANCA, ALTO_COLCHONETA, ALTURA_SALTO, RAMPA, enAire, sueloEn, CARRILES, PUNTOS_BATIDO, VEL_INICIAL, VEL_MAXIMA, accion, avanzar, choca, metros, nivel, nuevaCarrera, puntos,
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

  it("el salto pasa la banca; la barrida pasa la barra; el rack solo se esquiva", () => {
    const banca: Obstaculo = { carril: 0, z: 0, tipo: "banca" };
    const barra: Obstaculo = { carril: 0, z: 0, tipo: "barra" };
    const rack: Obstaculo = { carril: 0, z: 0, tipo: "rack" };
    expect(ALTURA_SALTO).toBeGreaterThan(ALTO_BANCA * 2);
    expect(choca(banca, 0, 0, false)).toBe(true);
    expect(choca(banca, 0, ALTO_BANCA + 0.1, false)).toBe(false);
    expect(choca(barra, 0, 0, false)).toBe(true);
    expect(choca(barra, 0, 1, false)).toBe(true);
    expect(choca(barra, 0, 0, true)).toBe(false);
    expect(choca(rack, 0, 1.5, true)).toBe(true);
    expect(choca(rack, 1, 0, false)).toBe(false);
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

  it("siempre hay por dónde pasar: ninguna fila tiene los tres carriles con rack", () => {
    for (let s = 1; s < 40; s++) {
      const c = nuevaCarrera(semilla(s));
      // Corre lejos (sin chocar: se quitan los obstáculos ya revisados).
      for (let i = 0; i < 4000; i++) {
        const filas = new Map<number, Obstaculo[]>();
        for (const o of c.obstaculos) filas.set(o.z, [...(filas.get(o.z) ?? []), o]);
        for (const fila of filas.values()) {
          // Lo que no se puede pasar desde el piso: racks y colchonetas sin cuña.
          const racks = fila.filter((o) => o.tipo === "rack" || (o.tipo === "colchoneta" && !o.rampa)).map((o) => o.carril);
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

  it("sin cuña: de frente se choca; saltando a tiempo se sube", () => {
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
    expect(d.terminada).toBe(false);
    expect(d.y).toBeCloseTo(ALTO_COLCHONETA, 5);
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
});
