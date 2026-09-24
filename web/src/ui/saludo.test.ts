import { describe, expect, it } from "vitest";
import { terminarSaludo } from "./saludo";

function clases(...iniciales: string[]) {
  const s = new Set(iniciales);
  return {
    s,
    classList: {
      add: (c: string) => { s.add(c); },
      remove: (...cs: string[]) => { cs.forEach((c) => s.delete(c)); },
    },
  };
}

describe("terminarSaludo", () => {
  it("a media escritura lo deja escrito, para que al volver no se escriba de nuevo", () => {
    const el = clases("saludo", "escribiendo");
    terminarSaludo(el);
    expect([...el.s].sort()).toEqual(["escrito", "saludo"]);
  });

  it("con el cursor parpadeando también lo da por escrito", () => {
    const el = clases("saludo", "parpadeando");
    terminarSaludo(el);
    expect([...el.s].sort()).toEqual(["escrito", "saludo"]);
  });
});
