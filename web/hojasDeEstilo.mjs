/**
 * Las hojas de los estilos de Ajustes (pixel, neón, cómic, minimalista, sakura y halloween), cada
 * una en su propio archivo (2026-11-26). Antes iban todas dentro del CSS de la página, y cada
 * clienta bajaba y leía las seis aunque use una o ninguna.
 *
 * En el build se emiten minificadas y con hash (`assets/estiloSakura-….css`), y al final del
 * `<head>` va un script con el mapa estilo → archivo que, si hay un estilo elegido, escribe su
 * `<link>` ahí mismo: después del CSS de la página (a igual especificidad gana el último) y antes
 * de pintar nada, así no se ve primero el clásico. Al cambiar de estilo en Ajustes, la hoja se
 * pide con ese mismo mapa (`hojaDeEstilo` en `src/estilo.ts`). El service worker la guarda con
 * lo demás: el mapa nombra los archivos en el HTML (`public/sw.js`).
 *
 * En `.mjs` y no dentro de `vite.config.ts` para que el build de pruebas la use igual.
 */
import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";

/** Gemela de `ESTILOS` en `src/estilo.ts` sin el clásico (lo revisa `estilo.test.ts`). */
export const ESTILOS_CON_HOJA = ["pixel", "neon", "comic", "minimalista", "sakura", "halloween"];
export const archivoDeHoja = (id) => `estilo${id[0].toUpperCase()}${id.slice(1)}.css`;

/** El script que va al final del `<head>`. */
export function scriptDeHojas(mapa) {
  return `<script>
      window.__hojasEstilo = ${JSON.stringify(mapa)};
      try {
        var e = document.documentElement.getAttribute("data-estilo");
        if (e && window.__hojasEstilo[e]) document.write('<link rel="stylesheet" id="hoja-' + e + '" href="' + window.__hojasEstilo[e] + '">');
      } catch (_) {}
    </script>
  `;
}

export function hojasDeEstilo(raiz) {
  let construyendo = false;
  return {
    name: "osfit-hojas-de-estilo",
    configResolved(c) {
      construyendo = c.command === "build";
    },
    buildStart() {
      if (!construyendo) return;
      for (const id of ESTILOS_CON_HOJA) {
        const nombre = archivoDeHoja(id);
        const { code } = transform({ filename: nombre, code: fs.readFileSync(path.join(raiz, "src", nombre)), minify: true });
        this.emitFile({ type: "asset", name: nombre, source: code });
      }
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const mapa = {};
        for (const id of ESTILOS_CON_HOJA) {
          const nombre = archivoDeHoja(id);
          if (!ctx.bundle) { mapa[id] = `/src/${nombre}`; continue; }
          const hoja = Object.values(ctx.bundle).find((o) => o.type === "asset" && (o.names?.includes(nombre) || o.name === nombre));
          if (!hoja) throw new Error(`Falta la hoja ${nombre} en el build`);
          mapa[id] = `/${hoja.fileName}`;
        }
        return html.replace("</head>", `${scriptDeHojas(mapa)}</head>`);
      },
    },
  };
}
