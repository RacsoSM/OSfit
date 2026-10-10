import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      // Firestore arrastra `re2js` aunque la página no lo use. Ver `src/re2jsVacio.ts`.
      re2js: fileURLToPath(new URL("./src/re2jsVacio.ts", import.meta.url)),
    },
  },
});
