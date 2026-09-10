import type { Asistencia } from "../datos";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Lunes primero, como el calendario de la app. */
function columnaDe(fecha: Date): number {
  return (fecha.getUTCDay() + 6) % 7;
}

/**
 * Un mes por vez, y abre en el actual. La app deja recorrer meses porque el entrenador
 * audita historial; el cliente solo quiere saber si faltó esta semana.
 */
export function calendario(asistencias: Asistencia[], mes: string, hoy: string): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(anio, numeroMes - 1, 1));
  const diasEnMes = new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate();

  const porFecha = new Map(asistencias.map((a) => [a.fecha, a]));

  const celdas: string[] = [];
  for (let i = 0; i < columnaDe(primero); i++) {
    celdas.push(`<span class="vacia"></span>`);
  }

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
    const registro = porFecha.get(fecha);
    const clases: string[] = [];
    if (registro?.asistio) clases.push("ok");
    else if (registro?.justificada) clases.push("just");
    else if (registro) clases.push("no");
    if (fecha === hoy) clases.push("hoy-celda");
    celdas.push(`<span class="${clases.join(" ")}">${dia}</span>`);
  }

  const esMesActual = mes >= hoy.slice(0, 7);

  return `
    <div class="tarjeta">
      <div class="cal-nav">
        <button id="mes-anterior">‹</button>
        <strong>${NOMBRES_MES[numeroMes - 1]} ${anio}</strong>
        <button id="mes-siguiente" ${esMesActual ? "disabled" : ""}>›</button>
      </div>
      <div class="cal-dias"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="cal">${celdas.join("")}</div>
      <div class="leyenda">
        <span><i class="punto" style="background: var(--verde)"></i>Viniste</span>
        <span><i class="punto" style="background: var(--rojo)"></i>Faltaste</span>
        <span><i class="punto" style="background: var(--ambar)"></i>Justificada</span>
      </div>
    </div>`;
}

/** Mes anterior o siguiente en formato "AAAA-MM". */
export function moverMes(mes: string, delta: number): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(anio, numeroMes - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
