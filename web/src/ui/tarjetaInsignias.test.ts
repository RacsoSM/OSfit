import { describe, expect, it } from "vitest";
import type { LogroPersonalOtorgado, MedallaOtorgada } from "../datos";
import { tarjetaLogrosPersonales, tarjetaMedallas } from "./tarjetaInsignias";

function medalla(campos: Partial<MedallaOtorgada> = {}): MedallaOtorgada {
  return {
    rangoInicio: "2026-08-16",
    medallaId: "m1",
    nombreMedalla: "Constancia",
    encabezadoRango: "2da quincena de agosto",
    fueAjustadaManualmente: false,
    ...campos,
  };
}

function logro(campos: Partial<LogroPersonalOtorgado> = {}): LogroPersonalOtorgado {
  return {
    id: "2026-08-16_l1",
    rangoInicio: "2026-08-16",
    logroId: "l1",
    nombreLogro: "Primera dominada",
    mensaje: "Te costó meses",
    encabezadoRango: "2da quincena de agosto",
    orden: 0,
    ...campos,
  };
}

/** Los nombres van dentro de la rejilla, en el orden en que se pintaron. */
function nombres(html: string): string[] {
  return [...html.matchAll(/class="insignia-nombre">([^<]*)</g)].map((m) => m[1]);
}

describe("tarjetaMedallas", () => {
  it("pinta la imagen de la medalla cuando tiene una", () => {
    const html = tarjetaMedallas([medalla({ imagenUrl: "https://storage/insignia.png" })]);
    expect(html).toContain(`src="https://storage/insignia.png"`);
    expect(html).not.toContain("generica");
    expect(html).toContain("Constancia");
  });

  it("dibuja la insignia generica cuando no tiene imagen", () => {
    const html = tarjetaMedallas([medalla()]);
    expect(html).toContain(`class="insignia-img generica"`);
    expect(html).not.toContain("<img");
  });

  it("tambien dibuja la generica si la imagen llego en null", () => {
    expect(tarjetaMedallas([medalla({ imagenUrl: null })])).toContain("generica");
  });

  it("ordena las medallas de la mas reciente a la mas vieja", () => {
    const html = tarjetaMedallas([
      medalla({ rangoInicio: "2026-07-01", nombreMedalla: "Julio" }),
      medalla({ rangoInicio: "2026-09-01", nombreMedalla: "Septiembre" }),
      medalla({ rangoInicio: "2026-08-16", nombreMedalla: "Agosto" }),
    ]);
    expect(nombres(html)).toEqual(["Septiembre", "Agosto", "Julio"]);
  });

  it("no reordena la lista que le pasaron", () => {
    const lista = [medalla({ rangoInicio: "2026-07-01" }), medalla({ rangoInicio: "2026-09-01" })];
    tarjetaMedallas(lista);
    expect(lista[0].rangoInicio).toBe("2026-07-01");
  });

  it("sin medallas dice que faltan y quien las entrega", () => {
    const html = tarjetaMedallas([]);
    expect(html).toContain("Todavía no tienes medallas");
    expect(html).toContain("Tu entrenador");
  });

  it("escapa el nombre que escribio el entrenador", () => {
    const html = tarjetaMedallas([medalla({ nombreMedalla: `<img onerror="x">` })]);
    expect(html).toContain("&lt;img onerror=&quot;x&quot;&gt;");
    expect(html).not.toContain("<img");
  });

  it("escapa la url para que no se salga del atributo", () => {
    const html = tarjetaMedallas([medalla({ imagenUrl: `x" onerror="alert(1)` })]);
    expect(html).toContain(`src="x&quot; onerror=&quot;alert(1)"`);
  });
});

describe("tarjetaLogrosPersonales", () => {
  it("muestra el nombre y el encabezado del periodo", () => {
    const html = tarjetaLogrosPersonales([logro()]);
    expect(html).toContain("Primera dominada");
    expect(html).toContain("2da quincena de agosto");
  });

  it("no muestra el mensaje privado del logro", () => {
    expect(tarjetaLogrosPersonales([logro()])).not.toContain("Te costó meses");
  });

  it("pinta la imagen del logro cuando tiene una", () => {
    const html = tarjetaLogrosPersonales([logro({ imagenUrl: "https://storage/logro.png" })]);
    expect(html).toContain(`src="https://storage/logro.png"`);
  });

  it("dibuja la insignia generica cuando no tiene imagen", () => {
    expect(tarjetaLogrosPersonales([logro()])).toContain(`class="insignia-img generica"`);
  });

  it("ordena por periodo descendente y dentro del periodo por orden", () => {
    const html = tarjetaLogrosPersonales([
      logro({ rangoInicio: "2026-08-16", orden: 1, nombreLogro: "Agosto segundo" }),
      logro({ rangoInicio: "2026-09-01", orden: 0, nombreLogro: "Septiembre" }),
      logro({ rangoInicio: "2026-08-16", orden: 0, nombreLogro: "Agosto primero" }),
    ]);
    expect(nombres(html)).toEqual(["Septiembre", "Agosto primero", "Agosto segundo"]);
  });

  it("sin logros dice que faltan y quien los escribe", () => {
    const html = tarjetaLogrosPersonales([]);
    expect(html).toContain("Todavía no tienes logros personales");
    expect(html).toContain("Tu entrenador");
  });

  it("escapa el nombre y el encabezado", () => {
    const html = tarjetaLogrosPersonales([
      logro({ nombreLogro: "<b>ojo</b>", encabezadoRango: "<i>agosto</i>" }),
    ]);
    expect(html).toContain("&lt;b&gt;ojo&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;agosto&lt;/i&gt;");
  });
});
