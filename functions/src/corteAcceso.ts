/**
 * Si una sesión sigue valiendo frente a la fecha de corte del cliente.
 *
 * `authTime` es el `auth_time` del token: la hora del canje original, en segundos, que no
 * cambia al renovarse. `corteMillis` es `accesoRevocadoEn` en milisegundos, o `null` si
 * nunca se revocó. Estrictamente mayor: una sesión del mismo segundo que el corte no pasa.
 *
 * GEMELO de `sesionVigente` en `firestore.rules` y `storage.rules`.
 * Ver docs/superpowers/specs/2026-10-10-revocar-acceso-design.md.
 */
export function sesionVigente(authTime: number | undefined, corteMillis: number | null): boolean {
  if (corteMillis === null) return true;
  return typeof authTime === "number" && authTime * 1000 > corteMillis;
}
