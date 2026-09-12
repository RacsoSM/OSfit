# Backlog

Cosas detectadas que **no** son urgentes y que no bloquean el flujo principal. Cada entrada
dice qué pasa, por qué no corre prisa, y qué habría que hacer. Se revisa cuando haya hueco,
no en mitad de otra cosa.

Lo que sí corre prisa va arriba, en su propia sección, y se borra igual cuando se hace.

Convención: una entrada **nunca se borra**. Cuando se completa se marca en su encabezado
—`## N. Título — ✅ HECHO (fecha)`— y se le añade debajo qué se verificó y cuándo. El
backlog no es solo la lista de pendientes: es el registro de qué se revisó y cómo quedó, y
borrar una entrada tira la explicación de por qué existía. El arreglo se explica igual en el
commit.

---

# URGENTE

## U1. Terminar la verificación de la Etapa 2 el lunes

**Detectado:** 2026-09-12 (sábado), intentando verificar la Etapa 2 en dispositivo.

La Etapa 2 está implementada y commiteada entera (Tasks 1-12), con las suites en verde: 210
tests de Kotlin y 39 de TypeScript. Lo que falta es el Task 13, y el sábado no se puede
hacer. Queda esto pendiente, en este orden.

**1. Desplegar: ya está hecho.** El 2026-09-12 quedaron desplegados el índice compuesto, las
tres functions (`cambiarDia` y `revivirRacha` nuevas, `sesion` actualizada sin cambio de
comportamiento) y el hosting con la página nueva. Verificado desde fuera: las dos llamables
responden `{"error":{"message":"sesion_invalida","status":"UNAUTHENTICATED"}}` sin sesión, que
es el `clienteDeLaSesion` propio corriendo, y con un bearer basura responden `Unauthenticated`
desde el SDK. La URL de `sesion` no cambió, así que el enlace que tiene `web/src/firebase.ts`
sigue siendo el bueno.

Dos notas para cuando toque desplegar otra vez desde esta máquina:

- El descubrimiento de functions se queda corto con su timeout de 10 s y falla con
  `Cannot determine backend specification`. Va con `FUNCTIONS_DISCOVERY_TIMEOUT=120`.
- `firebase.json` no tiene hooks de `predeploy`, así que **hay que compilar a mano antes**
  (`npm run build` en `functions/` y en `web/`). Sin eso se sube un paquete cuyo `main`
  apunta a un `lib/` que no existe.

**Medir con `curl.exe`, no con `Invoke-WebRequest`.** PowerShell se traga el cuerpo de las
respuestas de error, y un 401 con cuerpo vacío parece un rechazo de Cloud Run por IAM cuando
en realidad es la función contestando con su propio JSON. Esa confusión ya costó un
diagnóstico equivocado y un despliegue de más el sábado.

**2. Por qué el lunes y no el sábado.** Las dos acciones no se dibujan en fin de semana, y
está bien que así sea (spec, "Estados vacíos y de excepción": *"Sábado o domingo… Sin botones
de acción"*). Con el teléfono en sábado no hay nada que tocar aunque esté todo desplegado.

**3. Lo que hay que verificar, y lo que no se puede saltar.**

- **`revivirRacha`.** Probar: avisar por adelantado sin registro previo, gastar los 3 del
  mes, y que al desmarcar el entrenador una justificada **el cupo se devuelva solo**.

  Ojo con qué fecha se espera. El 2026-09-12 Brianda tiene una falta el **viernes
  2026-09-04** y vino del 7 al 11, y la página **no le ofrece revivir nada**. Eso es
  correcto, está confirmado con el entrenador y no hay que "arreglarlo": la ventana son los
  2 días hábiles anteriores a hoy, y una rotura de hace más de una semana quedó fuera hace
  rato. Verificado en su página el 2026-09-12: no aparece la tarjeta de revivir.
- **Intentar justificar una fecha arbitraria** llamando al callable a mano desde la consola.
  Tiene que responder `failed-precondition`. Es lo que impide que revivir sea "justificar
  cualquier día de mi historial".
- ✅ **Los indicadores del aviso de falta: HECHO (2026-09-12).** El entrenador verificó a
  mano que al tocar "Hoy no voy a poder ir" la clienta se pinta de amarillo en Clientes, y
  que sale el aviso en Tomar Asistencia. Los dos caminos de `avisosFalta` funcionan.
- **Falta ver el indicador del cambio de día**, el único de los tres que sigue sin verse:
  "🔄 Cambió su día: <motivo>" en Tomar Asistencia, de `cambiosDia`. No lo cubren los tests
  (es Compose, y la suite solo prueba `domain/`) y solo se dibuja el mismo día en que la
  clienta cambia su día desde su página.
- **Se espera al lunes para el cambio de día.** Acordado con el entrenador el 2026-09-12.
  Hay que probar, con una clienta de verdad y en un día hábil:
  - Que al cambiar el día aparece "🔄 Cambió su día: <motivo>" en Tomar Asistencia, con el
    motivo que eligió.
  - Que **al día siguiente el ciclo avanza** en vez de quedarse trabado en el día asignado.
    Es lo que queda de la regresión de `d424286`: el ancla se fecha ayer a propósito, y
    equivocarse no se nota hoy, solo mañana.
  - Que con la asistencia de hoy ya marcada el botón sale **deshabilitado** con la nota "Ya
    registraste tu asistencia de hoy", y que llamando al callable a mano responde
    `ya_asistio_hoy`.

  **Con la fecha del teléfono movida no se puede probar**: la app consulta por la fecha del
  dispositivo y las functions escriben con la de Mazatlán, así que si no coinciden el
  indicador busca un día en el que no hay nada escrito. Devolver el teléfono a su fecha
  antes de intentarlo.
- **Lo demás que cambió el 2026-09-12 y no estaba en esta lista:** que "Hoy no voy a poder
  ir" no gasta revive y que el botón no vuelve en todo el día ni recargando; que "Soy una
  perra frágil" solo aparece para las seis de la lista; y que los seis motivos se ofrecen
  siempre.

**4. Lo que ya quedó verificado el sábado:** el cupo en la ficha del cliente ("Revives: 3 de 3
disponibles este mes", correcto para Brianda); que las pantallas de Clientes, Calendario y
Tomar Asistencia siguen sin romperse con los campos nuevos; que las dos llamables rechazan a
quien no trae sesión; y que la página desplegada se sigue viendo igual que antes para un
cliente real —día, racha, promedio y calendario intactos, sin botones de acción porque es
sábado—, que era el riesgo de poner el bundle nuevo delante de todos.

**El test negativo también, y ya no hace falta repetirlo.** El 2026-09-12 se corrió contra la
cuenta real de Brianda con Playwright sobre la API REST de Firestore, usando el token de su
propia sesión. Cinco pruebas, cinco como se esperaban: leer su documento de `clientes` da 200,
y escribir en `clientes`, `asistencias`, `cambiosDia` y `avisosFalta` da 403. Se le mandaron
sus mismos valores a propósito, para que si una regla hubiera fallado el write no le cambiara
nada. De paso quedó visto que el link canjea y reemplaza la URL por `/mi`.

El script está en el scratchpad de esa sesión, no en el repo. Si hay que repetirlo: abrir el
link con Playwright, sacar el token de `localStorage` (`firebase:authUser:<apiKey>:[DEFAULT]`)
y pegarle a `firestore.googleapis.com` con ese bearer. Navegar con `domcontentloaded`, no con
`networkidle`: los listeners de Firestore dejan la conexión abierta y el `goto` nunca vuelve.

**5. Aviso sobre los datos.** La verificación se acordó hacer contra la cuenta real de
Brianda. Un revive gasta uno de sus 3 del mes y un cambio de día le mueve la rutina de
verdad; las dos cosas se deshacen desde la app, pero conviene dejarla como estaba al
terminar.

---

## 1. Revocar el acceso web no corta la sesión ya abierta

**Detectado:** 2026-09-11, verificando el Task 13 del plan de la web de clientes.

Al pulsar "Revocar acceso" el token deja de canjearse (la función `sesion` devuelve 404) y
el link viejo muestra "Este enlace ya no es válido". Eso funciona. Pero un cliente que **ya**
había abierto su página la conserva: comprobado navegando a `/mi` después de revocar, la
página cargó entera con nombre, día, racha y calendario.

Es el comportamiento normal de Firebase: borrar el documento de `accesosWeb` solo impide
canjes nuevos. La sesión del navegador vive de un refresh token que no caduca solo, así que
sigue renovando su ID token indefinidamente.

**Por qué no es urgente:** revocar sirve hoy para el caso real (dejar de compartir un link
que ya circuló, o cortarle el acceso a alguien que se dio de baja y no tiene la página
abierta). El agujero solo aplica a un cliente que mantenga la pestaña o el navegador con la
sesión viva, y lo que vería es su propia información, no la de nadie más — el aislamiento
entre clientes sí aguanta (verificado: 7 lecturas ajenas denegadas).

**Qué haría falta:**
- Llamar a `getAuth().revokeRefreshTokens(clienteId)` desde una función al revocar.
- Añadir a `firestore.rules` una comprobación de `request.auth.token.auth_time` contra el
  momento de la revocación, que es lo que hace que el ID token vivo deje de valer.
- Decidir qué ve el cliente cuando la sesión muere con la página abierta.

Encaja mejor en la Etapa 2 que como parche suelto: toca reglas, función y UI a la vez.

---

## 2. Verificar el estado vacío "cliente sin rutina"

**Detectado:** 2026-09-11, Step 5 del Task 13. Quedó sin ejecutar.

La página debe mostrar "Todavía no tienes rutina" cuando el cliente no tiene rutina
asignada. El camino está implementado en `web/src/ui/tarjetaDia.ts` (rama `dias.length === 0`)
pero **no se ha visto funcionando contra datos reales**.

**Por qué no es urgente:** es una rama de presentación, no de datos ni de permisos. Si
fallara, el peor caso es una tarjeta fea o ausente, no una fuga ni un dato incorrecto.

**Qué haría falta:** un cliente de prueba sin rutina asignada, compartirle acceso y abrir su
página. Alternativa sin tocar datos: un test de `tarjetaDia()` con `rutinaAsignada: null`,
que además dejaría la rama cubierta para siempre en vez de una sola vez a mano.

---

## 3. Verificar el estado "hoy toca descansar" (fin de semana) — ✅ HECHO (2026-09-12)

**Detectado:** 2026-09-11, Step 5 del Task 13. Quedó sin ejecutar.

Sábado y domingo la página debe mostrar "Hoy toca descansar" y adelantar cuál toca el lunes,
en vez de un día de rutina que nadie va a hacer. Implementado en `esFinDeSemana()` de
`web/src/ui/tarjetaDia.ts`, sin verificar contra un sábado real.

**Por qué no es urgente:** mismo motivo que el anterior, y además se verifica solo cada
sábado en cuanto haya un cliente con la página abierta.

**Qué haría falta:** esperar al sábado, o cambiar la fecha del teléfono (invasivo). Lo
sensato es un test de `tarjetaDia()` con una fecha de sábado, que no depende del calendario
ni de tocar el dispositivo. Ojo con la zona horaria: `esFinDeSemana` construye la fecha con
`T12:00:00` y lee `getUTCDay()`, y eso conviene fijarlo en el test.

**Hecho:** verificado el sábado 2026-09-12 contra un sábado real, en la página de Brianda.
Muestra "Hoy toca descansar" y "El lunes te toca Pierna (Cuádriceps)", sin botones de acción.
No hizo falta tocar la fecha del teléfono ni escribir el test: cayó en sábado de verdad.

---

## 4. `.firebase/` sin ignorar

**Detectado:** 2026-09-11, tras el primer `firebase deploy`.

El despliegue genera un directorio `.firebase/` con la caché de hosting. Aparece como
archivo sin seguimiento en `git status` y no debería versionarse.

**Qué haría falta:** añadir `.firebase/` a `.gitignore`. Es una línea; está aquí para que no
se cuele en un commit por descuido.

---

## 5. Rutina y semana incompleta

**Detectado:** 2026-09-14.

> if a woman dont go the 5 days of a week in a row, the routine should change looking that
> they dont do legs two times in a row

---

## 6. Saludo de la página — ✅ HECHO (2026-09-14)

**Detectado:** 2026-09-14.

> change the animation for the Hola, $nombrePersona, and the color of $nombrePersona, maybe
> the color of the font of the client

Hecho el mismo día: fuera el emoji de la mano, efecto de máquina de escribir de segundo y
medio, y el nombre con el degradado morado de la tarjeta del día. Lo del color propio de cada
cliente (el del círculo de la lista) se quedó sin hacer — el degradado es el de la tarjeta,
igual para todos.

---

## 7. Paleta de la web desde la app

**Detectado:** 2026-09-14.

> feature: a button on the OSfit app that can change the whole color palette of the web osfit,
> like the palettes of the quincenales videos

---

## 8. Regenerar el grafo de graphify

**Detectado:** 2026-09-12.

> regenerate the graphify, only can do it in the cesavesin laptop

El `graphify-out/` del repo es del 2026-08-20: 242 nodos, 443 aristas, 48 archivos. Desde
entonces van 122 commits sobre `app/`, `web/` y `functions/` (139 archivos, +19.274 líneas),
así que el grafo no refleja el proyecto actual — `web/` casi no aparece.

No se actualiza solo: graphify es un CLI que hay que correr a mano, no hay hook ni nada que
lo dispare. Y `graphify-out/.graphify_root` apunta a `C:\Users\SISTEMAS-03\Desktop\OSfit` con
su propio Python de `uv`, que es la otra laptop; en esta máquina no está instalado.

**Qué haría falta:** correrlo en esa laptop y commitear el `graphify-out/` nuevo. El
`manifest.json` guarda `mtime` y `ast_hash` por archivo y hay caché de AST, así que la
regeneración es incremental y solo reprocesa lo que cambió.

---

## 9. Notificación al entrenador cuando alguien avisa que no viene

**Detectado:** 2026-09-12.

> that should mark something in the OSfit app and if its possibly, turn on a notification,
> but the notification can go to the backlog.md

Lo de marcarlo en la app ya está hecho: "Hoy no voy a poder ir" escribe en `avisosFalta` y
Tomar Asistencia pinta "🔔 Avisó que no viene" en la fila de la clienta. Lo que falta es que
el entrenador **se entere sin abrir la app**.

**Qué haría falta:** una función `onDocumentCreated` sobre `avisosFalta/{doc}` que mande un
push por FCM al teléfono del entrenador. Hoy la app no tiene nada de FCM, así que hay que
montarlo entero: dependencia, `FirebaseMessagingService`, permiso `POST_NOTIFICATIONS`
(Android 13+ lo pide en tiempo de ejecución), canal de notificación, y guardar el token del
dispositivo en algún lado que la función pueda leer.

**Por qué no es urgente:** el aviso no se pierde — queda en Firestore y se ve en Tomar
Asistencia, que es la pantalla que el entrenador abre igual todos los días. La notificación
adelanta el momento en que se entera, no cambia lo que sabe.
