/**
 * Sube el video corto de un ejercicio del banco y lo deja listo para la web y la app:
 * Storage `ejercicios/<id>.mp4` y `videoRuta` en `ejercicios/{id}`.
 *
 * Uso, desde `functions/`:
 *
 *   node scripts/subirVideoEjercicio.mjs press-banca ruta/al/video.mp4
 *   node scripts/subirVideoEjercicio.mjs press-banca --quitar   # vuelve al GIF
 *
 * El video tiene que venir ya preparado: MP4 (H.264), cuadrado, sin audio, en bucle y con
 * `faststart` (el índice al principio, para que empiece a reproducirse antes de bajar
 * completo). Credenciales: las mismas que `cargarBancoEjercicios.mjs`.
 */
import { readFileSync, statSync } from "node:fs";
import { rutaVideo } from "./bancoEjercicios.mjs";

const PROYECTO = "osfit-cccfe";
const BUCKET = "osfit-cccfe.firebasestorage.app";
/** Un bucle de pocos segundos a 720 px pesa 100–300 kB; más de esto es un video sin preparar. */
const MAXIMO_BYTES = 3 * 1024 * 1024;

const [id, archivo] = process.argv.slice(2);
if (!id || !archivo) {
  console.error("Uso: node scripts/subirVideoEjercicio.mjs <id> <video.mp4 | --quitar>");
  process.exit(1);
}

const { initializeApp, applicationDefault } = await import("firebase-admin/app");
const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
const { getStorage } = await import("firebase-admin/storage");
initializeApp({ credential: applicationDefault(), projectId: PROYECTO, storageBucket: BUCKET });

const doc = getFirestore().collection("ejercicios").doc(id);
if (!(await doc.get()).exists) {
  console.error(`El ejercicio "${id}" no está en el banco.`);
  process.exit(1);
}

if (archivo === "--quitar") {
  await doc.update({ videoRuta: FieldValue.delete() });
  await getStorage().bucket().file(rutaVideo(id)).delete({ ignoreNotFound: true });
  console.log(`✓ ${id}: sin video, vuelve al GIF`);
  process.exit(0);
}

if (!archivo.toLowerCase().endsWith(".mp4")) {
  console.error("El video tiene que ser .mp4");
  process.exit(1);
}
const bytes = statSync(archivo).size;
if (bytes > MAXIMO_BYTES) {
  console.error(`Pesa ${Math.round(bytes / 1024)} kB: comprímelo antes (máximo ${MAXIMO_BYTES / 1024 / 1024} MB).`);
  process.exit(1);
}

await getStorage().bucket().file(rutaVideo(id)).save(readFileSync(archivo), {
  contentType: "video/mp4",
  // Un día y no un mes como los GIF: si se reemplaza el video de un ejercicio, a más tardar
  // al día siguiente todas ven el nuevo, y mientras no se baja en cada visita.
  metadata: { cacheControl: "public, max-age=86400" },
});
await doc.update({ videoRuta: rutaVideo(id) });
console.log(`✓ ${id}: video subido (${Math.round(bytes / 1024)} kB) → ${rutaVideo(id)}`);
