import { describe, expect, it } from "vitest";
import type { Cliente, Ejercicio } from "../datos";
import { tarjetaDia } from "./tarjetaDia";

/** 2026-09-15 es lunes; 2026-09-19 viernes; 2026-09-20 domingo. */
const LUNES = "2026-09-15";
const DOMINGO = "2026-09-20";

function ejercicio(campos: Partial<Ejercicio> = {}): Ejercicio {
  return { nombre: "Press banca", series: 4, repeticiones: "10", pesoONota: "30 kg", ...campos };
}

/** Cliente con rutina de un solo día, anclado a `LUNES` para que ese día sea el índice 0. */
function cliente(ejercicios: Ejercicio[], campos: Partial<Cliente> = {}): Cliente {
  return {
    nombre: "Ana",
    activo: true,
    rutinaAsignada: {
      id: "r1",
      nombre: "Fuerza 3 días",
      dias: [{ nombreDia: "Pecho y espalda", ejercicios }],
    },
    ultimoDia: 0,
    ultimoDiaFecha: LUNES,
    ultimoDiaEsAncla: true,
    ...campos,
  };
}

describe("tarjetaDia", () => {
  it("fin de semana no lista ejercicios aunque el día los tenga", () => {
    const html = tarjetaDia(cliente([ejercicio({ nombre: "Press banca" })]), DOMINGO);
    expect(html).toContain("Hoy toca descansar");
    expect(html).not.toContain("Press banca");
  });

  it("sin rutina asignada sigue mostrando la tarjeta de siembra", () => {
    const html = tarjetaDia(cliente([], { rutinaAsignada: null }), LUNES);
    expect(html).toContain("Todavía no tienes rutina");
    expect(html).toContain("🌱");
  });

  it("día sin ejercicios explica que el entrenador no los cargó", () => {
    const html = tarjetaDia(cliente([]), LUNES);
    expect(html).toContain("Pecho y espalda");
    expect(html).toContain("Tu entrenador todavía no cargó los ejercicios de este día.");
  });

  it("día con ejercicios los lista con series, repeticiones y nota", () => {
    const html = tarjetaDia(
      cliente([
        ejercicio({ nombre: "Press banca", series: 4, repeticiones: "10", pesoONota: "30 kg" }),
        ejercicio({ nombre: "Remo", series: 3, repeticiones: "12", pesoONota: "" }),
      ]),
      LUNES
    );
    expect(html).toContain("Press banca");
    expect(html).toContain("4");
    expect(html).toContain("10");
    expect(html).toContain("30 kg");
    expect(html).toContain("Remo");
    expect(html).not.toContain("todavía no cargó");
  });

  it("el texto del ejercicio se escapa", () => {
    const html = tarjetaDia(
      cliente([
        ejercicio({
          nombre: `<script>alert("x")</script>`,
          repeticiones: `<b>10</b>`,
          pesoONota: `bajarle, se "lastimó" <img>`,
        }),
      ]),
      LUNES
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img>");
    expect(html).not.toContain("<b>10</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;lastimó&quot;");
  });
});
