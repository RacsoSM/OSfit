/**
 * La flecha de "atrás" de las pantallas que están dentro de otra (elegir ejercicio, el
 * historial, Amigos). Solo el ícono, sin texto, y fija arriba a la izquierda (`position:
 * fixed`, ver `.boton-atras` en `estilos.css`): por mucho que baje, regresar está siempre en el
 * mismo lugar (decisión del entrenador, 2026-10-15; antes era un "← Volver" que se iba con el
 * scroll).
 *
 * `atributos` son los `data-*` con los que la pantalla reconoce el toque: cada una ya tiene su
 * listener delegado, y la flecha va dentro de su raíz para que lo alcance.
 */
export function botonAtras(atributos: string): string {
  return `
    <button type="button" class="boton-atras" aria-label="Volver" title="Volver" ${atributos}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19 12H5"/><path d="M11 5l-7 7 7 7"/>
      </svg>
    </button>`;
}

/**
 * Con la flecha en pantalla, la cabecera le deja su esquina (`body.con-atras`): sin esto el
 * título de la ventana quedaría debajo de ella. Se llama después de cada repintado.
 */
export function marcarBotonAtras(contenido: ParentNode): void {
  document.body.classList.toggle("con-atras", contenido.querySelector(".boton-atras") !== null);
}
