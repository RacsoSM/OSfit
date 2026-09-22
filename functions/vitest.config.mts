import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `lib/` es la salida de `tsc` (ver tsconfig.json). Vitest recorre todo el proyecto por
    // defecto, así que sin esto un `lib/` que ya haya sido compilado antes de este arreglo
    // (o compilado por error de nuevo) se cuela en la corrida como si fuera código fuente.
    exclude: ["**/node_modules/**", "lib/**"],
  },
});
