# Backlog

Cosas detectadas que **no** son urgentes y que no bloquean el flujo principal. Cada entrada
dice qué pasa, por qué no corre prisa, y qué habría que hacer. Se revisa cuando haya hueco,
no en mitad de otra cosa.

Lo que sí corre prisa va arriba, en su propia sección, y se borra igual cuando se hace.

Convención: una entrada se borra de aquí cuando se arregla, y el arreglo se explica en el
commit — no se marca "hecho" y se deja.

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

- **El test negativo, primero.** Con la página abierta como cliente, desde la consola del
  navegador: `updateDoc` sobre su propio documento de `clientes`, y lo mismo sobre
  `asistencias` y `cambiosDia`. Los tres tienen que dar error de permisos. Todo el diseño se
  apoya en que el cliente siga siendo de solo lectura en Firestore y que las dos acciones
  pasen por functions. Si esto falla, no se sigue.
- **`cambiarDia` con asistencia ya marcada hoy, y mirarlo AL DÍA SIGUIENTE.** Es la rama
  `vinoHoy` del trío denormalizado y equivocarla no se nota hoy, solo mañana: el ciclo tiene
  que **avanzar**. Contrastar con un cliente que cambió el día **sin** haber venido, que sí
  debe seguir mañana en el mismo día. Es letra por letra la regresión de `d424286`.
- **`revivirRacha`.** Con los datos de Brianda del 2026-09-12, su falta reparable es el
  **viernes 2026-09-04** (vino del 7 al 11, faltó el 4), así que el botón debe ofrecer
  exactamente esa fecha y ninguna otra. Probar también: avisar por adelantado sin registro
  previo, gastar los 3 del mes, y que al desmarcar el entrenador una justificada **el cupo se
  devuelva solo**.
- **Intentar justificar una fecha arbitraria** llamando al callable a mano desde la consola.
  Tiene que responder `failed-precondition`. Es lo que impide que revivir sea "justificar
  cualquier día de mi historial".
- **Los indicadores del entrenador** en Tomar Asistencia, una vez que haya datos de verdad
  que mostrar.

**4. Lo que ya quedó verificado el sábado:** el cupo en la ficha del cliente ("Revives: 3 de 3
disponibles este mes", correcto para Brianda); que las pantallas de Clientes, Calendario y
Tomar Asistencia siguen sin romperse con los campos nuevos; que las dos llamables rechazan a
quien no trae sesión; y que la página desplegada se sigue viendo igual que antes para un
cliente real —día, racha, promedio y calendario intactos, sin botones de acción porque es
sábado—, que era el riesgo de poner el bundle nuevo delante de todos.

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

## 3. Verificar el estado "hoy toca descansar" (fin de semana)

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
