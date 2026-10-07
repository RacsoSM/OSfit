import { ESTILOS, esEstilo, guardarEstilo, type IdEstilo } from "../estilo";
import { almacenDeEstilo, cambiarConTransicion, ponerEstilo } from "./cambioDeEstilo";

/**
 * La ventana Ajustes. Por ahora trae una sola cosa: el combo del estilo de la página.
 *
 * El combo es un `<select>` nativo a propósito, no una lista dibujada a mano: en el teléfono
 * abre la rueda o la hoja del sistema, que es lo que la clienta ya sabe usar con una mano, y
 * el lector de pantalla lo anuncia sin que haya que reinventarle los roles ARIA. Lo único que
 * se le cambia es la cara de la caja cerrada.
 */
export function tarjetaAjustes(estilo: IdEstilo): string {
  const elegido = ESTILOS.find((e) => e.id === estilo) ?? ESTILOS[0];
  const opciones = ESTILOS.map(
    (e) => `<option value="${e.id}"${e.id === elegido.id ? " selected" : ""}>${e.nombre}</option>`
  ).join("");
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Apariencia</p>
      <label class="ajuste-etiqueta" for="selector-estilo">Estilo de la página</label>
      <div class="selector">
        <select id="selector-estilo" class="selector-campo" aria-describedby="estilo-descripcion">
          ${opciones}
        </select>
        <span class="selector-flecha" aria-hidden="true">▾</span>
      </div>
      <p class="ajuste-nota" id="estilo-descripcion">${elegido.descripcion}</p>
      <p class="ajuste-nota ajuste-tenue">Se guarda en este teléfono.</p>
    </div>`;
}

/**
 * Cuelga el combo. Se vuelve a llamar en cada repintado, como el resto de `conectar*`:
 * `innerHTML` tira el listener junto con el elemento.
 *
 * El estilo cambia SOLO al elegir otra opción (`change`), nunca al abrir el combo ni al pasar
 * por encima de las opciones: lo que la clienta ve es lo que eligió.
 */
export function conectarAjustes(actual: IdEstilo, alCambiar: (id: IdEstilo) => void): void {
  const combo = document.querySelector<HTMLSelectElement>("#selector-estilo");
  combo?.addEventListener("change", () => {
    const id = combo.value;
    if (!esEstilo(id) || id === actual) return;
    guardarEstilo(id, almacenDeEstilo());
    cambiarConTransicion(id, () => {
      ponerEstilo(id);
      alCambiar(id);
    });
  });
}
