import { describe, expect, it } from "vitest";
import { CADA_MS, hayVersionNueva, versionDe, vigilarVersion, type Entorno } from "./version";
import { avisoVersion } from "./ui/avisoVersion";

/** Un navegador de mentiras: se dispara "volver" y "la media hora" a mano. */
function entorno(respuestas: unknown[], visible = true) {
  const escuchas: { volver?: () => void; cada?: () => void; ms?: number } = {};
  let pedidos = 0;
  const e: Entorno = {
    pedir: async () => {
      const r = respuestas[Math.min(pedidos++, respuestas.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    },
    visible: () => visible,
    alVolver: (f) => { escuchas.volver = f; },
    cada: (f, ms) => { escuchas.cada = f; escuchas.ms = ms; },
  };
  const esperar = () => new Promise((r) => setTimeout(r, 0));
  return { e, escuchas, esperar, pedidos: () => pedidos };
}

describe("versionDe", () => {
  it("lee la versión de version.json y descarta lo demás", () => {
    expect(versionDe({ version: "261015.1432" })).toBe("261015.1432");
    expect(versionDe(null)).toBeNull();
    expect(versionDe({ version: "" })).toBeNull();
    expect(versionDe("<!doctype html>")).toBeNull();
  });
});

describe("hayVersionNueva", () => {
  it("cualquier versión distinta cuenta; sin dato, no", () => {
    expect(hayVersionNueva("261015.1432", "261015.1500")).toBe(true);
    expect(hayVersionNueva("261015.1500", "261015.1432")).toBe(true);
    expect(hayVersionNueva("261015.1432", "261015.1432")).toBe(false);
    expect(hayVersionNueva("261015.1432", null)).toBe(false);
  });
});

describe("vigilarVersion", () => {
  it("pregunta al volver y cada media hora, y avisa una sola vez", async () => {
    const t = entorno([{ version: "v1" }, { version: "v2" }]);
    let avisos = 0;
    vigilarVersion("v1", () => avisos++, t.e);
    expect(t.escuchas.ms).toBe(CADA_MS);
    t.escuchas.volver!();
    await t.esperar();
    expect(avisos).toBe(0);
    t.escuchas.cada!();
    await t.esperar();
    expect(avisos).toBe(1);
    t.escuchas.volver!();
    await t.esperar();
    expect(avisos).toBe(1);
    expect(t.pedidos()).toBe(2);
  });

  it("sin señal no avisa ni truena; con la página oculta ni pregunta", async () => {
    const sinSenal = entorno([new Error("offline")]);
    let avisos = 0;
    vigilarVersion("v1", () => avisos++, sinSenal.e);
    sinSenal.escuchas.volver!();
    await sinSenal.esperar();
    expect(avisos).toBe(0);

    const oculta = entorno([{ version: "v2" }], false);
    vigilarVersion("v1", () => avisos++, oculta.e);
    oculta.escuchas.cada!();
    await oculta.esperar();
    expect(oculta.pedidos()).toBe(0);
  });
});

describe("avisoVersion", () => {
  it("ofrece actualizar y cerrar", () => {
    const html = avisoVersion();
    expect(html).toContain("Hay una versión nueva de OSfit");
    expect(html).toContain('data-version="actualizar"');
    expect(html).toContain('data-version="cerrar"');
  });
});
