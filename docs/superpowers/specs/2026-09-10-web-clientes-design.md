# Web para clientes

## Contexto y objetivo

Hoy OSfit tiene un solo usuario real: el entrenador. Los clientes se enteran de
lo suyo por WhatsApp — el día que les toca, cómo van de asistencias, el video
del resumen quincenal. Cada una de esas consultas pasa por el entrenador.

Este diseño agrega una **página web de solo consulta por cliente**, a la que se
entra por un link personal que el entrenador comparte por WhatsApp. Muestra el
día que le toca hoy, su calendario de asistencias, su racha, su promedio de
tiempo por sesión, sus medallas, sus logros personales y sus resúmenes en
video.

Además le da al cliente **dos acciones** que hasta ahora requerían mensajearle
al entrenador: cambiar el día de rutina que le toca, y proteger su racha cuando
no puede venir. Las dos se aplican solas, sin aprobación.

La app Android no cambia de rol: **el entrenador sigue siendo el único que
marca asistencias**.

## Alcance

**Lo que el cliente ve:** día de rutina de hoy (solo el nombre del día),
calendario mensual de asistencias y faltas, racha actual, promedio de minutos
por sesión, medallas, logros personales, y los últimos 6 videos de resumen.

**Lo que el cliente puede hacer:** cambiar el día que le toca (ilimitado), y
justificar una ausencia para proteger su racha (máximo 3 por mes).

**Lo que el cliente NO ve, por decisión explícita:** estado de pago,
récords personales, datos físicos (peso, altura, edad), y **la lista de
ejercicios de su rutina**.

### Por qué la página no muestra los ejercicios

Es deliberado, no un olvido. La página dice **qué día** le toca, nunca **qué
ejercicios** hacer. El entrenador quiere seguir siendo necesario para la
rutina: la app ya tiene un botón para enviarle la rutina al cliente que la
pida, y esa entrega debe seguir siendo un acto del entrenador y no un
autoservicio.

Quien lea este spec más adelante va a ver una tarjeta de "hoy te toca" sin
ejercicios y va a querer "arreglarla". No es un bug. Agregar la lista de
ejercicios rompe el motivo por el que la página existe.

## Arquitectura

Enfoque elegido: **lectura directa a Firestore + escrituras por función**.

- **Sitio estático** en Firebase Hosting (`osfit-cccfe.web.app`). El navegador
  lee Firestore con el SDK web, con permisos acotados por claim.
- **Tres Cloud Functions**: `sesion`, `cambiarDia`, `revivirRacha`.
- **Firebase Storage** para imágenes de insignias y videos.

Las lecturas van directo a Firestore para tener **tiempo real gratis**: el
mismo mecanismo que ya usa la app. Si el entrenador marca la asistencia
mientras el cliente tiene la página abierta, el calendario se pinta solo.

Las escrituras **nunca** van directo. El cupo de 3 revives por mes no se puede
hacer cumplir con reglas de Firestore — las reglas no saben contar documentos,
y un contador auxiliar podría escribirse y "olvidarse" de incrementar. Por eso
las dos acciones pasan por función, donde el cupo se cuenta con el Admin SDK
antes de escribir.

### Flujo del link mágico

1. El entrenador toca **"Compartir acceso web"** en la ficha del cliente. Se
   genera un token aleatorio de 32 caracteres, se escribe
   `accesosWeb/{token}`, se marca `cliente.tieneAccesoWeb = true` y se comparte
   `https://osfit-cccfe.web.app/c/<token>` por WhatsApp.
2. El cliente abre el link. El JS toma el token de la URL y llama a `sesion`.
3. `sesion` valida el token, y devuelve un **custom token** de Firebase con el
   claim `clienteId`.
4. El navegador hace `signInWithCustomToken`, y **reemplaza la URL por `/mi`**
   con `history.replaceState`.
5. La sesión persiste (`browserLocalPersistence`). Las próximas veces entra
   directo, sin el link.

El paso 4 importa: el token deja de estar a la vista apenas se canjea. No queda
en una captura de pantalla ni se comparte sin querer al pasar la dirección.

El token vive en una colección **aparte** y no en el documento del cliente, a
propósito: así el documento que el cliente puede leer no contiene ningún
secreto, y buscar por token es un acceso directo por id en vez de una query.

### Reglas de Firestore

Las reglas actuales (`allow read, write: if request.auth != null`) **no pueden
sobrevivir a este cambio**. Hoy son inofensivas porque solo existe un usuario;
en cuanto exista una sesión de cliente, esa sesión podría leer y escribir toda
la base — teléfonos, pagos e historial de todos los demás.

Forma nueva:

```javascript
function esEntrenador() {
  return request.auth != null && request.auth.uid == UID_ENTRENADOR;
}
function esCliente(cid) {
  return request.auth != null && request.auth.token.clienteId == cid;
}
```

- `clientes/{cid}`: `read` si `esEntrenador() || esCliente(cid)`; `write` solo
  entrenador.
- `clientes/{cid}/medallas`, `/logrosPersonales`, `/videos`: igual.
- `clientes/{cid}/pagos`: **solo entrenador**. El cliente no ve pagos.
- `asistencias/{id}`: `read` si `esEntrenador() || resource.data.clienteId ==
  request.auth.token.clienteId`; `write` solo entrenador.
- `cambiosDia/{id}`: `read` si es suyo; `write` solo entrenador (las funciones
  escriben con Admin SDK, que saltea las reglas).
- `accesosWeb/{token}`, `medallas`, `logrosPersonales`, `rutinas`,
  `configVideo`: solo entrenador.

El cliente **no necesita permiso sobre `rutinas`**: su rutina viene embebida en
`Cliente.rutinaAsignada`. Es una superficie menos que exponer.

`UID_ENTRENADOR` es el UID del usuario fijo de Firebase Authentication, y va
literal en las reglas:

```javascript
function esEntrenador() {
  return request.auth != null &&
         request.auth.uid == 'G8lW4rIgXhZrswQXJ84pT1StFx82';
}
```

No es un secreto: es un identificador, no una credencial. Las reglas comparan
contra `request.auth.uid`, que sale de un token firmado por Firebase después de
un login real — no se puede reclamar un UID, hay que probarlo. La credencial de
verdad es `osfit.auth.password`, que vive en `local.properties` y no se
versiona.

Si algún día hay un segundo entrenador, esto se reemplaza por un custom claim
(`entrenador: true`) para no tener que editar las reglas por cada persona. Con
un solo entrenador el literal es más simple y se ve de un vistazo.

### Reglas de Storage

```javascript
match /insignias/{allPaths=**} {
  allow read: if request.auth != null;   // catálogo, no es dato personal
}
match /resumenes/{clienteId}/{archivo} {
  allow read: if esEntrenador() || request.auth.token.clienteId == clienteId;
}
```

Escritura solo entrenador en ambos casos.

Esta es la razón de fondo para elegir Firebase Storage sobre Cloudflare R2: el
mismo claim que autoriza Firestore autoriza los videos, sin URLs firmadas ni
código extra.

## Modelo de datos

### Colecciones nuevas

```kotlin
/**
 * Acceso web de un cliente. El id del documento **es** el token del link, así que
 * canjearlo es una lectura directa por id. Vive fuera de `clientes/{id}` para que el
 * documento que el propio cliente puede leer no contenga ningún secreto.
 */
data class AccesoWeb(
    val clienteId: String = "",
    val creado: Timestamp = Timestamp.now()
)
```

Revocar es **borrar el documento**, no marcar un booleano: no deja un secreto
inerte dando vueltas, y la ausencia del documento es una condición más difícil
de programar mal que un flag que alguien puede olvidar consultar.

```kotlin
/**
 * Cambio de día pedido por el cliente desde la web. Existe porque si el cliente cambia su
 * día **antes** de venir todavía no hay ningún registro de asistencia donde anotarlo.
 * Alimenta el indicador del entrenador en el calendario.
 *
 * Doc id: "<clienteId>_<fecha>" — un solo cambio vigente por cliente y día; si el cliente
 * cambia dos veces, la segunda pisa a la primera y el indicador muestra la última.
 */
data class CambioDiaWeb(
    val clienteId: String = "",
    val fecha: String = "",        // ISO, la fecha a la que aplica
    val diaIndex: Int = 0,
    val motivo: String = "",
    val creado: Timestamp = Timestamp.now()
)
```

```kotlin
/** Video publicado en la web, en `clientes/{clienteId}/videos`. */
data class VideoPublicado(
    val id: String = "",
    val rangoInicio: String = "",      // ISO del inicio de la quincena; ordena el listado
    val encabezadoRango: String = "",  // "2da quincena de agosto"
    val rutaStorage: String = "",      // resumenes/<clienteId>/<rangoInicio>.mp4
    val duracionSegundos: Int = 0,
    val creado: Timestamp = Timestamp.now()
)
```

### Campos nuevos en modelos existentes

`Cliente`:

```kotlin
val tieneAccesoWeb: Boolean = false
```

Solo para que la app sepa qué botón mostrar. La verdad sobre el acceso está en
`accesosWeb`; este campo es una comodidad de UI, y si quedara desincronizado lo
peor que pasa es que la app ofrezca "compartir" en vez de "copiar link".

`Asistencia`:

```kotlin
/** La justificó el cliente desde la web (no el entrenador). Solo estas cuentan para el cupo. */
val justificadaPorCliente: Boolean = false
```

No hay campo de motivo. Faltar no se justifica ante la página: el cliente avisa
y se acabó (ver "Faltar no pide explicaciones").

La distinción es necesaria: el "soborno" que otorga el entrenador **no debe
gastar** el cupo del cliente.

`MedallaCatalogo` y `LogroPersonalCatalogo`:

```kotlin
/** URL pública de la insignia en Storage. null = la web dibuja la insignia genérica. */
val imagenUrl: String? = null
```

`imagenArchivo` **se conserva sin cambios**: el generador de video sigue leyendo
de `filesDir`. La subida a Storage es un agregado, no un reemplazo.

### El cupo se cuenta, no se guarda

El cupo de revives no vive en ningún contador. Se calcula consultando:

```
asistencias
  .where(clienteId == X)
  .where(justificadaPorCliente == true)
  .where(fecha >= "<AAAA-MM>-01").where(fecha <= "<AAAA-MM>-31")
```

Requiere un índice compuesto `(clienteId, justificadaPorCliente, fecha)`.

Se prefiere contar antes que mantener un contador porque si el entrenador
desmarca una justificada desde su app, el cupo se le devuelve al cliente solo.
Un contador se quedaría viejo y habría que acordarse de corregirlo en un lugar
que nadie mira.

Las fechas son strings ISO, así que el rango por prefijo de mes funciona con
comparación lexicográfica. `-31` como tope superior es correcto incluso en
febrero: no existe `2026-02-31`, y cualquier fecha real de febrero es menor.

## Zona horaria

**Todo cálculo de "hoy" usa `America/Mazatlan`, nunca la zona del navegador.**

Es la zona de Culiacán Rosales, Sinaloa: hora estándar del Pacífico de México,
GMT-7. No confundir con `America/Mexico_City`, que es GMT-6 — una hora de
diferencia alcanza para que un cliente que abre la página a las 11 de la noche
vea el día equivocado.

La app calcula el día con `LocalDate.now()` en el teléfono del entrenador. Un
navegador lo calcularía en la zona del dispositivo del cliente. Fijar la zona
no es defensa contra clientes de viaje — es simplemente más barato que la
alternativa: una constante en un solo lugar, compartida por el sitio y las
funciones, en vez de razonar sobre qué zona tiene cada teléfono.

El sitio nunca llama a `new Date()` para obtener la fecha de hoy sin pasar por
esa constante.

## El día que le toca: la duplicación riesgosa

`RutinaProgressCalculator` decide qué día del ciclo le toca a un cliente, y la
web necesita esa misma respuesta. Es lógica Kotlin pura y no hay forma de
compartirla con JavaScript.

**Decisión: se porta a TypeScript, y el port lleva los mismos casos de prueba
que el original.**

Es la duplicación más peligrosa de todo este diseño. Si las dos
implementaciones se separan, el cliente ve un día distinto del que ve el
entrenador — el peor error posible para esta feature, y además silencioso.
Mitigación:

- El port incluye **la rama legacy** (`FECHA_CORTE`, clientes sin
  `diaAnclaFecha`). Omitirla rompería a los clientes anteriores al 2026-09-01.
- Los 9 casos del test de Kotlin se replican uno a uno en el test de TS.
- El archivo lleva un comentario en ambos lados apuntando al otro, para que
  quien toque uno sepa que existe el gemelo.

## Los tres endpoints

Todos validan que `request.auth.token.clienteId` exista antes de hacer nada, y
calculan `hoy` en la zona fija.

### `sesion(token) → { customToken, clienteId, nombre }`

Lee `accesosWeb/{token}`. Si no existe, responde 404 genérico — sin distinguir
"nunca existió" de "revocado", para no confirmarle nada a quien pruebe tokens
al azar. Si existe, mintea un custom token con `{ clienteId }` como claim.

### `cambiarDia(diaIndex, motivo)`

Valida que `diaIndex` esté dentro del rango de días de la rutina asignada, y
que `motivo` sea uno de los válidos (o texto libre si eligió "Otro").

Aplica exactamente lo que hace `AsignarDiaManual.ejecutar`: escribe el ancla
fechada **el día anterior** a hoy, y corrige `diaRutinaRealizado` si ya hay una
asistencia registrada hoy. Después escribe `cambiosDia/{clienteId}_{fecha}`.

No hay límite de uso. Si el cliente cambia dos veces el mismo día, la segunda
pisa a la primera.

### `revivirRacha(fecha)`

No recibe motivo.

1. Verifica que `fecha` sea **hoy** o **la falta que rompió la racha** (ver
   abajo). Cualquier otra fecha se rechaza.
2. Cuenta el cupo del mes. Si ya hay 3, rechaza.
3. Escribe la asistencia: si el documento existe y es falta, la marca
   `justificada = true, justificadaPorCliente = true`. Si no existe (el caso de
   avisar por adelantado), lo crea con `asistio = false` y los mismos campos.

El caso de crear el documento por adelantado funciona sin coordinación con la
app porque `registrarAsistencia()` **ya conserva** `justificada` al remarcar una
falta, y la limpia sola si el cliente termina asistiendo. Ese comportamiento
existe hoy y no hay que tocarlo.

Se rechaza si la asistencia de esa fecha tiene `asistio = true`: no tiene
sentido justificar un día al que vino. Es la misma condición que ya aplica
`justificarFalta()`.

### Cuál es "la falta que rompió la racha"

La falta hábil más reciente, estrictamente anterior a hoy, con
`asistio = false` y `justificada = false`, que además sea **posterior** a la
última fecha que sí cuenta para la racha. Si no hay ninguna, la racha no está
rota y la web no ofrece el botón.

Esta función es lógica pura y va a `domain/` en Kotlin (la app la necesita para
mostrar el cupo) y a TS en la web.

## La página

Un solo scroll, sin navegación. En orden: saludo, tarjeta del día, racha y
promedio, calendario, medallas, logros personales, videos.

El orden es el de urgencia: lo que se consulta a diario primero, el historial
después. Un cliente abre esto desde un link de WhatsApp, parado en el gimnasio,
un par de veces por semana — no hay margen para que aprenda una navegación.

### Tarjeta del día

Nombre del día de la rutina y nada más (ver "Por qué la página no muestra los
ejercicios"), más dos botones: **"Quiero cambiar el día que me toca"** y
**"Hoy no voy a poder ir"**.

Si el cliente ya cambió su día hoy, debajo aparece una línea de confirmación
con la hora y el motivo elegido. Sin esa confirmación el cliente no sabe si el
toque funcionó y vuelve a tocar.

### Racha y promedio

Dos tarjetas lado a lado: racha actual en días, y promedio de minutos por
sesión. **No hay total de minutos del mes**: ese dato es del video, no de esta
página.

Cuando la racha está rota, la tarjeta de racha se pinta en rojo, dice qué día
la rompió, y debajo aparece **"Revivir mi racha"** con el cupo restante. Con la
racha viva ese botón no existe: la página no le recuerda al cliente que puede
faltar.

### Calendario

Un mes por vez, abriendo en el actual, con navegación hacia atrás. Colores:
verde asistió, rojo faltó, ámbar justificada, morado hoy. Leyenda siempre
visible — sin ella los colores son adivinanza.

### Medallas, logros y videos

Medallas con su imagen de Storage y su nombre. Logros personales con nombre y
encabezado del período. Videos: los últimos 6, más reciente primero, con el
encabezado del rango y la duración.

### Estados vacíos y de excepción

- **Sin rutina asignada:** "Todavía no tenés rutina · Tu entrenador te la
  asigna y aparece acá".
- **Sábado o domingo:** "Hoy toca descansar", más qué día le toca el lunes. Sin
  botones de acción. El fin de semana no cuenta para la racha
  (`RachaCalculator` solo cuenta días hábiles), así que no hay nada que
  proteger.
- **Sin asistencias, sin medallas, sin videos:** cada sección dice qué falta y
  quién lo resuelve. Ninguna sección queda en blanco.
- **Cliente inactivo** (`activo = false`): la página se lee, las dos acciones
  quedan deshabilitadas. Su historial es suyo; cambiar una rutina que no está
  haciendo, no.

### Motivos del cambio de día

1. "Hoy es lunes y quiero iniciar con algo que me guste" — **solo los lunes**
2. "Tengo más de dos días sin venir y quiero iniciar con lo que yo quiera" —
   **solo si lleva más de 2 días hábiles sin asistir**
3. "Quiero adelantar el día"
4. "La neta no te quiero decir, solo no quiero hacerlo"
5. "Soy una perra frágil"
6. "Otro (describe el motivo)" — habilita texto libre

Los dos primeros son condicionales porque son afirmaciones sobre hechos: "hoy
es lunes" ofrecido un miércoles es absurdo, y ofrecerlo igual enseña que las
opciones no significan nada. La web filtra con datos que ya tiene (la fecha y
el historial de asistencias).

El motivo se guarda en `CambioDiaWeb.motivo` y el entrenador lo ve en su
indicador del calendario.

### Faltar no pide explicaciones

**"Hoy no voy a poder ir" y "Revivir mi racha" no piden motivo.** No hay lista,
no hay texto libre, no se guarda nada.

Antes de gastar el revive se confirma, porque son 3 al mes y el cliente no debe
descubrir que gastó uno por un toque accidental:

> **¿Usar uno de tus 3 revives?**
> Te quedan 2 este mes.
> [ Cancelar ] [ Sí, usar uno ]

Y al confirmar, la página responde:

> **Esperamos que todo esté bien, te vemos mañana si Dios quiere!**

Es asimétrico respecto del cambio de día, y a propósito. Cambiar de día es una
decisión de entrenamiento sobre la que el entrenador quiere contexto — por eso
tiene motivos, y por eso algunos son chistosos. Faltar es otra cosa: pedirle a
alguien enfermo que elija de una lista por qué no puede ir convierte un aviso
en un trámite. El cliente avisa, la página le desea que esté bien, y listo.

Consecuencia práctica: el indicador del entrenador dice *que* el cliente avisó,
nunca *por qué*. Si quiere saberlo, le pregunta — que es exactamente lo que
haría de todos modos.

## Cambios en la app Android

1. **`ClienteDetailScreen`: acceso web.** Botón "Compartir acceso web" que
   genera el token y comparte por la ruta de `WhatsAppUtil` que ya existe. Con
   el acceso ya creado, el botón pasa a "Copiar link" y aparece "Revocar
   acceso", que borra `accesosWeb/{token}`.

2. **Subida de insignias a Storage.** Al crear o editar una medalla o un logro
   personal, además de escribir en `filesDir` se sube a
   `insignias/medallas/{id}.png` y se guarda `imagenUrl`. Para las insignias que
   ya existen, un botón de "subir insignias" que se toca una vez y sube las que
   les falte URL.

3. **"Publicar en la web"** junto a la acción de compartir un video ya
   generado. Sube el mp4 a `resumenes/{clienteId}/{rangoInicio}.mp4`, escribe
   el documento en `clientes/{id}/videos`, y borra de Storage y de Firestore
   todo lo que pase de los 6 más recientes.

4. **Indicadores en el calendario.** Junto a cada cliente del día, una marca si
   avisó que no viene, o si cambió su día — en ese caso con el motivo que
   eligió; el aviso de ausencia no lleva motivo. Lee
   `cambiosDia` del día y las asistencias con `justificadaPorCliente`. Ambas
   colecciones ya se observan en tiempo real; no hay plumbing nuevo.

5. **Cupo visible** en la ficha del cliente ("Revives: 2 de 3 disponibles este
   mes"), para poder contrastar cuando un cliente diga que se le acabaron.

## Testing

Siguiendo lo que el repo ya hace: JUnit4 en `domain/`, nombres en español y en
backticks, y verificación en dispositivo para todo lo demás.

**Kotlin, en `domain/`:**

- `CupoRevivesCalculator`: cuenta solo las `justificadaPorCliente` del mes en
  curso; ignora las del entrenador; ignora las de otros meses; devuelve 0
  disponibles con 3 usadas.
- `FaltaQueRompioLaRacha`: la encuentra; devuelve null con la racha viva;
  ignora fines de semana; ignora faltas ya justificadas.
- `MotivosCambioDia`: filtra el motivo del lunes cuando no es lunes; filtra el
  de "más de dos días" cuando asistió ayer.

**TypeScript, en la web:**

- El port de `RutinaProgressCalculator`, con **los mismos 9 casos** que
  `RutinaProgressCalculatorTest`. Es la única prueba de que el port no se
  separó del original.
- `CupoRevivesCalculator` y `FaltaQueRompioLaRacha` portados, con los mismos
  casos que sus gemelos de Kotlin.

**En dispositivo:** las pantallas Compose nuevas, la subida a Storage, la
página web completa, y el flujo del link de punta a punta (compartir, abrir,
canjear, recargar sin el link).

No se testean unitariamente los endpoints ni las reglas de Firestore: no hay
precedente en el repo y requerirían emuladores. Se verifican a mano contra el
proyecto real, incluyendo el caso negativo — abrir la consola del navegador
como cliente e intentar leer otro cliente.

## Orden de implementación sugerido

Esto es más grande que las features anteriores del repo: hay un sitio nuevo,
tres funciones, cinco cambios en la app y una reescritura de las reglas. Se
implementa en tres etapas, y **cada una deja algo funcionando y verificable en
dispositivo**.

**Etapa 1 — Acceso y lectura.** Reglas de Firestore nuevas, `accesosWeb`,
endpoint `sesion`, botón de compartir y revocar en la app, y la página en modo
solo lectura: día de hoy, racha, promedio, calendario. Sin acciones, sin
insignias, sin videos.

Al terminar esta etapa el cliente ya tiene algo útil, y lo más riesgoso del
diseño — las reglas y el port de `RutinaProgressCalculator` — ya está probado
contra datos reales.

**Etapa 2 — Las dos acciones.** `cambiarDia`, `revivirRacha`, los cálculos de
cupo y de falta que rompió la racha en ambos lenguajes, los motivos, y los
indicadores en el calendario de la app.

**Etapa 3 — Medallas, logros y videos.** Subida de insignias a Storage,
`imagenUrl` en los dos catálogos, botón de publicar video, retención de 6, y
las tres secciones que faltan en la página.

Se deja al final a propósito: es la etapa con más trabajo de infraestructura
(Storage, migración de insignias existentes) y la única cuyo valor es
enteramente estético. Si algo se corta por tiempo, se corta acá.

## Fuera de alcance (explícito)

- **Que el cliente marque su propia asistencia.** El entrenador sigue siendo la
  única fuente de verdad de las asistencias.
- **Aprobación del entrenador** para cambios de día o revives. Las dos acciones
  se aplican solas; el entrenador se entera, no autoriza.
- **Notificaciones push.** El entrenador se entera dentro de la app. Nada de
  FCM ni de Cloud Functions disparadas por evento.
- **Pagos, récords personales y datos físicos** en la web.
- **La lista de ejercicios** en la web (ver la sección dedicada).
- **Resúmenes semanal y mensual** en video: solo se publica el quincenal.
- **Recuperar el acceso sin el entrenador.** Si el cliente pierde el link,
  el entrenador se lo vuelve a mandar. No hay "olvidé mi acceso".
- **Multi-entrenador.** Las reglas asumen un UID de entrenador literal.
