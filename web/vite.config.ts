import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * La versión de este build: fecha y hora en Mazatlán, `AAMMDD.HHMM` (261015.1432 = 15 de octubre
 * de 2026, 14:32). Sale arriba a la izquierda en Inicio para saber qué deploy tiene cada clienta.
 * No sale de git a propósito: los clones de las sesiones son parciales y la cuenta de commits
 * cambiaría según la copia que haga el deploy.
 */
function versionDelBuild(ahora = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mazatlan", year: "2-digit", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(ahora).map((x) => [x.type, x.value])
  );
  return `${p.year}${p.month}${p.day}.${p.hour}${p.minute}`;
}

const VERSION = versionDelBuild();

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(VERSION),
  },
  plugins: [
    {
      // `/version.json`: la versión de este build, para que una página abierta desde antes
      // sepa que hay otra y ofrezca actualizar (`src/version.ts`).
      name: "osfit-version",
      apply: "build",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: VERSION }) });
      },
    },
  ],
  resolve: {
    alias: {
      // Firestore arrastra `re2js` aunque la página no lo use. Ver `src/re2jsVacio.ts`.
      re2js: fileURLToPath(new URL("./src/re2jsVacio.ts", import.meta.url)),
    },
  },
});
