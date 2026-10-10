/**
 * Carga el banco de ejercicios: `functions/semilla/ejercicios.json` → Firestore
 * (`ejercicios/{id}`) y su GIF → Storage (`ejercicios/<id>.webp`).
 *
 * Uso, desde `functions/`:
 *
 *   node scripts/cargarBancoEjercicios.mjs --prueba     # solo valida y deja los .webp en
 *                                                       # scripts/salida/ para verlos
 *   node scripts/cargarBancoEjercicios.mjs              # carga todo
 *   node scripts/cargarBancoEjercicios.mjs press-banca  # carga solo esos ids
 *
 * Para cargar hace falta una credencial con permiso sobre `osfit-cccfe`:
 * `gcloud auth application-default login` con la cuenta del proyecto, o la variable
 * `GOOGLE_APPLICATION_CREDENTIALS` apuntando a la llave de una cuenta de servicio.
 *
 * Se puede correr las veces que haga falta: escribe con `merge` (no borra los `estandares`
 * que se agreguen después) y vuelve a subir el mismo archivo.
 *
 * **Por qué WebP y no el GIF tal cual:** el mismo GIF de 180×180 pasa de ~125 kB a ~40 kB
 * con los mismos cuadros, y la página la abren con datos móviles. Todos los navegadores que
 * abren la web (Safari 14+, Chrome) muestran WebP animado.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import {
  DATASET,
  documentoDe,
  rutaGif,
  urlDelDataset,
  validarSemilla,
} from "./bancoEjercicios.mjs";

const PROYECTO = "osfit-cccfe";
const BUCKET = "osfit-cccfe.firebasestorage.app";

const args = process.argv.slice(2);
const prueba = args.includes("--prueba");
const soloIds = args.filter((a) => !a.startsWith("--"));

async function descargar(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} al bajar ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function aWebp(gif) {
  // `animated: true` conserva todos los cuadros; sin él sharp se queda con el primero.
  return sharp(gif, { animated: true }).webp({ quality: 75, effort: 6 }).toBuffer();
}

async function main() {
  const semilla = JSON.parse(
    readFileSync(new URL("../semilla/ejercicios.json", import.meta.url), "utf8")
  );

  console.log(`Bajando el índice de ${DATASET.repo}@${DATASET.commit.slice(0, 7)}…`);
  const dataset = JSON.parse((await descargar(urlDelDataset("data/exercises.json"))).toString());
  const gifPorId = new Map(dataset.map((x) => [x.id, x.gif_url]));

  const errores = validarSemilla(semilla, new Set(gifPorId.keys()));
  if (errores.length > 0) {
    console.error("La semilla tiene errores, no se carga nada:\n  " + errores.join("\n  "));
    process.exit(1);
  }

  const desconocidos = soloIds.filter((id) => !semilla.some((e) => e.id === id));
  if (desconocidos.length > 0) {
    console.error(`No están en la semilla: ${desconocidos.join(", ")}`);
    process.exit(1);
  }
  const elegidos = soloIds.length > 0 ? semilla.filter((e) => soloIds.includes(e.id)) : semilla;

  let db = null;
  let bucket = null;
  if (!prueba) {
    // Se importan aquí para que `--prueba` funcione sin credenciales.
    const { initializeApp, applicationDefault } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const { getStorage } = await import("firebase-admin/storage");
    initializeApp({ credential: applicationDefault(), projectId: PROYECTO, storageBucket: BUCKET });
    db = getFirestore();
    bucket = getStorage().bucket();
  } else {
    mkdirSync(new URL("./salida/", import.meta.url), { recursive: true });
  }

  let fallidos = 0;
  for (const e of elegidos) {
    try {
      const webp = await aWebp(await descargar(urlDelDataset(gifPorId.get(e.gifOrigen))));
      if (prueba) {
        writeFileSync(new URL(`./salida/${e.id}.webp`, import.meta.url), webp);
      } else {
        await bucket.file(rutaGif(e.id)).save(webp, {
          contentType: "image/webp",
          // El archivo de un id no cambia salvo que se vuelva a cargar a propósito, así que
          // el navegador lo puede guardar mucho tiempo y no lo vuelve a bajar en cada visita.
          metadata: { cacheControl: "public, max-age=2592000" },
        });
        await db.collection("ejercicios").doc(e.id).set(documentoDe(e, true), { merge: true });
      }
      console.log(`✓ ${e.id} (${Math.round(webp.length / 1024)} kB)`);
    } catch (err) {
      fallidos++;
      console.error(`✗ ${e.id}: ${err.message}`);
    }
  }

  console.log(`\n${elegidos.length - fallidos} de ${elegidos.length} ${prueba ? "convertidos (prueba, nada subido)" : "cargados"}.`);
  if (fallidos > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
