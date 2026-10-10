# Revocar el acceso de una clienta de verdad

Punto 6 de `docs/backlog-2.md`. **Propuesta, sin aprobar todavía.**

## Contexto y problema

Hoy "Revocar acceso" (ficha del cliente → `ClienteDetailViewModel.revocarAccesoWeb` →
`AccesoWebRepository.revocarAcceso`) borra `accesosWeb/{token}` y apaga `tieneAccesoWeb`. Con
eso el link ya no se puede canjear (`sesion` responde 404). Pero:

1. **La sesión que ya tiene no muere.** La función `sesion` le da una sesión de Firebase cuyo
   uid es el `clienteId` y que lleva el claim `clienteId`. Esa sesión se renueva sola cada hora
   con una llave de renovación que no vence. Las reglas (`esCliente` en `firestore.rules` y
   `storage.rules`) solo miran el claim, y las funciones callable (`clienteDeLaSesion` en
   `functions/src/comun.ts`) también. Quien ya entró sigue entrando indefinidamente.
2. **Desde el 2026-10-10 eso incluye cada apertura de la página instalada.** Para quitar el
   arranque en frío de `sesion`, `resolverSesion` entra con la sesión guardada si el token de
   la dirección es el mismo que ya se recordaba, sin volver a preguntarle a `sesion` si sigue
   vivo. Antes, la página instalada al menos volvía a canjear en cada apertura.
3. **Le siguen llegando avisos.** Sus teléfonos siguen en `clientes/{id}/dispositivos`.
4. **El botón revoca al primer toque**, sin confirmar. Un toque accidental obliga a mandarle
   un link nuevo y a que reinstale la página.

## Objetivo

Al tocar "Revocar acceso" y confirmar:

- la clienta **deja de ver sus datos en segundos**, también con la página abierta o instalada;
- sus acciones (avisar falta, ruleta, revivir, ranking, registrar teléfono) **dejan de
  funcionar** al mismo tiempo;
- **no le vuelve a llegar ningún aviso**;
- en su teléfono ve **"Tu acceso ya no está activo"**, no un error de conexión;
- si después le mandas un link nuevo, **ese sí funciona** sin hacer nada más.

## Diseño

### 1. Una fecha de corte en el cliente: `accesoRevocadoEn`

Campo nuevo y opcional en `clientes/{id}`: `accesoRevocadoEn: Timestamp`. Es el momento del
último revocado. Toda sesión que se haya **iniciado antes** de esa fecha deja de servir; una
iniciada después, con un link nuevo, sí sirve.

Para saber cuándo se inició una sesión se usa `auth_time`, que Firebase pone en cada token:
es la hora del inicio de sesión original (el canje del link) y **no cambia al renovarse**.
Nadie puede falsificarlo, porque viaja firmado igual que el claim.

En `Cliente.kt` va como opcional (`accesoRevocadoEn: Timestamp? = null`), por la regla de
siempre de Firestore.

### 2. Reglas: `esCliente` exige una sesión posterior al corte

En `firestore.rules`:

```
function sesionVigente(cid) {
  let corte = get(/databases/$(database)/documents/clientes/$(cid)).data.get('accesoRevocadoEn', null);
  return corte == null || request.auth.token.auth_time > corte.toMillis() / 1000;
}

function esCliente(cid) {
  return request.auth != null &&
         request.auth.token.clienteId == cid &&
         sesionVigente(cid);
}
```

Las reglas que hoy comparan `request.auth.token.clienteId` directamente (`asistencias`,
`cambiosDia`, `avisosFalta`, `ruletas`) pasan a usar también `sesionVigente` con el clienteId
del claim. En `clientes/{cid}` se puede leer de `resource.data` en vez de `get()`, que no
cuesta lectura extra.

En `storage.rules`, `esCliente` hace lo mismo con `firestore.get(...)`. La primera vez que se
despliegan reglas de Storage que leen Firestore, la consola pide dar un permiso a la cuenta
de servicio de reglas: aceptarlo.

**Costo:** cada `get()` en una regla cuenta como una lectura. La página abre unos 8 listeners,
así que son unas 7 lecturas más por apertura (el documento del cliente no paga extra). Con el
número de clientas actual queda muy dentro de la capa gratuita.

**Por qué no basta con anular la sesión (punto 3) y ya:** anularla impide renovarla, pero el
token que ya tiene en la mano sigue valiendo hasta una hora, y Firestore no consulta si fue
anulado. La fecha de corte es lo que la saca **en el momento**.

### 3. Función `alRevocarAcceso` (trigger)

`onDocumentDeleted("accesosWeb/{token}")`, en `us-central1` como `enviarNotificacion`
(Firestore está en `nam5`; los permisos de Eventarc ya están puestos). Con el `clienteId` del
documento borrado:

1. Escribe `accesoRevocadoEn: serverTimestamp()` en `clientes/{clienteId}`. **Primero**, porque
   es lo que corta el acceso al instante.
2. `getAuth().revokeRefreshTokens(clienteId)`: la sesión ya no se puede renovar, ni siquiera
   después de la hora.
3. Borra `clientes/{clienteId}/dispositivos/*`: no le llegan más avisos. Si vuelve a entrar con
   un link nuevo, los registra otra vez al activar notificaciones.

Cada paso con su propio `try` y su `logger.error`: que falle uno no impide los demás. Es
idempotente (repetirlo deja todo igual), así que los reintentos de Eventarc no hacen daño.

**Por qué en un trigger y no en la app:** `revokeRefreshTokens` solo existe en el Admin SDK, y
así revocar sigue siendo una sola acción de la app (borrar el acceso). Si algún día se borra
el acceso desde la consola de Firebase, también se aplica.

Se despliega por nombre: `firebase deploy --only functions:alRevocarAcceso` (por
`guardarEstilo`, ver punto 1 del backlog).

### 4. Funciones callable: misma fecha de corte

`clienteDeLaSesion` (en `comun.ts`) pasa a ser `async` y, además del claim, lee
`clientes/{clienteId}` y rechaza con `unauthenticated` / `acceso_revocado` si `auth_time` es
anterior a `accesoRevocadoEn`. Las seis funciones que la usan (`avisarFalta`, `cambiarDia`,
`jugarRuleta`, `obtenerRanking`, `registrarDispositivo`, `revivirRacha`) pasan a hacer
`await`. Varias ya leen ese documento justo después; se puede devolver la lectura para no
repetirla.

Tests en `functions/`: claim sin corte pasa; sesión anterior al corte se rechaza; sesión
posterior al corte (link nuevo) pasa.

### 5. La web: "Tu acceso ya no está activo"

Hoy, cuando las reglas niegan, `escuchar` (en `datos.ts`) llama a `renovarCredencial`, que
termina en `iniciarSesion`. Con el acceso revocado, eso acaba en `sin-acceso` (`sesion`
responde 404), pero el resultado se tira y la clienta ve "No pudimos traer tus datos", la
pantalla de problemas de conexión.

Cambios:

- `renovarCredencial` devuelve el resultado de `iniciarSesion`, no solo un booleano. Si es
  `sin-acceso`, avisa a `main.ts` (un `alPerderAcceso`, como `alFallarDatos`).
- `main.ts` responde con el candado, motivo nuevo **`revocado`**: "Tu acceso ya no está
  activo. Pídele a tu entrenador un link nuevo."
- Al perder el acceso: `auth.signOut()` y `memoria.olvidar()`, para que la siguiente apertura
  no intente entrar con lo de antes.
- En `resolverSesion`, cuando el link de la dirección sale rechazado (`link-rechazado`) y es
  el mismo token recordado, también se olvida. Hoy se queda guardado.

Lo de entrar sin canjear (punto 2 del contexto) **se queda**: con la fecha de corte en las
reglas, la página instalada entra rápido y, si fue revocada, la regla la frena en el primer
listener y sale el candado. No hace falta volver a preguntarle a `sesion` en cada apertura.

### 6. La app: confirmar antes de revocar

Al tocar "Revocar acceso", un diálogo:

> **¿Revocar el acceso de {nombre}?**
> Su link dejará de servir y se cerrará su página en todos sus teléfonos. Para que vuelva a
> entrar tendrás que mandarle un link nuevo.
>
> Último acceso: {TextoEntradas.resumen}
>
> [Cancelar] [Revocar]

"Revocar" en color de error. El último acceso ya se muestra en la tarjeta; el diálogo lo
repite para que se vea en el momento de decidir.

## Qué pasa después de revocar

| Situación de la clienta | Qué ve |
|---|---|
| Página abierta en ese momento | En segundos, el candado "Tu acceso ya no está activo" |
| Abre la página instalada | El candado, al cargar |
| Abre su link viejo desde WhatsApp | El candado (`sesion` responde 404, como hoy) |
| Le mandas un link nuevo | Entra normal desde el link nuevo |
| Tenía la página instalada y le mandas un link nuevo | El ícono viejo abre el link viejo: tiene que borrarlo y volver a agregarla desde el link nuevo (iOS guarda la dirección al instalar) |

## Orden de despliegue

1. Funciones: `alRevocarAcceso` y las callable con `clienteDeLaSesion` nueva.
2. Reglas de Firestore y Storage. Sin `accesoRevocadoEn` en ningún cliente, no cambian nada
   para nadie: se pueden desplegar sin riesgo.
3. Web: el candado de revocado.
4. App: el diálogo de confirmación.

Probar con una clienta de prueba: entrar, instalar, revocar con la página abierta, ver el
candado; mandar link nuevo, entrar; confirmar que un aviso ya no le llega al teléfono viejo.

## Por decidir (entrenador)

1. **¿Apagar también "Notificaciones" (`notificacionesWeb`) al revocar?** La propuesta es no
   tocarla: los teléfonos se borran igual, y si le mandas un link nuevo sigue habilitada sin
   que tengas que acordarte. Si prefieres que quede apagada, es una línea más en el trigger.
2. **¿Mostrar en la ficha "Acceso revocado el {fecha}"** cuando no tiene acceso y hay
   `accesoRevocadoEn`? Ayuda a no confundir "nunca le compartí" con "se lo quité".
3. **El texto del candado** de revocado: "Tu acceso ya no está activo. Pídele a tu entrenador
   un link nuevo." ¿Así, o prefieres otro?

## Fuera de alcance

- Borrar a la clienta o sus datos. Revocar solo quita el acceso a la página.
- Un acceso temporal (link que vence solo): sería otra fecha en `accesosWeb`, mismo mecanismo.
