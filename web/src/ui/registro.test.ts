import { beforeEach, describe, expect, it } from "vitest";
import type { EjercicioBanco, Sesion } from "../datos";
import { indiceBanco } from "../banco";
import { agregarBiserie, agregarEjercicio, borradorDeSesion, nuevoBorrador } from "../registro";
import { avisoReps, cabeceraRegistro, empezarGuiado, entrenamientoAbierto, ponerEstadoRegistro, ventanaRegistro, type DatosRegistro } from "./registro";

const press: EjercicioBanco = {
  id: "press-banca", nombre: "Press de banca", alias: ["press banca"], tipo: "peso", grupo: "pecho",
  musculos: { pecho: 1 }, gifRuta: "ejercicios/press-banca.webp",
};
const plancha: EjercicioBanco = {
  id: "plancha", nombre: "Plancha", tipo: "tiempo", grupo: "abdomen", musculos: { abdomen: 1 }, gifRuta: null,
};
const banco = [press, plancha];

function datos(campos: Partial<DatosRegistro> = {}): DatosRegistro {
  return {
    hoy: "2026-10-12",
    dia: { nombreDia: "Pecho", ejercicios: [{ nombre: "Press banca", series: 4, repeticiones: "10", pesoONota: "" }] },
    banco,
    indice: indiceBanco(banco),
    sesiones: [],
    config: null,
    ...campos,
  };
}

beforeEach(() => ponerEstadoRegistro({ vista: "inicio", borrador: null }));

/** Un Timestamp de Firestore de mentiras: la vista solo usa `toDate()`. */
const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as unknown as Sesion["creada"];

describe("inicio", () => {
  it("sin entrenamiento abierto ofrece iniciarlo y no deja agregar ejercicios sueltos", () => {
    const html = ventanaRegistro(datos());
    expect(html).toContain("▶ Iniciar entrenamiento");
    expect(html).not.toContain("+ Agregar ejercicio");
  });

  it("lleva al historial desde sus entrenamientos recientes", () => {
    const sesiones: Sesion[] = [
      { id: "s2", fecha: "2026-10-12", origen: "manual", ejercicios: [] },
      { id: "s1", fecha: "2026-10-09", origen: "manual", ejercicios: [] },
    ];
    const html = ventanaRegistro(datos({ sesiones }));
    expect(html).toContain('data-accion="historial"');
    expect(html).toContain("Ver todo · 2 entrenamientos");
    expect(html.indexOf("LUN")).toBeLessThan(html.indexOf("VIE"));
  });

  it("muestra su semana con lo que anotó y el día que le toca en el botón", () => {
    const sesiones: Sesion[] = [{
      id: "s1", fecha: "2026-10-12", origen: "manual",
      iniciada: ts("2026-10-12T13:05:00Z"), creada: ts("2026-10-12T13:57:00Z"),
      ejercicios: [
        { ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }] },
        { ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 45, peso: null }] },
      ],
    }];
    const html = ventanaRegistro(datos({ hoy: "2026-10-13", sesiones, promedioMinutos: 47 }));
    expect(html).toContain("Tu semana");
    expect(html).toContain("▶ Iniciar entrenamiento · Pecho");
    expect(html).toMatch(/registro-semana-num hecho[^>]*>12</);
    expect(html).toMatch(/registro-semana-num es-hoy[^>]*>13</);
    expect(html).toContain("<strong>47 min</strong><span>promedio por sesión");
    expect(html).toContain("<strong>52 min</strong>");
    expect(html).toContain("<strong>3</strong><span>series");
    expect(html).toContain("Press de banca y Plancha");
  });

  it("sin día que le toque, el botón no inventa uno", () => {
    const html = ventanaRegistro(datos({ dia: null }));
    expect(html).toContain("▶ Iniciar entrenamiento</button>");
  });

  it("con un entrenamiento abierto, Registro se abre en él", () => {
    ponerEstadoRegistro({ vista: "inicio", borrador: nuevoBorrador("b1234567", "2026-10-12", Date.UTC(2026, 9, 12, 17, 32)) });
    const html = ventanaRegistro(datos());
    expect(html).toContain("Agrega tu primer ejercicio");
    expect(html).not.toContain("Iniciar entrenamiento");
    // El título va arriba, en la cabecera junto al ☰, no dentro del contenido.
    expect(html).not.toContain("Entrenamiento en curso");
    expect(cabeceraRegistro()?.titulo).toBe("Entrenamiento en curso");
    expect(cabeceraRegistro()?.detalle).toMatch(/^lunes, 12 de octubre · desde las 10:32/);
  });

  it("sin entrenamiento abierto la cabecera queda vacía", () => {
    ventanaRegistro(datos());
    expect(cabeceraRegistro()).toBeNull();
  });
});

describe("historial", () => {
  it("cada entrenamiento con su fecha, horario, duración y series; las de tiempo en segundos", () => {
    ponerEstadoRegistro({ vista: "historial", borrador: null });
    const sesiones: Sesion[] = [{
      id: "s1", fecha: "2026-10-12", origen: "manual",
      iniciada: ts("2026-10-12T17:32:00Z"), creada: ts("2026-10-12T18:20:00Z"),
      ejercicios: [
        { ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }] },
        { ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 45, peso: null }] },
      ],
    }];
    const html = ventanaRegistro(datos({ sesiones }));
    expect(html).toContain("Tu historial");
    expect(html).toContain("lunes, 12 de octubre");
    expect(html).toMatch(/10:32.*–.*11:20.*· 48 min · 2 ejercicios/);
    expect(html).toContain("40 kg × 10 · 42.5 kg × 8");
    expect(html).toContain("45 s");
  });

  it("una sesión vieja sin hora de inicio muestra solo cuándo terminó", () => {
    ponerEstadoRegistro({ vista: "historial", borrador: null });
    const sesiones: Sesion[] = [{ id: "s1", fecha: "2026-10-12", origen: "manual", creada: ts("2026-10-12T18:20:00Z"), ejercicios: [] }];
    expect(ventanaRegistro(datos({ sesiones }))).toMatch(/Terminado a las 11:20/);
  });
});

describe("elegir", () => {
  it("agrupa por los grupos del día, con el GIF de cada ejercicio, y luego los demás", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12") });
    const html = ventanaRegistro(datos());
    expect(html).toContain("Hoy te toca Pecho");
    expect(html.indexOf(">Pecho<")).toBeLessThan(html.indexOf("Más ejercicios"));
    expect(html.indexOf("Más ejercicios")).toBeLessThan(html.indexOf(">Abdomen<"));
    expect(html).toContain("ejercicios%2Fpress-banca.webp");
    expect(html).toContain('data-agregar="plancha"');
    expect(html).toContain("registro-sin-gif");
    expect(html).toContain("© Gym visual");
    expect(html).not.toContain("registro-buscar");
  });

  it("respeta la lista que configuró el entrenador para cada grupo", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12") });
    const html = ventanaRegistro(datos({ config: { porGrupo: { pecho: ["plancha"] } } }));
    const pecho = html.slice(html.indexOf(">Pecho<"), html.indexOf("Más ejercicios"));
    expect(pecho).toContain('data-agregar="plancha"');
    expect(pecho).not.toContain('data-agregar="press-banca"');
  });

  it("lo que ya está en el entrenamiento sale deshabilitado", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    const html = ventanaRegistro(datos());
    expect(html).toMatch(/class="registro-opcion agregado" data-agregar="press-banca"\s+disabled/);
    expect(html).toContain("✓ Ya en tu entrenamiento");
    expect(html).not.toMatch(/data-agregar="plancha"\s+disabled/);
  });
});

describe("capturar", () => {
  it("el activo va en grande con sus campos; los demás comprimidos arriba y abajo", () => {
    let b = agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 2);
    b = agregarEjercicio(b, plancha, null, 1);
    b = agregarEjercicio(b, { ...press, id: "otro", nombre: "Otro" }, null, 1);
    ponerEstadoRegistro({ vista: "capturar", borrador: b, activo: 1 });
    const html = ventanaRegistro(datos());
    // Solo la plancha (activa) tiene campos: segundos y sin kg.
    expect(html.match(/data-campo="reps"/g)).toHaveLength(1);
    expect(html).not.toContain('data-campo="peso"');
    expect(html).toContain(">seg<");
    // Press arriba, Otro abajo, comprimidos.
    expect(html.indexOf('class="registro-compacto" data-activar="0"')).toBeLessThan(html.indexOf("registro-ejercicio activo"));
    expect(html.indexOf("registro-ejercicio activo")).toBeLessThan(html.indexOf('class="registro-compacto" data-activar="2"'));
    expect(html).toContain("2 de 3");
    expect(html).toContain("Sin anotar");
  });

  it("con nota de peso del banco (disco), la muestra en lugar de la de mancuerna", () => {
    const frontales: EjercicioBanco = {
      id: "elevaciones-frontales", nombre: "Elevaciones frontales con disco", tipo: "peso", grupo: "hombro",
      musculos: { hombro: 1 }, gifRuta: null, notaPeso: "Ingresa el peso del disco.", pesoPorMancuerna: true,
    };
    ponerEstadoRegistro({ vista: "capturar", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), frontales, null, 2) });
    const html = ventanaRegistro(datos({ banco: [frontales], indice: indiceBanco([frontales]) }));
    expect(html).toContain("Ingresa el peso del disco.");
    expect(html).not.toContain("el peso de una mancuerna");
  });

  it("sin elegir uno, el activo es el último agregado", () => {
    let b = agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 2);
    b = agregarEjercicio(b, plancha, null, 1);
    ponerEstadoRegistro({ vista: "capturar", borrador: b });
    const html = ventanaRegistro(datos());
    expect(html).toMatch(/registro-ejercicio activo" data-indice="1"/);
    expect(html).toContain('data-activar="0"');
  });

  it("con un solo ejercicio no muestra Anterior/Siguiente", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 2) });
    const html = ventanaRegistro(datos());
    expect(html).not.toContain("Siguiente");
    expect(html.match(/data-campo="peso"/g)).toHaveLength(2);
  });

  it("termina el entrenamiento en vez de solo guardarlo", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    const html = ventanaRegistro(datos());
    expect(html).toContain("Terminar entrenamiento");
    expect(html).toContain("Eliminar entrenamiento");
    // Hasta abajo, después del crédito: lejos de "Terminar entrenamiento".
    expect(html.indexOf("Eliminar entrenamiento")).toBeGreaterThan(html.indexOf("registro-credito"));
  });

  it("sin entrenamiento abierto no hay qué capturar: vuelve al inicio", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: null });
    expect(ventanaRegistro(datos())).toContain("Iniciar entrenamiento");
  });
});

describe("video del ejercicio", () => {
  const conVideo: EjercicioBanco = { ...press, videoRuta: "ejercicios/press-banca.mp4" };

  it("el activo con video lo reproduce en bucle, sin sonido y en línea, con el GIF de póster", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    const html = ventanaRegistro(datos({ banco: [conVideo, plancha], indice: indiceBanco([conVideo, plancha]) }));
    expect(html).toMatch(/<video[^>]*class="registro-ej-gif registro-ej-video"/);
    expect(html).toContain("ejercicios%2Fpress-banca.mp4?alt=media");
    for (const attr of ["autoplay", "muted", "loop", "playsinline"]) expect(html).toMatch(new RegExp(`<video[^>]*\\s${attr}[\\s>]`));
    expect(html).toMatch(/<video[^>]*poster="[^"]*press-banca\.webp/);
  });

  it("toma el video del banco aunque el entrenamiento se haya empezado antes de que existiera", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    expect(ventanaRegistro(datos({ banco: [conVideo], indice: indiceBanco([conVideo]) }))).toContain("<video");
  });

  it("sin video sigue el GIF, y el grid nunca carga videos", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    expect(ventanaRegistro(datos())).not.toContain("<video");
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12") });
    expect(ventanaRegistro(datos({ banco: [conVideo], indice: indiceBanco([conVideo]) }))).not.toContain("<video");
  });
});

describe("editar y eliminar del historial", () => {
  const guardada: Sesion = {
    id: "sesion123abc", fecha: "2026-10-10", origen: "manual",
    ejercicios: [{ ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 10, peso: 40 }] }],
  };

  it("cada entrenamiento del historial trae Editar y Eliminar", () => {
    ponerEstadoRegistro({ vista: "historial", borrador: null });
    const html = ventanaRegistro(datos({ sesiones: [guardada] }));
    expect(html).toContain(`data-editar="sesion123abc"`);
    expect(html).toContain(`data-borrar="sesion123abc"`);
  });

  it("editando: guarda cambios en vez de terminar, y la cabecera dice qué día se corrige", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: borradorDeSesion(guardada, banco) });
    const html = ventanaRegistro(datos({ sesiones: [guardada] }));
    expect(html).toContain("Guardar cambios");
    expect(html).toContain("Cancelar cambios");
    expect(html).not.toContain("Terminar entrenamiento");
    expect(cabeceraRegistro()).toEqual({ titulo: "Editando entrenamiento", detalle: "sábado, 10 de octubre" });
  });
});

describe("avisoReps", () => {
  it("dice cuántas reps escribió y trae los dos botones", () => {
    const html = avisoReps(25);
    expect(html).toContain("¿Estás seguro que hiciste 25 reps?");
    expect(html).toContain("No es que desconfíe de ti o algo, pero son muchas.");
    expect(html).toMatch(/data-reps="corregir">No, me equivoqué</);
    expect(html).toMatch(/data-reps="seguir">Sí, continuar</);
  });
});

describe("entrenamientos sin internet", () => {
  it("avisa cuántos esperan internet para enviarse", () => {
    expect(ventanaRegistro(datos({ pendientes: 1 }))).toContain("1 entrenamiento espera internet para enviarse.");
    expect(ventanaRegistro(datos({ pendientes: 3 }))).toContain("3 entrenamientos esperan internet para enviarse.");
    expect(ventanaRegistro(datos())).not.toContain("registro-pendientes");
  });
});

describe("promedio por sesión", () => {
  it("sin sesiones medidas dice —, y pasando de una hora usa horas", () => {
    expect(ventanaRegistro(datos())).toContain("<strong>—</strong><span>promedio por sesión");
    expect(ventanaRegistro(datos({ promedioMinutos: 65 }))).toContain("<strong>1 h 05</strong><span>promedio por sesión");
  });
});


describe("entrenamiento guiado", () => {
  it("abre la captura con el ejercicio del día en grande, su GIF y lo que pide la rutina", () => {
    expect(empezarGuiado(datos(), Date.UTC(2026, 9, 12, 17, 0))).toBe(true);
    expect(entrenamientoAbierto()).toBe("nuevo");
    const html = ventanaRegistro(datos());
    expect(html).toContain("registro-ejercicio activo");
    expect(html).toContain("Press de banca");
    expect(html).toContain("ejercicios%2Fpress-banca.webp");
    expect(html).toContain("Tu rutina: 4 × 10");
    expect(html.match(/data-campo="reps"/g)).toHaveLength(4);
    expect(cabeceraRegistro()?.titulo).toBe("Entrenando · Pecho");
  });

  it("con uno abierto no arma otro", () => {
    const b = nuevoBorrador("b1234567", "2026-10-12");
    ponerEstadoRegistro({ vista: "inicio", borrador: b });
    expect(empezarGuiado(datos())).toBe(false);
    expect(ventanaRegistro(datos())).toContain("Agrega tu primer ejercicio");
  });

  it("avisa de los ejercicios de la rutina que no están en el banco", () => {
    const dia = { nombreDia: "Pecho", ejercicios: [{ nombre: "Máquina inventada", series: 3, repeticiones: "12", pesoONota: "" }] };
    empezarGuiado(datos({ dia }));
    expect(ventanaRegistro(datos({ dia }))).toContain("Máquina inventada");
  });
});

describe("cronómetro", () => {
  it("corre desde que inició el entrenamiento, en la captura y al elegir", () => {
    const inicio = Date.UTC(2026, 9, 12, 17, 0);
    ponerEstadoRegistro({ vista: "capturar", borrador: nuevoBorrador("b1234567", "2026-10-12", inicio) });
    expect(ventanaRegistro(datos())).toContain(`data-desde="${inicio}"`);
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12", inicio) });
    expect(ventanaRegistro(datos())).toContain(`data-desde="${inicio}"`);
  });
  it("no sale al corregir uno ya guardado", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: { ...nuevoBorrador("b1234567", "2026-10-12", 1000), edicion: true } });
    expect(ventanaRegistro(datos())).not.toContain("data-desde");
  });
});

describe("resumen al terminar", () => {
  const resumen = {
    minutos: 48, ejercicios: 2, series: 7, kilos: 1240,
    musculos: [{ musculo: "pecho", nombre: "Pecho", principal: true }, { musculo: "hombro", nombre: "Hombros", principal: false }],
    subidas: [{ musculo: "pecho", nombre: "Pecho", antes: 2, despues: 3, nivel: 4.1 }],
    enTelefono: false, guiado: true, dia: "Pecho y hombro",
  };
  it("muestra duración, lo que hizo, lo que subió de rango y los músculos", () => {
    ponerEstadoRegistro({ vista: "resumen", borrador: null, resumen });
    const html = ventanaRegistro(datos({ sexo: "M" }));
    expect(html).toContain("¡Entrenamiento terminado!");
    expect(html).toContain("Pecho y hombro");
    expect(html).toContain("<strong>48 min</strong>");
    expect(html).toContain("1,240 kg");
    expect(html).toContain("¡Subiste de rango!");
    expect(html).toContain("En forma → Intermedio");
    expect(html).toContain('resumen-musculo principal">Pecho');
    expect(html).toContain('data-accion="listo"');
    expect(html).not.toContain("se enviará solo");
  });
  it("sin internet avisa que se guardó en el teléfono", () => {
    ponerEstadoRegistro({ vista: "resumen", borrador: null, resumen: { ...resumen, enTelefono: true, subidas: [] } });
    const html = ventanaRegistro(datos());
    expect(html).toContain("se enviará solo");
    expect(html).not.toContain("Subiste de rango");
  });
  it("sin resumen regresa al inicio de Registro", () => {
    ponerEstadoRegistro({ vista: "resumen", borrador: null });
    expect(ventanaRegistro(datos())).toContain("Tu semana");
  });
});

describe("biseries y dropsets", () => {
  const remo: EjercicioBanco = { id: "remo", nombre: "Remo con barra", tipo: "peso", grupo: "espalda", musculos: { espalda: 1 }, gifRuta: null };
  const conRemo = (campos: Partial<DatosRegistro> = {}) => datos({ banco: [press, plancha, remo], indice: indiceBanco([press, plancha, remo]), ...campos });
  const biserie = () => agregarBiserie(nuevoBorrador("b1234567", "2026-10-12", Date.now()),
    { e: press, previas: [{ reps: 10, peso: 40, caidas: [{ reps: 8, peso: 30 }] }], seriesRutina: null },
    { e: remo, previas: null, seriesRutina: 1 });

  it("el selector abre en un ejercicio; en biserie marca A y B y habilita agregarlas", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12") });
    let html = ventanaRegistro(conRemo());
    expect(html).toMatch(/data-modo="uno" aria-pressed="true"/);
    expect(html).toContain('data-agregar="remo"');
    expect(html).not.toContain("Agregar biserie");

    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12"), modoElegir: "biserie", seleccion: ["press-banca"] });
    html = ventanaRegistro(conRemo());
    expect(html).toContain('data-biserie-elegir="remo"');
    expect(html).not.toContain('data-agregar="remo"');
    expect(html).toMatch(/registro-opcion marcada" data-biserie-elegir="press-banca"/);
    expect(html).toMatch(/data-accion="agregar-biserie" disabled/);

    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12"), modoElegir: "biserie", seleccion: ["press-banca", "remo"] });
    html = ventanaRegistro(conRemo());
    expect(html).toMatch(/data-accion="agregar-biserie" >/);
    expect(html).toContain('aria-label="Ejercicio B">B<');
  });

  it("la biserie se captura en un bloque, por rondas A y B, con sus bajadas", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: biserie(), activo: 1 });
    const html = ventanaRegistro(conRemo());
    expect(html).toContain("<span>Biserie</span>");
    expect(html).not.toContain("🔗");
    expect(html).toContain("Ronda 1");
    expect(html).toMatch(/registro-serie-num letra tocable[^>]*data-menu-serie="0:0"[^>]*>A</);
    expect(html).toMatch(/data-menu-serie="1:0"[^>]*>B</);
    expect(html).toContain('data-caida="0" data-campo="peso"');
    expect(html).toContain('data-agregar-ronda="0"');
    expect(html).not.toContain("data-quitar-serie");
  });

  it("tocar el número de la serie ofrece agregar una bajada", () => {
    const b = agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12", Date.now()), press, [{ reps: 10, peso: 40 }], null);
    ponerEstadoRegistro({ vista: "capturar", borrador: b });
    expect(ventanaRegistro(datos())).not.toContain("data-agregar-caida");
    ponerEstadoRegistro({ vista: "capturar", borrador: b, menuSerie: "0:0" });
    expect(ventanaRegistro(datos())).toContain('data-agregar-caida="0:0"');
  });

  it("los de tiempo no tienen dropset", () => {
    const b = agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12", Date.now()), plancha, null, 1);
    ponerEstadoRegistro({ vista: "capturar", borrador: b });
    expect(ventanaRegistro(datos())).not.toContain("data-menu-serie");
  });

  it("el historial marca la biserie y pega las bajadas a su serie", () => {
    ponerEstadoRegistro({ vista: "historial", borrador: null });
    const sesiones: Sesion[] = [{
      id: "s1", fecha: "2026-10-12", origen: "manual", ejercicios: [
        { ejercicioId: "press-banca", nombre: "Press de banca", biserie: "b1", series: [{ reps: 10, peso: 40, caidas: [{ reps: 8, peso: 30 }] }] },
        { ejercicioId: "remo", nombre: "Remo con barra", biserie: "b1", series: [{ reps: 12, peso: 30 }] },
      ],
    }];
    const html = ventanaRegistro(conRemo({ sesiones }));
    expect(html).toContain('ejercicio A">A</span>Press de banca');
    expect(html).toContain('ejercicio B">B</span>Remo con barra');
    expect(html).toContain("40 kg × 10 ↓ 30 kg × 8");
  });
});
