/**
 * Llena `ultimoPago` de todas las clientas con su pago más reciente, una sola vez: la función
 * `alCambiarPago` lo mantiene al día desde que se publica, pero los pagos registrados antes no
 * la dispararon. Escribe lo mismo que ella (ver `src/ultimoPago.ts`): fecha, monto y
 * vencimiento, nunca la nota.
 *
 * Uso, desde `functions/`:
 *
 *   node scripts/rellenarUltimoPago.mjs --prueba   # solo muestra lo que escribiría
 *   node scripts/rellenarUltimoPago.mjs            # escribe
 *
 * Credencial: la misma que `cargarBancoEjercicios.mjs`.
 */
const PROYECTO = "osfit-cccfe";
const fecha = (t) => (t && typeof t.toDate === "function"
  ? t.toDate().toLocaleDateString("en-CA", { timeZone: "America/Mazatlan" }) : null);

async function main() {
  const prueba = process.argv.includes("--prueba");
  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: applicationDefault(), projectId: PROYECTO });
  const db = getFirestore();
  const clientes = await db.collection("clientes").get();
  let con = 0;
  for (const c of clientes.docs) {
    const pagos = await c.ref.collection("pagos").orderBy("fecha", "desc").limit(1).get();
    const p = pagos.docs[0]?.data();
    if (!p || !fecha(p.fecha)) continue;
    const ultimoPago = {
      fecha: fecha(p.fecha),
      monto: typeof p.monto === "number" && Number.isFinite(p.monto) ? p.monto : 0,
      vence: fecha(p.fechaProximoPagoGenerada),
    };
    con += 1;
    if (!prueba) await c.ref.update({ ultimoPago });
  }
  console.log(`${clientes.size} clientas, ${con} con pagos${prueba ? " (prueba: nada escrito)" : " actualizadas"}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
