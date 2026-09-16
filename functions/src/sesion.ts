import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { REGION, db } from "./comun";
import { contarEntrada } from "./contador";

/**
 * Canjea el token del link magico por un custom token de Firebase con el claim `clienteId`.
 *
 * El claim es lo que hace que las reglas de Firestore puedan acotar al cliente a sus propios
 * datos: viaja dentro de un token firmado por Firebase, asi que el navegador no puede
 * falsificarlo.
 */
export const sesion = onRequest(
  { region: REGION, cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "metodo_no_permitido" });
      return;
    }

    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!token) {
      res.status(400).json({ error: "falta_token" });
      return;
    }

    const doc = await db().collection("accesosWeb").doc(token).get();

    // 404 generico a proposito: no distingue "nunca existio" de "revocado", para no
    // confirmarle nada a quien pruebe tokens al azar.
    if (!doc.exists) {
      res.status(404).json({ error: "acceso_invalido" });
      return;
    }

    const clienteId = doc.get("clienteId") as string;
    const customToken = await getAuth().createCustomToken(clienteId, { clienteId });

    // Se cuenta con el canje ya resuelto: si contar se cae, la sesion ya esta hecha.
    await contarEntrada(doc.ref);

    res.json({ customToken, clienteId });
  }
);
