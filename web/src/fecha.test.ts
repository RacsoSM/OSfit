import { describe, expect, it } from "vitest";
import { fechaEnMazatlan } from "./fecha";

describe("fechaEnMazatlan", () => {
  it("a las 00:30 UTC todavía es el día anterior en Mazatlán (UTC-7)", () => {
    expect(fechaEnMazatlan(new Date("2026-10-09T00:30:00Z"))).toBe("2026-10-08");
  });

  it("el mediodía de Mazatlán (como guarda la app) cae en su mismo día", () => {
    expect(fechaEnMazatlan(new Date("2026-10-08T19:00:00Z"))).toBe("2026-10-08");
  });

  it("cruza el año", () => {
    expect(fechaEnMazatlan(new Date("2027-01-01T05:00:00Z"))).toBe("2026-12-31");
  });
});
