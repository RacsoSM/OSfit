import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db } from "./comun";

/** Un token FCM web ronda los 150-200 caracteres; 4096 deja aire sin aceptar basura. */
const LARGO_MAXIMO_TOKEN = 4096;

/**
 * Id del documento: hash del token. Asi registrar el mismo telefono en cada carga de la
 * pagina pisa el mismo documento en vez de llenar la subcoleccion de copias.
 */
export function idDispositivo(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function registroValido(
  data: unknown
): { token: string; plataforma: "ios" | "android" | "otro" } | null {
  if (typeof data !== "object" || data === null) return null;
  const { token, plataforma } = data as { token?: unknown; plataforma?: unknown };
  if (typeof token !== "string" || token === "" || token.length > LARGO_MAXIMO_TOKEN) return null;
  const conocida = plataforma === "ios" || plataforma === "android" ? plataforma : "otro";
  return { token, plataforma: conocida };
}

/**
 * Guarda el token de notificaciones del telefono de la clienta.
 *
 * El clienteId sale del claim de la sesion, nunca del body. Si el entrenador no la habilito,
 * no se guarda nada: un token guardado de una clienta no habilitada no serviria para nada y
 * quedaria ahi esperando a que alguien olvide revisar la llave.
 */
export const registrarDispositivo = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);
  const registro = registroValido(request.data);
  if (!registro) throw new HttpsError("invalid-argument", "token_invalido");

  const cliente = db().collection("clientes").doc(clienteId);
  if ((await cliente.get()).get("notificacionesWeb") !== true) {
    throw new HttpsError("failed-precondition", "no_habilitada");
  }

  const ref = cliente.collection("dispositivos").doc(idDispositivo(registro.token));
  const existe = (await ref.get()).exists;
  await ref.set(
    {
      token: registro.token,
      plataforma: registro.plataforma,
      actualizado: FieldValue.serverTimestamp(),
      ...(existe ? {} : { creado: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );
  return { ok: true };
});
