/**
 * Sustituto de `re2js` para el bundle (ver el alias en `vite.config.ts`).
 *
 * Firestore lo importa entero —unos 250 kB de motor de expresiones regulares— solo para
 * evaluar en el teléfono los filtros `like` / `regex_contains` / `regex_match` de las
 * consultas "pipeline". La página no usa pipelines, así que esos 250 kB solo retrasaban el
 * arranque. Si algún día se usaran, `compile` tira y Firestore ya atrapa ese error: el
 * filtro sale como inválido en vez de tumbar la página.
 */
export const RE2JS = {
  compile(): never {
    throw new Error("re2js no está en el bundle de la web (ver re2jsVacio.ts)");
  },
};
