/**
 * Carga los estándares de fuerza: `docs/estandares-fuerza/estandares.json` → los campos
 * `estandares` y `pesoPorMancuerna` de `ejercicios/{id}`, y `pintan.json` → el campo `pinta`
 * (qué músculos pinta cada ejercicio en el mapa). Nada más: no toca nombres, GIF,
 * videos ni los demás campos (escribe con `merge`). El archivo lo genera
 * `docs/estandares-fuerza/proponer.py`; con él se cambian los números, no a mano.
 *
 * Uso, desde `functions/`:
 *
 *   node scripts/cargarEstandares.mjs --prueba   # solo valida
 *   node scripts/cargarEstandares.mjs            # carga
 *
 * Credencial: la misma que `cargarBancoEjercicios.mjs`.
 */
import { readFileSync } from "node:fs";
import { erroresEstandares, erroresPintan, pintaDe } from "./estandares.mjs";

const PROYECTO = "osfit-cccfe";
const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));

async function main() {
  const semilla = leer("../semilla/ejercicios.json");
  const archivo = leer("../../docs/estandares-fuerza/estandares.json");
  const pintan = leer("../../docs/estandares-fuerza/pintan.json");
  const errores = [...erroresEstandares(archivo, semilla), ...erroresPintan(pintan, semilla)];
  if (errores.length > 0) {
    console.error(errores.join("\n"));
    process.exit(1);
  }
  const ids = Object.keys(archivo);
  console.log(`${ids.length} ejercicios con estándares, sin errores.`);
  if (process.argv.includes("--prueba")) return;

  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: applicationDefault(), projectId: PROYECTO });
  const db = getFirestore();

  const faltan = [];
  const lote = db.batch();
  for (const id of ids) {
    const ref = db.collection("ejercicios").doc(id);
    if (!(await ref.get()).exists) { faltan.push(id); continue; }
    const { estandares, pesoPorMancuerna } = archivo[id];
    lote.set(ref, { estandares, pesoPorMancuerna }, { merge: true });
  }
  // Qué músculos pinta cada ejercicio (`pintan.json`): todos los de la semilla, tengan o no
  // estándares, para que la lista quede completa si después se les ponen.
  for (const e of semilla) {
    const ref = db.collection("ejercicios").doc(e.id);
    if (faltan.includes(e.id) || !(await ref.get()).exists) continue;
    lote.set(ref, { pinta: pintaDe(e, pintan) }, { merge: true });
  }
  await lote.commit();
  console.log(`✓ ${ids.length - faltan.length} ejercicios actualizados (y la lista de qué pinta cada uno).`);
  if (faltan.length > 0) console.log(`Sin documento en Firestore (no se tocaron): ${faltan.join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
