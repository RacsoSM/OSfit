/** Tipos de `hojasDeEstilo.mjs` (para `estilo.test.ts`). */
import type { Plugin } from "vite";
export declare const ESTILOS_CON_HOJA: readonly string[];
export declare function archivoDeHoja(id: string): string;
export declare function scriptDeHojas(mapa: Record<string, string>): string;
export declare function hojasDeEstilo(raiz: string): Plugin;
