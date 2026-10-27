/**
 * Carga las sedes: `docs/sedes/sedes.json` → `sedes/{id}`. Cada sede se escribe completa (sin
 * `merge`), así que un factor que se quita del archivo se quita del banco. No borra sedes que
 * ya no estén en el archivo: alguna clienta podría tenerla asignada.
 *
 * Uso, desde `functions/`:
 *
 *   node scripts/cargarSedes.mjs --prueba   # solo valida
 *   node scripts/cargarSedes.mjs            # carga
 *
 * Credencial: la misma que `cargarBancoEjercicios.mjs`.
 */
import { readFileSync } from "node:fs";
import { erroresSedes } from "./sedes.mjs";

const PROYECTO = "osfit-cccfe";
const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));

async function main() {
  const semilla = leer("../semilla/ejercicios.json");
  const archivo = leer("../../docs/sedes/sedes.json");
  const errores = erroresSedes(archivo, semilla);
  if (errores.length > 0) {
    console.error(errores.join("\n"));
    process.exit(1);
  }
  const ids = Object.keys(archivo);
  console.log(`${ids.length} sedes, sin errores.`);
  if (process.argv.includes("--prueba")) return;

  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: applicationDefault(), projectId: PROYECTO });
  const db = getFirestore();
  const lote = db.batch();
  for (const id of ids) {
    const { nombre, factores } = archivo[id];
    lote.set(db.collection("sedes").doc(id), { nombre, factores });
  }
  await lote.commit();
  for (const id of ids) {
    console.log(`✓ ${id}: ${archivo[id].nombre} (${Object.keys(archivo[id].factores).length} máquinas con factor)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
