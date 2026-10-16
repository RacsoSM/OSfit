import { describe, expect, it } from "vitest";
import { DESPERTAR, urlDe } from "./despertador";
import * as index from "./index";

describe("despertador", () => {
  it("arma la URL de cada función en su región", () => {
    expect(urlDe("registrarSesion", "osfit-cccfe")).toBe("https://us-west1-osfit-cccfe.cloudfunctions.net/registrarSesion");
  });
  it("solo despierta funciones que existen", () => {
    for (const nombre of DESPERTAR) expect(index).toHaveProperty(nombre);
  });
});
