import { describe, expect, it } from "vitest";
import type { ResumenMensual } from "../resumenMensual";
import {
  abrirHistoria, cerrarHistoria, elegirMes, historiaAbierta, historiasDelMes, mesElegidoResumen, reiniciarResumenMensual,
  variacion, ventanaResumenMensual, type DatosResumenMensual,
} from "./resumenMensual";

const resumen = (x: Partial<ResumenMensual> = {}): ResumenMensual => ({
  mes: "2026-10",
  version: 1,
  asistencia: {
    entreno: 10, justificadas: 7, faltas: 2, porcentaje: 53, minutos: 1044, visitasConMinutos: 7,
    rachaMasLarga: 12, dias: { "01": "f", "02": "j", "08": "e", "28": "e" },
  },
  entrenamiento: {
    sesiones: 8, kg: 59123, series: 176, reps: 1360,
    top: [{ ejercicioId: "cuerda", nombre: "Extensión <con> cuerda", veces: 3 }, { ejercicioId: "curl", nombre: "Curl", veces: 1 }],
    diaFavorito: { indice: 1, nombre: "Hombro & bíceps", veces: 4 },
  },
  fuerza: { general: 7.06, musculos: { pecho: 8, abdomen: 5.61 } },
  marcas: [
    { ejercicioId: "banca", nombre: "Press de banca", tipo: "peso", reps: 4, peso: 100, nivel: 7.7 },
    { ejercicioId: "lag", nombre: "Lagartijas", tipo: "corporal", reps: 30, peso: null, nivel: 5 },
  ],
  ...x,
});

const datos = (x: Partial<DatosResumenMensual> = {}): DatosResumenMensual => ({
  cargando: false,
  meses: [{ mes: "2026-10", enCurso: true }, { mes: "2026-09", enCurso: false }, { mes: "2026-08", enCurso: false }],
  mes: "2026-10",
  resumen: resumen(),
  enCurso: true,
  hoy: "2026-10-28",
  sexo: "H",
  cambios: null,
  ...x,
});

const ids = (d: DatosResumenMensual) => historiasDelMes(d).map((h) => h.id);
const todo = (d: DatosResumenMensual) => historiasDelMes(d).map((h) => h.html).join("");

describe("la lista de meses", () => {
  it("pregunta qué mes quiere ver, con cada mes como botón; sin historia abierta", () => {
    cerrarHistoria();
    const html = ventanaResumenMensual(datos());
    expect(html).toContain("¿Qué mes quieres ver?");
    expect(html).toContain('data-rm-mes="2026-10"');
    expect(html).toContain('data-rm-mes="2026-08"');
    expect(html).toContain("En curso · al 28");
    expect(html).toContain("Cerrado");
    expect(html).not.toContain("rh-visor");
  });

  it("sin meses: vacío, o cargando mientras llegan", () => {
    expect(ventanaResumenMensual(datos({ meses: [], mes: null, resumen: null }))).toContain("Todavía no hay meses que resumir.");
    expect(ventanaResumenMensual(datos({ meses: [], mes: null, resumen: null, cargando: true }))).toContain("Cargando tus meses");
  });
});

describe("las historias", () => {
  it("van en orden: portada, entrenamiento, constancia, fuerza, marcas y el final", () => {
    expect(ids(datos())).toEqual(["portada", "entrenamiento", "constancia", "fuerza", "marcas", "final"]);
  });

  it("al elegir un mes se abre a pantalla completa, con una barra de progreso por historia", () => {
    abrirHistoria("2026-10");
    const html = ventanaResumenMensual(datos());
    expect(historiaAbierta()).toBe(true);
    expect(html).toContain("rh-visor");
    expect(html.match(/rh-pagina /g)).toHaveLength(6);
    expect(html.match(/<span class="(actual|vista|)"><\/span>/g)).toHaveLength(6);
    cerrarHistoria();
    expect(historiaAbierta()).toBe(false);
  });

  it("una sección sin datos no tiene historia", () => {
    const sinSesiones = resumen({
      entrenamiento: { sesiones: 0, kg: 0, series: 0, reps: 0, top: [], diaFavorito: null },
      fuerza: null, marcas: [],
    });
    expect(ids(datos({ resumen: sinSesiones }))).toEqual(["portada", "constancia", "final"]);
  });

  it("entrenamiento: kg, series, reps y lo que más hizo, escapado", () => {
    const html = todo(datos());
    expect(html).toContain("59,123 <small>kg</small>");
    expect(html).toContain("176");
    expect(html).toContain("1,360");
    expect(html).toContain("Extensión &lt;con&gt; cuerda");
  });

  it("constancia: % de asistencia, el calendario con hoy marcado, conteos, racha y tiempo", () => {
    const html = todo(datos());
    expect(html).toContain("53 <small>%</small>");
    expect(html).toContain("rh-e hoy");
    expect(html).toContain("tu racha más larga");
    expect(html).toContain("17 h <small>24 min</small>");
    expect(html).toMatch(/class="rh-dia rh-e"/);
    expect(html).not.toMatch(/class="(ok|cal|rm-cal) /);
    const cerrado = todo(datos({ mes: "2026-09", enCurso: false, resumen: resumen({ mes: "2026-09" }) }));
    expect(cerrado).not.toContain(" hoy\"");
  });



  it("no dice cuántos entrenamientos registró ni su día favorito (entrenador, 2026-10-28)", () => {
    const html = todo(datos());
    expect(html).not.toContain("entrenamientos registrados");
    expect(html).not.toMatch(/día favorito/i);
    expect(html).not.toContain("Hombro &amp; bíceps");
  });

  it("la portada la saluda por su primer nombre: «Hola, Valeria. Así fue tu» Octubre", () => {
    const portada = (nombre?: string) => historiasDelMes(datos({ nombre })).find((h) => h.id === "portada")!.html;
    expect(portada("Valeria <b> Ruiz")).toContain("Hola, Valeria. Así fue tu");
    expect(portada("<b>")).toContain("Hola, &lt;b&gt;. Así fue tu");
    expect(portada("")).toContain("Hola. Así fue tu");
    expect(portada("Valeria")).toMatch(/Así fue tu<\/p>\s*<p class="rh-mes">Octubre<\/p>\s*<i class="rh-linea-acento"[^>]*><\/i>\s*<p class="rh-anio">2026<\/p>/);
  });

  it("el final es el póster: mes, nombre, rango, 4 números, ejercicios y músculos; Compartir y Cerrar", () => {
    const html = historiasDelMes(datos({ nombre: "Valeria <3" })).find((h) => h.id === "final")!.html;
    expect(html).toContain("OCTUBRE 2026 · OSFIT");
    expect(html).toContain("Valeria &lt;3");
    expect(html).toContain("rh-poster-rango");
    expect(html.match(/rh-poster-numero/g)).toHaveLength(4);
    expect(html).toContain("Tus ejercicios");
    expect(html).toContain("Tus músculos");
    expect(html).toContain('data-rh="compartir">Compartir');
    expect(html).toContain('data-rh="cerrar"');
    expect(html).not.toContain("Ver otra vez");
    // La insignia de su rango y la de cada músculo, no bolitas de color.
    expect(html).toContain('id="rh-poster-rango-f"');
    expect(html).toMatch(/rh-poster-lista">(<li><svg class="insignia-rango")/);
  });
});

describe("gráficas y estilo fijo", () => {
  it("kilos por semana: una columna por semana, la más alta marcada, con su número", () => {
    const html = todo(datos({ semanas: [{ desde: 1, hasta: 5, kg: 12000 }, { desde: 6, hasta: 12, kg: 18500 }, { desde: 13, hasta: 19, kg: 0 }] }));
    expect(html).toContain("Kilos por semana");
    expect(html.match(/rh-columna-barra/g)).toHaveLength(3);
    expect(html).toContain('rh-columna-barra max" style="height: 100.0%"');
    expect(html).toContain("12,000");
    expect(html).not.toContain("12k");
    expect(html).toContain("1–5 oct");
    expect(html).toContain("del 6 al 12: 18,500 kg");
  });

  it("sin kilos no hay gráfica de semanas", () => {
    expect(todo(datos({ semanas: [{ desde: 1, hasta: 7, kg: 0 }] }))).not.toContain("Kilos por semana");
    expect(todo(datos({ semanas: null }))).not.toContain("Kilos por semana");
  });

  it("constancia: barra de proporción con un tramo por estado presente y su leyenda con números", () => {
    const html = todo(datos());
    expect(html.match(/class="rh-tramo /g)).toHaveLength(3);
    expect(html).toContain('aria-label="Entrenó 10, justificadas 7, faltas 2"');
    const sinFaltas = todo(datos({ resumen: resumen({ asistencia: { ...resumen().asistencia, faltas: 0 } }) }));
    expect(sinFaltas.match(/class="rh-tramo /g)).toHaveLength(2);
  });


  it("todo con clases propias: nada que los estilos de la clienta repinten", () => {
    abrirHistoria("2026-10");
    const html = ventanaResumenMensual(datos());
    cerrarHistoria();
    expect(html).toContain("rh-fijo");
    expect(html).not.toMatch(/class="(?:[^"]*\s)?(tarjeta|boton|cal)(?:\s[^"]*)?"/);
  });
});

describe("fuerza: tu cuerpo pintado", () => {
  const svg = `<svg viewBox="0 0 10 10"><style>.contorno { fill: #fff; }\n[data-musculo="pecho"] { fill: red; }</style>` +
    `<path class="musculo" data-musculo="pecho" d="M0 0"/><path class="musculo" data-musculo="biceps" d="M1 1"/></svg>`;
  it("rango general, contra quienes entrenan, y su músculo más fuerte", () => {
    const html = todo(datos({ mapa: { frente: svg, espalda: svg } }));
    expect(html).toContain(">Avanzado<");
    expect(html).toMatch(/Más fuerte que el \d+ % de quienes entrenan/);
    expect(html).toContain("Tus músculos más fuertes");
    expect(html).toMatch(/rh-fuertes-nombre">Pecho<\/span><span class="rh-fuertes-rango">Élite/);
    // Los 8 rangos de leyenda, cada uno con su color.
    const leyenda = html.slice(html.indexOf('class="rh-rangos"'), html.indexOf("</ul>", html.indexOf('class="rh-rangos"')));
    // Cada rango con su insignia, la misma de toda la app.
    expect(leyenda.match(/<li><svg class="insignia-rango"/g)).toHaveLength(8);
  });
  it("cada músculo con datos lleva su tono; los demás quedan para el gris del CSS", () => {
    const html = todo(datos({ mapa: { frente: svg, espalda: svg } }));
    // El color de su rango, como en Músculos: pecho nivel 8 = Élite, oro.
    expect(html).toContain('data-musculo="pecho" style="fill: #ffb703"');
    expect(html).not.toMatch(/data-musculo="biceps" style=/);
    expect(html).toContain('id="rh-frente"');
    expect(html).toContain('id="rh-espalda"');
    // El color del SVG original no se cuela: prepararSvg quita sus reglas de músculos.
    expect(html).not.toContain("fill: red");
  });
  it("sin el mapa todavía, avisa que carga", () => {
    expect(todo(datos({ mapa: null }))).toContain("Cargando tu cuerpo");
  });
});

describe("mejores marcas: récords personales", () => {
  it("cuenta los récords y marca cada uno contra su mejor anterior", () => {
    const html = todo(datos({ previas: { banca: { peso: 90, reps: 4 }, lag: { peso: null, reps: 30 } } }));
    expect(html).toContain("Este mes rompiste");
    expect(html).toContain("1 <small>récord personal</small>");
    expect(html).toContain("100 <small>kg × 4</small>");
    expect(html).toContain("Antes: 90 kg × 4");
    expect(html).toContain("Igualaste");
    expect(html).toContain("30 <small>reps</small>");
  });
  it("primera vez, y por debajo de su mejor sin insignia", () => {
    const html = todo(datos({ previas: { lag: { peso: null, reps: 40 } } }));
    expect(html).toContain("Primera vez");
    expect(html).toContain("Tu mejor: 40 reps");
    expect(html).toContain("Tus mejores series del mes");
  });
  it("mientras llega el historial, las marcas sin comparar", () => {
    const html = todo(datos({ previas: null }));
    expect(html).toContain("100 <small>kg × 4</small>");
    expect(html).not.toContain("Récord");
    expect(html).not.toContain("Primera vez");
  });
});

describe("contra el mes anterior", () => {
  it("variacion: % del anterior, o puntos para la asistencia; nada sin anterior", () => {
    expect(variacion(110, 100, "relativo")).toBe(10);
    expect(variacion(92, 100, "relativo")).toBe(-8);
    expect(variacion(86, 80, "puntos")).toBe(6);
    expect(variacion(5, 0, "relativo")).toBeNull();
    expect(variacion(5, null, "relativo")).toBeNull();
  });

  const septiembre = resumen({
    mes: "2026-09",
    asistencia: { ...resumen().asistencia, porcentaje: 60, minutos: 1200, rachaMasLarga: 12 },
    entrenamiento: { ...resumen().entrenamiento, kg: 50000, series: 176, reps: 1000 },
    fuerza: { general: 6.5, musculos: { pecho: 7 } },
  });

  it("sube en azul, baja e igual en gris, con el nombre del mes", () => {
    const html = todo(datos({ mes: "2026-10", enCurso: false, anterior: septiembre }));
    expect(html).toContain('rh-vs sube">↑ +18 % vs septiembre');   // kg 59,123 vs 50,000
    expect(html).toContain('rh-vs sube">↑ +36 % vs septiembre');   // reps 1,360 vs 1,000
    expect(html).toContain('rh-vs igual">= igual que septiembre'); // series
    expect(html).toContain('rh-vs baja">↓ −7 % vs septiembre');    // asistencia 53 vs 60 (puntos)
    expect(html).toContain("Tu nivel general");
  });

  it("sin anterior no hay comparación", () => {
    expect(todo(datos({ anterior: null }))).not.toContain("rh-vs");
  });
});

describe("datosPoster", () => {
  it("los mismos datos para la pantalla y la imagen: rango, 4 números con cambio y top 5 músculos", async () => {
    const { datosPoster } = await import("./resumenMensual");
    const ant = resumen({ mes: "2026-09", fuerza: { general: 6.5, musculos: { pecho: 7 } } });
    const p = datosPoster(resumen(), "H", ant, "Ana");
    expect(p.nombre).toBe("Ana");
    expect(p.rango?.nombre).toBe("Avanzado");
    expect(p.numeros.map((n) => n.valor)).toEqual(["53 %", "59,123 kg", "17 h 24 min", "12 días"]);
    expect(p.numeros[0].cambio).toEqual({ n: 0, mes: "2026-09" });
    expect(p.musculos.map((m) => m.nombre)).toEqual(["Pecho", "Abdomen"]);
    expect(p.ejercicios[0]).toBe("Extensión <con> cuerda");
    const siete = resumen({ fuerza: { general: 6, musculos: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 } } });
    expect(datosPoster(siete, "H", null, "Ana").musculos).toHaveLength(5);
  });
});

describe("mes elegido", () => {
  it("sobrevive hasta que se reinicia, y reiniciar cierra la historia", () => {
    elegirMes("2026-09");
    expect(mesElegidoResumen()).toBe("2026-09");
    abrirHistoria("2026-09");
    reiniciarResumenMensual();
    expect(mesElegidoResumen()).toBeNull();
    expect(historiaAbierta()).toBe(false);
  });
});
