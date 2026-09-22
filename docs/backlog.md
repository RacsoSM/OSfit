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

## U1. Terminar la verificación de la Etapa 2 — ⏳ REVIVIR HECHO (2026-09-15), FALTA EL CAMBIO DE DÍA

### Lo verificado el 2026-09-15, y contra qué

Se hizo **con una clienta de pruebas creada para esto**, no contra la cuenta real de Brianda
como decía el punto 5 de abajo. Eso vuelve inaplicable el aviso de "dejarla como estaba al
terminar": los datos inventados se pueden quedar donde están. Es mejor que lo acordado y
conviene repetirlo así la próxima vez.

**`revivirRacha`: terminado.** Conducido con Playwright sobre la página desplegada.

- La tarjeta ofreció **la fecha correcta**, el día hábil anterior —"Repara tu falta del lunes,
  14 de septiembre"—, y pidió confirmación antes de gastar ("¿Usar uno de tus 3 revives?").
- Al confirmar, **la racha pasó de 🔥 0 a 🔥 1** y el calendario pintó el 14 de amarillo
  (Justificada), con el 10 en verde (Viniste).
- **El cupo baja y se ve en la propia página**, no sólo en la ficha: 3 → 2 → 1, recorrido
  gastando también el viernes 11, el otro día hábil de la ventana.
- **El cupo se devuelve solo.** Al desmarcar el entrenador la justificada del 14, la página
  volvió a ofrecer ese día y a decir "Te quedan 2 este mes", sin tocar nada más. Es lo que
  `cupo.ts` promete al contar en vez de guardar un contador.
- **La fecha arbitraria se rechaza.** Llamando al callable a mano con el bearer de la sesión de
  la clienta y `fecha: "2026-09-01"`, responde **400 `fecha_no_justificable` /
  `FAILED_PRECONDITION`**. Es lo que impide que revivir sea "justificar cualquier día".
- **No se pueden gastar los tres en un día, y no es un fallo.** La ventana son 2 días hábiles,
  así que como mucho hay dos roturas reparables a la vez. Para ver el estado "sin cupo" hace
  falta una tercera rotura en otra fecha del mes.

**"Hoy no voy a poder ir": terminado.** Sirve sin registro previo, y el acuse persiste al
recargar (verificado, no supuesto).

**Los motivos:** salen los 5 de la lista general y **no** "Soy una perra frágil", correcto
porque la clienta de pruebas no es una de las seis.

### Lo que falta, todo del bloque "cambio de día"

La mitad web ya está hecha: el 2026-09-15 se cambió el día desde la página a "Día 3 · Pierna
completa" con el motivo "Quiero adelantar el día", y la tarjeta quedó mostrando *"Cambiaste tu
día a las 12:47 · Quiero adelantar el día"*. Lo que queda es todo lo que sólo se ve en la app o
al día siguiente:

- [ ] **El indicador "🔄 Cambió su día: Quiero adelantar el día" en Tomar Asistencia.** El
      cambio ya está escrito en `cambiosDia` con fecha 2026-09-15, así que se puede comprobar
      abriendo Tomar Asistencia de ese día. **Ojo: sólo se dibuja el mismo día del cambio**, así
      que si se deja pasar la fecha hay que volver a cambiar el día para verlo.
- [ ] **Que el ciclo avance al día siguiente** en vez de quedarse trabado en el Día 3. Es lo
      que queda de la regresión de `d424286`: el ancla se fecha ayer a propósito y equivocarse
      no se nota hoy, sólo mañana.

      **La mitad de esto ya está verificada.** El ancla que escribió `cambiarDia` el
      2026-09-15 quedó en `diaAnclaFecha: 2026-09-14` con `diaActualIndex: 2`, leído del
      documento real. O sea que la parte que podía estar mal —fechar el ancla hoy y dejar la
      asistencia de hoy fuera de su propia ventana, para siempre— está bien.

      **Trampa al comprobarlo, y es fácil caer:** hace falta una **asistencia de hoy**
      marcada. Sin ella, mañana seguirá diciendo Día 3 y eso es *correcto* —el día avanza al
      completar una sesión, no al pasar el calendario—, pero se lee igual que el bug. El
      2026-09-15 la clienta de pruebas quedó **sin** asistencia de ese día, así que quien
      retome esto tiene que marcarla antes de que la fecha sirva de algo. Con ella puesta, al
      día siguiente debe mostrar **Día 1** (el ciclo da la vuelta 3 → 1).

      **Resuelto sin esperar a mañana (2026-09-15).** Marcada la asistencia, el trío
      denormalizado pasó a `{ultimoDia: 2, ultimoDiaFecha: 2026-09-15, ultimoDiaEsAncla:
      false}`, leído del documento real. **Ese `esAncla: false` es la prueba**: sólo se
      escribe si la asistencia de hoy entró en la ventana exclusiva del ancla (`15 > 14`),
      que es justo lo que la regresión rompía. Con la regresión el trío se habría quedado en
      `esAncla: true` y la clienta en el Día 3 para siempre.

      La consecuencia quedó fijada en `web/src/dia.test.ts` con esos mismos valores: un test
      comprueba que al día siguiente devuelve Día 1, y otro que el estado que habría dejado
      la regresión devuelve Día 3 indefinidamente. Ya no depende de que alguien se acuerde de
      mirarlo un día después.
- [ ] **El botón deshabilitado con la asistencia de hoy ya marcada** ("Ya registraste tu
      asistencia de hoy") y que el callable responda `ya_asistio_hoy`. Requiere que el
      entrenador le marque asistencia hoy a la clienta de pruebas; entonces se puede repetir la
      llamada a mano igual que se hizo con `revivirRacha`.

### Estado en que quedó la clienta de pruebas

Asistencia el 10, justificadas por ella el 11 y el 14 (2 de 3 revives gastados en septiembre),
aviso de falta del 15, y cambio de día al Día 3 el 15. Nada de esto es real: es el andamio de
la verificación y se puede borrar cuando estorbe.

---

## U1 (texto original). Terminar la verificación de la Etapa 2 el lunes

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

## U2. Terminar el recorrido manual de la ruleta — ⏳ RECORRIDO A MEDIAS (2026-09-22), FALTA EL TELÉFONO Y LA TIRADA REAL

**Detectado:** 2026-09-21, al intentar hacer el recorrido manual que pide la entrada 25.

Corre prisa por dos cosas que caducan: **el canal de preview expira el 2026-09-28**, y el
estado de la clienta de pruebas depende de una falta que hay que marcar **hoy** para poder
probar mañana. Si se deja pasar, hay que volver a montar el andamio desde cero.

### Lo que YA está en producción, y conviene saberlo antes de tocar nada

Se desplegó en el orden que manda la entrada 25 §2, y **dos de las tres patas ya son
producción de verdad**:

- **Reglas de Firestore: desplegadas.** El bloque `match /ruletas/{doc}` nuevo, nada más; no
  se tocó ninguna regla existente.
- **Functions: desplegadas.** `jugarRuleta` creada, y `sesion`, `cambiarDia`, `revivirRacha` y
  `avisarFalta` actualizadas. `revivirRacha` cambió de verdad —ahora resta el castigo—, pero
  sin documento de ruleta del mes anterior el castigo es 0 y se comporta igual que antes. Como
  nadie ha jugado nunca, hoy es un no-op para todas las clientas.
- **Web: NO desplegada a producción.** El bundle salió a un canal de preview,
  `https://osfit-cccfe--ruleta-2ey141ze.web.app`, que **expira el 2026-09-28**. Producción
  sigue sirviendo `index--AJAJZu0.js`, verificado después de desplegar: 0 apariciones de
  "ruleta" en el bundle vivo. Las clientas reales no ven nada nuevo.

O sea que revertir no es simétrico: la web se cae sola cuando expire el canal, pero las reglas
y las functions se quedan hasta que alguien las quite a mano.

### Lo que quedó verificado el 2026-09-21

- **La tarjeta con cupo disponible se ve idéntica a producción.** Diff del texto completo de la
  página entre las dos URLs, con la misma clienta: sin una sola diferencia. Era uno de los tres
  puntos que la entrada 25 marca como bloqueantes, y es el que protege a las clientas que nunca
  van a llegar a la ruleta.
- **Cero errores de consola** en el preview con las reglas nuevas ya arriba — o sea que los dos
  `observarTirada` no están chocando con `permission-denied`, que era el riesgo del orden de
  despliegue.
- La sesión se canjea bien desde el origen del preview, que no era obvio: es otro dominio.
- **El camino de revivir, punta a punta:** pide confirmación ("Cancelar" / "Sí, usar uno"),
  la racha subió 🔥 0 → 🔥 1 → 🔥 2, y el cupo bajó con la gramática correcta ("Te quedan 2"
  → "Te queda 1").

**Nada de la ruleta en sí está verificado todavía**, porque no se ha logrado llegar a la
pantalla. Los 12 puntos de la entrada 25 §1 siguen todos sin hacer.

### Por qué no se pudo llegar a la ruleta hoy, que es el hallazgo

La ruleta pide **dos** condiciones a la vez: cupo en 0 **y** una falta reparable. Y llegar a
las dos el mismo día choca con el diseño de la ventana:

- La ventana de reparación son los **2 días hábiles anteriores** (`faltaRompio.ts`), y el
  recorrido empieza en *ayer*, nunca en hoy — hoy se justifica por el otro camino, el de "hoy
  no voy a poder ir".
- Para dejar el cupo en 0 hubo que justificar esos mismos dos días (el jueves 17 y el viernes
  18), que eran los únicos reparables.
- Desmarcar uno para abrir el hueco **devuelve el revive**, porque el cupo se cuenta y no se
  guarda. Es justo lo que U1 verificó como correcto, pero acá se muerde la cola.

O sea que hace falta una **cuarta** falta justificada por la clienta dentro del mes, en una
fecha fuera de la ventana. **La app del entrenador no puede crearla:** cuando el entrenador
justifica, `justificadaPorCliente` queda en `false` y no cuenta contra el cupo. Sólo cuenta lo
que la clienta justifica desde su página, y desde su página sólo alcanza la ventana.

Esto no es un fallo: es la consecuencia de dos reglas que por separado están bien. Pero
significa que **el estado "sin cupo" sólo se alcanza dejando pasar los días**, y conviene que
quien monte la próxima verificación lo sepa antes de perder una tarde.

### Qué hay que hacer, en orden

1. **Hoy (lunes 2026-09-21): no hacer nada, y sobre todo NO marcarle asistencia al 21.**

   Al escribir esta entrada se dijo que había que marcarle una falta hoy. **Es falso**, y se
   comprobó corriendo `faltaQueRompioLaRacha` contra su historial real: con registro de falta
   del 21 y sin él, mañana devuelve igual `2026-09-21`. `fechasQueCuentan` sólo mete los días
   con `asistio` o `justificada`, así que **un día sin registro ya es una falta** para la
   ventana; el registro en rojo es para que el entrenador lo vea en el calendario, no para el
   cálculo.

   Lo que tiene que pasar es **la medianoche**, no el registro: el recorrido arranca en
   `restarUnDia(hoy)` y por eso hoy nunca se devuelve. Queda escrito porque es el mismo error
   dos veces — igual que la trampa de U1 con la asistencia de hoy, es fácil creer que falta un
   dato cuando lo que falta es que pase el día.
2. **Mañana (martes 22):** el lunes 21 entra en la ventana sin justificar, el cupo sigue en 0,
   y la ruleta debe aparecer sola al abrir
   `https://osfit-cccfe--ruleta-2ey141ze.web.app/c/<token de la clienta test>`.
3. Con eso ya se puede hacer el recorrido de la entrada 25 §1 entero, incluida la app del
   entrenador en el teléfono, que ya está conectado.
4. **Antes del 2026-09-28**, o el canal expira y hay que volver a desplegarlo.

### Lo verificado el 2026-09-22, con la ruleta por fin en pantalla

**El montaje aguantó la noche y la predicción del paso 2 se cumplió tal cual.** Al abrir el
preview con la clienta de pruebas, la tarjeta ofrecía sola *"💔 Te quedaste sin vidas para
revivir tu racha… pero te tengo una propuesta"*, con la racha en 🔥 0 y el cupo agotado. Lo que
faltaba era la medianoche, no un registro — que era justo lo que decía el paso 1.

Conducido con Playwright 1.63 contra el canal de preview, en un Chromium visible. **Sin gastar
la tirada real**, que sigue entera: todo lo de abajo sale de tiradas de prueba.

- **"Jugar" y "Tirada de prueba" quedan muertos mientras gira el ensayo**, y en toda la tirada
  de prueba salen **cero llamadas de red** — ni a `jugarRuleta` ni a ninguna función. Era el
  punto que pedía mirar la pestaña de Red, y pasa.
- **Nada cierra el modal**: ni `Escape` ni el clic en el fondo, ni girando ni ya parada. La ✕
  es la única salida, que es lo que se buscaba. Falta el botón atrás de Android.
- **El puntero cayó dentro del sector que anunciaba el acuse**, aunque cerca de la costura: o
  sea que el margen de 10° de la entrada 25 §4 se está ganando el sueldo.
- **`reduced-motion` cumple:** sin giro, y el acuse a los **330 ms** contra los **4136 ms** del
  modo normal, medido esperando al texto y no a ojo. 12× más rápido es el "fundido corto".
- **La ✕ es alcanzable en pantalla pequeña** (320×568 con la raíz a 24 px): dentro del
  viewport y sin scroll horizontal. **Pero mide 27×26 px.** Ver la entrada 27.
- **Un fallo encontrado y arreglado el mismo día:** el acuse nombraba el color primario a
  mano. Ver la entrada 26.

### Lo que sigue faltando

- **La tirada real**, que es **una por clienta y por mes** — en cuanto se juegue, el resto del
  mes contesta "Ya jugaste tu tirada de este mes". Cuatro de los puntos de la entrada 25 §1
  dependen de verla girar de verdad, así que conviene gastarla en el de los **dos toques
  simultáneos** y grabar vídeo: esa misma tirada sirve para revisar los otros tres.
- Todo lo que necesita el teléfono: botón atrás, el snapshot ajeno a media tirada, el cruce de
  medianoche y el "Revives: 2 de 2" del mes castigado.
- Ganar y perder forzando la probabilidad a 1 y a 0, que el propio §1 manda hacer **en el
  emulador**, no contra el preview.

### Estado en que quedó la clienta de pruebas

Septiembre 2026: asistió el 10 y el 15; justificadas por ella el 11, el 17 y el 18 (las dos
últimas gastadas hoy desde la página, en esta verificación); falta sin justificar el 14. Cupo
en **0 de 3**. Racha 🔥 2. Nada de esto es real: es andamio y se puede borrar cuando estorbe.

**Ojo al borrarlo:** si se le quitan justificadas de septiembre, el cupo vuelve a subir y hay
que rehacer el paso 1.

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

## 7. Paleta de la web desde la app — ✅ HECHO (2026-09-14)

**Detectado:** 2026-09-14.

> feature: a button on the OSfit app that can change the whole color palette of the web osfit,
> like the palettes of the quincenales videos

**Avance (2026-09-14):** implementado entero, sin verificar en dispositivo ni desplegar, así
que la entrada sigue abierta. Plan: `docs/superpowers/plans/2026-09-13-paleta-web-cliente.md`.

Está el catálogo compartido en `paletas/Paleta.kt` con las 15 paletas y sus cuatro colores de
web; las muestras compartidas entre Configuración de video y la pantalla nueva; la pantalla
"Paleta de colores" en la card de Web de cada clienta, que guarda al tocar; y la web pintando
los hex que recibe como variables CSS, fondo SVG incluido. Los dos por defecto siguen siendo
distintos —aqua para el video, morado para la web—, así que nada cambia de aspecto solo.

**Lo que falta, y es lo único:** compilar la app. Se escribió en una máquina sin Android SDK
(ni `local.properties`, ni `google-services.json`, y sin alcance al repo de Google para el
Android Gradle Plugin), así que de la app no se compiló ni corrió una sola prueba — tampoco
las de las Tasks 1 a 4, que ya venían en `dea6967` sin marcar. De la web sí: 89 pruebas en
verde y build limpio. Después de compilar quedan la verificación en dispositivo (los siete
puntos del Task 7 Step 2 del plan) y el despliegue.

**Avance (2026-09-14), en la laptop CESAVESIN:** se cerró el Step 1 entero, que era lo que
faltaba, y el Step 3 a medias.

- **`./gradlew :app:compileDebugKotlin test`: BUILD SUCCESSFUL en 2m 33s, 232 pruebas de
  Kotlin en verde** (22 clases, 0 fallos). Es la primera vez que la app se compila y se prueba
  desde que entraron las Tasks 1 a 5; sólo salieron avisos de deprecación que ya existían.
- **La web, reproducida aquí:** 89 pruebas en verde (11 suites) y `tsc && vite build` limpio.
- **Hosting desplegado** y comprobado desde fuera, no sólo por el "Deploy complete": el bundle
  en vivo es `index-Dw4Dlv2j.js`, el mismo que salió del build, y contiene `paletaWeb` y
  `--primario`; el `index.html` servido trae las tres `var(--primario)` del SVG del fondo.
- **`:app:assembleRelease`: BUILD SUCCESSFUL**, `app-release-unsigned.apk` de 14,8 MB.

**Cerrado el 2026-09-14.** El bloqueo de arriba —no poder instalar una APK nueva— era de la
laptop CESAVESIN, no de todas: desde SISTEMAS-03 el `debug.keystore` sí coincide con el de los
teléfonos, y la release que se instaló ahí para la entrada 9 llevaba dentro esta paleta, porque
el código entró en `dea6967` y estaba en `main`. O sea que se desbloqueó de rebote, sin trabajo
extra. **El entrenador verificó los siete puntos del Step 2 en dispositivo** y confirmó que
está bien; no quedó anotado punto por punto, así que si algún día falla alguno, el registro no
dice cuál se miró con más calma.

Lo que sí quedó medido ese día, y cierra el Step 1 que estaba a medias: `./gradlew test`
BUILD SUCCESSFUL con **247 pruebas en 24 clases y 0 fallos** —la primera vez que la app se
compila y se prueba entera desde que entraron las Tasks 1 a 5— y la web con **91 pruebas en 11
suites**. El hosting ya estaba desplegado y comprobado desde fuera.

El plan `2026-09-13-paleta-web-cliente.md` queda con todos sus pasos marcados.

Un detalle que sí se verificó y valía la pena: los atributos de presentación del SVG del fondo
aceptan `var(--primario)`. Comprobado en Chromium sobre el `dist/` construido, los `stop` y el
`stroke` siguieron a la variable. Si no lo hubieran hecho, el fondo se habría quedado morado
para todas y sólo se habría notado con el teléfono en la mano.

---

## 8. Regenerar el grafo de graphify — ✅ HECHO (2026-09-14)

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

**Hecho (2026-09-14):** corrido en la laptop CESAVESIN, que sí tiene graphify instalado —
lo de "en esta máquina no está instalado" se escribió desde la otra. Incremental, como decía
la entrada: 188 archivos cambiados, 166 de código por AST (gratis, sin LLM) y 22 documentos
por dos subagentes (264.847 tokens). El grafo pasó de **242 nodos / 443 aristas** a **1587
nodos / 3067 aristas**, en 108 comunidades, y `web/` ya aparece entero. El diagnóstico de
integridad salió limpio: sin aristas colgantes, sin extremos ausentes, sin colapsos.

Dos cosas que conviene saber la próxima vez:

- **La extracción paralela de AST falla en Windows** y cae sola a secuencial
  (`BrokenProcessPool`, por el `<stdin>` sin guarda `if __name__ == "__main__"`). Termina
  bien, sólo más lento; no es un error que haya que arreglar para que corra.
- **Sin `GEMINI_API_KEY` la extracción semántica la hace el agente anfitrión** con
  subagentes, no se detiene ni pide ninguna llave. Los 22 documentos quedaron cacheados, así
  que la próxima corrida no los vuelve a pagar si no cambian.

---

## 9. Notificación al entrenador cuando alguien avisa que no viene — ✅ HECHO (2026-09-14)

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

**Hecho y verificado el 2026-09-14**: el entrenador confirmó que la notificación llega a los
teléfonos. Lo que se comprobó por separado antes de esa prueba: `tsc --noEmit` limpio en
`functions`, `assembleRelease` y `test` en verde, y **en los dos teléfonos** —el personal
(`peridot`) y el Samsung (`SM-S908U`, Android 16)— permiso `POST_NOTIFICATIONS` concedido,
canal `avisos_falta` creado con importancia 4, y la app en release firmada con `status=speed`.

Lo que **no** se comprobó de una en una, por si algún día falla algo de esto: que llegue con
la pantalla bloqueada, que llegue con la app en primer plano (el camino que pasa por
`OSfitMessagingService`, distinto del de la app cerrada), y que un doble toque en el botón no
mande dos avisos.

Se hizo más simple de lo que decía el plan de arriba, en dos puntos:

- **No hay `onDocumentCreated`.** El push lo manda la propia `avisarFalta` después de escribir
  el aviso. Un disparador aparte era una pieza más para ver lo mismo que la función ya tiene
  delante. Comprueba si el documento existía **antes** de escribir, para que un doble toque no
  mande dos notificaciones; el envío va en un `try/catch` que sólo loguea, porque la fuente de
  verdad es el documento y el botón de la clienta no puede fallar porque FCM esté caído.
- **No se guardan tokens.** Va por el tema de FCM `entrenador`, al que la app se suscribe sola
  en cada arranque. Los dos teléfonos comparten cuenta y quieren el mismo aviso, así que una
  colección de tokens sólo habría añadido tokens muertos que limpiar.

Lo demás sí fue como se preveía: dependencia `firebase-messaging-ktx`, `OSfitMessagingService`
(sólo hace falta para mostrar el aviso con la app **abierta**; cerrada lo pinta el SDK),
permiso `POST_NOTIFICATIONS` pedido en el arranque, y canal `avisos_falta`. Hizo falta además
un `ic_notificacion.xml` propio: Android pinta el icono pequeño como silueta, y el
`ic_launcher_foreground.png` a color habría salido como una mancha blanca.

Verificado hasta donde se puede sin dispositivo: `tsc --noEmit` limpio en `functions`,
`assembleDebug` y `test` en verde, y el manifest fusionado con el permiso, el servicio y el
canal. **Queda por comprobar en el teléfono:** que llegue con la pantalla bloqueada, que llegue
también con la app abierta, y que tocar el botón dos veces no mande dos.

**Dos cosas que costaron y conviene no repetir:**

- **`lintVitalRelease` tumba la build de release** por las APIs de ActivityResult: algo arrastra
  `androidx.fragment:1.1.0` y hacen falta 1.3.0 o más. Se subió a 1.8.5 en
  `app/build.gradle.kts`. **El build de debug no lo detecta** —ese lint solo corre en release—,
  así que quedarse en `installDebug` esconde el problema hasta el peor momento.
- **Reinstalar es obligatorio** en cada teléfono: con una versión anterior a ésta no está
  suscrito al tema y no le llega nada. Se pudo actualizar sin desinstalar porque el
  `debug.keystore` de esta laptop resultó ser el mismo con el que se firmó lo que tenían los
  dos teléfonos (SHA-256 `3226:5063:6a9c…`, comprobado con `apksigner verify --print-certs`
  sobre la APK sacada con `adb pull`). El choque de firmas de la entrada 11 era desde la otra
  máquina. **Comprobarlo siempre antes de instalar**: `install -r` falla limpio, pero
  desinstalar para salir del paso es lo que la entrada 11 explica que no es gratis.

**Desplegado** con `firebase deploy --only functions:avisarFalta` —solo esa, para no tocar
`sesion`, `cambiarDia` ni `revivirRacha`, que las clientas estaban usando en ese momento— y
tras reinstalar en ambos teléfonos y dejarlos en `status=speed` con
`cmd package compile -m speed -f`.

**Dónde mirar si un día deja de llegar:** `firebase functions:log --only avisarFalta`. El envío
va en un `try/catch` que sólo loguea, así que un fallo de FCM no se ve en ningún otro sitio. Ese
silencio es a propósito —el botón de la clienta no puede fallar porque FCM esté caído—, pero
significa que el log es la única pista.

---

## 10. `rutaStorage` en blanco bloquearía la retención de videos para siempre — ✅ HECHO (2026-09-13)

**Detectado:** 2026-09-13, en la re-revisión de los arreglos de la Etapa 3.

`VideoPublicado.rutaStorage` tiene `""` por defecto, como exige la convención de Firestore.
Si un documento llegara sin ese campo, `storage.reference.child("")` lanza
`IllegalArgumentException` —no `StorageException`—, el `runCatching` de `limpiarSobrantes` se
la traga, y ese documento no se borra nunca. Es la misma clase de bug que se acaba de arreglar
(el `object-not-found` que abortaba el borrado del documento), entrando por otra puerta.

**Por qué no corre prisa:** no hay ningún dato vivo afectado. Todos los documentos de
`clientes/{id}/videos` los escribe `publicarEnLaWeb` con la ruta que devuelve `subir()`, que
nunca es vacía. Hace falta un documento escrito a mano o una migración futura para llegar ahí.

**Qué haría falta:** una línea, tratando la ruta en blanco como "nada que borrar" —
`video.rutaStorage.ifBlank { null } ?: return@forEach`, o el mismo criterio dentro de
`ResumenStorageRepository.borrar`.

**Hecho (2026-09-13):** un `if (ruta.isBlank()) return` al principio de
`ResumenStorageRepository.borrar`, que es el segundo de los dos sitios propuestos: puesto ahí
cierra el agujero para todos los que llaman y no sólo para la retención. Lo adelantó la
pantalla "Videos en la web" (entrada 12), que es una segunda puerta al mismo bug y donde
además era bloqueante: allí quitar el video es la acción principal, así que la excepción
dejaba al entrenador sin ninguna forma de quitar ese documento.

---

## 11. Instalar una build `debuggable` hace el video 25 veces más lento

**Detectado:** 2026-09-13, verificando la Etapa 3 en dispositivo. Lo notó el entrenador:
"antes tardaba máximo minuto y medio por video, ahora va súper lento".

Android **nunca compila AOT una app marcada `debuggable`**: el modo depuración exige código
sin optimizar, así que ART la deja corriendo interpretada. Medido en el teléfono:

| build | estado en `dumpsys package` | ritmo |
|---|---|---|
| `installDebug` | `status=run-from-apk`, y `compile -m speed` solo llega a `verify` | 1% cada ~23 s (≈35 min por video) |
| release firmada + `compile -m speed` | `status=speed` | **86 segundos por video** |

El generador es el peor caso posible para esa diferencia: dibuja frame a frame en la CPU, con
blur real (`BlurMaskFilter`), a 1080×1920 y 30 fps. Son entre 930 y 2.300 frames por video
según cuántas escenas entren.

Síntoma secundario que confunde el diagnóstico: en el logcat aparece
`bbq.waitForFreeSlotThenRelock timeout -1` con `acqCount=16, mMaxAcq=16`. Parece un bloqueo
del codificador, pero es consecuencia de lo lento que va el productor, no la causa.

**Por qué no corre prisa:** no es un bug del código —`ResumenVideoEncoder` no cambió en toda
la Etapa 3— sino de qué APK queda instalada. Se arregla instalando una release.

**Qué haría falta:** el proyecto no tiene `signingConfigs`, así que `assembleRelease` sale sin
firmar y no se puede instalar. Añadir una configuración de firma (aunque sea con el keystore
de depuración: firmar y ser `debuggable` son cosas distintas) dejaría un
`./gradlew installRelease` en un paso. Mientras tanto, el camino manual es `assembleRelease`,
firmar con `apksigner` y después `adb shell cmd package compile -m speed -f com.osfit.app`.

**Hallazgo del 2026-09-14, y ahora además bloquea:** el camino manual se intentó desde la
laptop CESAVESIN y `adb install -r` falló con

```
INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.osfit.app signatures do not match
```

La app que trae el teléfono se firmó en **la otra máquina**: los keystores de depuración son
por máquina, y en ésta sólo existe `~/.android/debug.keystore`, que es otro. No se instaló
nada y no se perdió nada —`install -r` falla limpio, no desinstala—, pero **desde esta laptop
no se puede actualizar la app**, y eso deja la Task 7 Step 2 de la entrada 7 sin poder
hacerse.

**Desinstalar para salir del paso no es gratis, y conviene que quede escrito por qué.** Se
perderían dos cosas que viven sólo en el teléfono:

- `filesDir/canciones/<clienteId>.<ext>` — las canciones de cada clienta, que el entrenador
  eligió a mano desde el almacenamiento del teléfono (`CancionUtil.copiarCancion`).
- Los PNG de las medallas en `filesDir`. Éstos **sí** están además en Storage, pero
  `MedallaCatalogo.kt:15-16` lo dice explícitamente: *"No reemplaza a `imagenArchivo`: el
  generador de video sigue leyendo el PNG de `filesDir`"*. Hay código que sube el que falte
  (`MedallasViewModel:85`), pero **ninguno que lo vuelva a bajar** desde `imagenUrl`. O sea
  que la web seguiría viéndose bien y el video se quedaría sin las imágenes, sin forma de
  recuperarlas desde la app.

**Al día 2026-09-14: el bloqueo era sólo de CESAVESIN.** Desde SISTEMAS-03 el
`debug.keystore` **sí** coincide con el de los dos teléfonos (SHA-256 `3226:5063:6a9c…`,
comprobado con `apksigner verify --print-certs` sobre la APK sacada con `adb pull`), así que
desde ahí se actualiza con `adb install -r` sin desinstalar y sin perder nada. Eso desbloqueó
de rebote la entrada 7. Lo que sigue abierto de esta entrada es la causa de fondo: sin
`signingConfigs` en `app/build.gradle.kts`, cada release hay que firmarla a mano y acordarse
del `cmd package compile -m speed -f` después de instalar, o el video vuelve a los 35 minutos.

**La salida barata es copiar el `~/.android/debug.keystore` de la otra laptop a ésta** — con
el mismo certificado, `install -r` funciona y no se pierde nada. La salida definitiva sigue
siendo la de arriba: meter `signingConfigs` en `app/build.gradle.kts` con un keystore del
repo, para que deje de depender de en qué máquina se compiló.

---

## 12. Elegir qué videos se suben a la web, y poder quitarlos — ✅ HECHO (2026-09-13)

**Detectado:** 2026-09-13.

> investigar como funciona la subida de un video a la web, si genero varios de una misma
> persona, como decido cual se sube y cual no, debe haber un boton para subir o quitar videos
> de la web de las personas

Cómo funciona hoy, para que la investigación arranque con esto ya sabido: "Publicar en la web"
sube el mp4 que se acaba de generar y escribe el documento en `clientes/{id}/videos` con el
`rangoInicio` como id, así que **republicar la misma quincena pisa la anterior**. No hay forma
de elegir entre varios videos de la misma quincena ni de quitar uno ya publicado: lo único que
borra es la retención automática, que elimina todo lo que pase de los 6 más recientes.

Además, la tarjeta de publicar sólo existe en memoria justo después de generar: si el
entrenador sale de la pantalla, desaparece y hay que volver a generar el video para poder
publicarlo.

**Alcance acotado por el entrenador el 2026-09-13**, después de explicarle cómo funciona hoy:

> lo de elegir entre varios no es necesario, pero lo que si quiero hacer es lo de la pantalla
> de videos de la web por clienta

Eso descarta la única parte que no tenía solución clara. Elegir entre varias versiones de la
misma quincena obligaba a decidir dónde guardarlas, porque el generador borra del caché del
teléfono todo lo que pase de una hora; sin esa parte, no hace falta conservar nada nuevo.

Queda una pantalla que sólo lee lo ya publicado y permite quitarlo: listar
`clientes/{id}/videos` y, por cada uno, borrarlo. Las piezas de datos ya existen
(`VideoPublicadoRepository.observarDe` y `.borrar`, `ResumenStorageRepository.borrar`), y el
borrado debe seguir el mismo orden que la retención —primero el blob, después el documento—
por el mismo motivo: un blob huérfano no se ve y se paga, un documento sin blob se ve y se
reintenta.

**Hecho (2026-09-13):** pantalla "Videos en la web" por clienta, con la misma forma que
"Medallas": lista lo publicado (encabezado del rango y duración en mm:ss) y lo quita con la
papelera, detrás de un `AlertDialog` de confirmación porque republicar obliga a regenerar el
video. Se borra primero el blob de Storage y después el documento, con `video.rutaStorage`.
Falta verificarlo en el dispositivo.

---

## 13. El promedio de entrenamiento sale `NaN` en la web — ✅ HECHO (2026-09-14)

**Detectado:** 2026-09-14. Lo vio el entrenador: a **Dulce** y a **Carito** la página les
muestra el promedio como `NaN` en vez de un número de minutos.

La causa está localizada y es de tipos, no de datos corruptos. `promedioMinutos()` en
`web/src/racha.ts:43-49` filtra con `a.duracionMinutos !== null` y después castea con
`as number`. Pero Firestore **omite los campos que nunca se escribieron**, así que una
asistencia vieja no llega con `duracionMinutos: null`: llega **sin el campo**, o sea
`undefined`. `undefined !== null` es `true`, el filtro lo deja pasar, el `as number` calla a
TypeScript, y el `reduce` suma `undefined` → `NaN`.

Le pasa a Dulce y a Carito y no a las demás porque son las que tienen asistencias anteriores
a que se empezara a escribir la duración, o registradas sin cronómetro.

El mismo archivo `web/src/datos.ts:27-34` ya documenta este riesgo exacto para
`justificadaPorCliente` ("Opcional a propósito: Firestore omite los campos que nunca se
escribieron... Ver el commit `bf5463c`"). `duracionMinutos` quedó declarado
`number | null` —no opcional—, así que el mismo peligro entró por la puerta que sí estaba
señalada, sólo que en el campo de al lado. El `snap.data() as Asistencia` de `observarAsistencias`
es un cast sin validar: la forma que promete el tipo no es la que Firestore entrega.

**Por qué no es urgente:** no corrompe nada ni pierde datos, y no afecta la racha ni el
calendario; es una cifra fea en una tarjeta. Pero se la ve la clienta en su propia página,
así que tampoco conviene dejarlo mucho.

**Qué haría falta:** aceptar `undefined` en el filtro —
`.filter((a) => a.asistio && a.duracionMinutos != null)` con `!=` en vez de `!==`, que cubre
`null` y `undefined` de una vez— y declarar el campo `duracionMinutos?: number | null` en
`datos.ts` para que el tipo diga la verdad sobre lo que Firestore manda.

**Ojo con los tests:** las 89 pruebas pasan y no lo detectan porque todas construyen las
asistencias a mano pasando `duracionMinutos: null` explícito (`racha.test.ts:4-6`,
`cupo.test.ts:16`, `faltaRompio.test.ts:18`). Ninguna omite el campo, que es justo el caso
real. El arreglo tiene que traer un test que construya la asistencia **sin** la propiedad.

**Hecho (2026-09-14, commit `cceb013`).** El diagnóstico de arriba era correcto y se confirmó
reproduciéndolo con un test antes de tocar nada: una asistencia construida **sin** la
propiedad daba `NaN`, tal como decía la nota. Se arregló un punto más estricto de lo
propuesto: en vez de `!= null`, el filtro exige `typeof d === "number" && Number.isFinite(d)`,
que además tapa el caso de que el campo llegue con algo que no sea un número —el
`snap.data() as Asistencia` sigue siendo un cast sin validar—. `duracionMinutos` quedó
declarado `?: number | null` en `datos.ts`, con la nota de por qué.

**Verificado:** dos tests nuevos en `racha.test.ts` (una asistencia sin el campo se ignora y
se promedia el resto; si ninguna lo trae devuelve `null`, no `NaN`), 91/91 en verde y
`tsc && vite build` limpio. Desplegado a hosting el mismo día, y el entrenador
confirmó ese mismo día que la página de Dulce y de Carito ya muestra el número de minutos.
Cerrado.

---

## 14. Los archivos locales sobreviven a una desinstalación — ✅ HECHO (2026-09-14)

**Detectado:** 2026-09-14, al chocar con la entrada 11.

> para que cada vez que yo lo suba se suba a algun lugar y que no se borren cada vez que yo
> desinstale

Antes de esto, `filesDir` era el único sitio donde vivían las canciones de cada clienta y los
PNG de las insignias, y el generador de video los lee de ahí. Desinstalar los borraba: las
insignias tenían copia en Storage pero **nada las volvía a bajar**, y las canciones no tenían
copia en ninguna parte.

Ahora la nube es **respaldo, no fuente**. `CancionUtil.copiarCancion` sigue copiando primero a
`filesDir` —su motivo documentado sigue siendo válido— y además se sube a
`canciones/<clienteId>.<ext>`, guardando la **ruta** (no la URL de descarga) en
`Cliente.cancionRuta`, por la misma razón que los resúmenes. Al arrancar,
`RestauradorDeArchivos` —con la forma de `SincronizadorDiaWeb`, y por el mismo motivo de
concentrar la respuesta a "¿quién restaura?"— baja **sólo lo que falta en disco**.

Spec: `docs/superpowers/specs/2026-09-14-archivos-locales-en-la-nube-design.md`.
Plan: `docs/superpowers/plans/2026-09-14-archivos-locales-en-la-nube.md`.

**Verificado en dispositivo el 2026-09-14**, con la app release firmada y AOT-compilada
(`status=speed`, sin `DEBUGGABLE`):

- Instalación limpia: la app se autentica sola y carga clientes.
- **Las imágenes de medallas volvieron solas** tras una instalación limpia — se dibujan con sus
  PNG propios, que sólo pueden estar ahí porque el restaurador los bajó de Storage.
- **El viaje completo de una canción**: se eligió una para Estela, se desinstaló, se reinstaló
  y volvió sola. La evidencia fina está en que antes del ciclo su pantalla mostraba el inicio
  del fragmento **sin duración ni barra** (archivo ausente) y después mostraba **duración y
  barra**, o sea que la app leyó el audio real de `filesDir`.

**Lo que costó, y conviene no repetir:** una revisión de toda la rama encontró que el
restaurador se lanzaba **antes** de que la app se autenticara. Como la sesión se inicia desde
dentro de la composición, en el arranque de después de reinstalar —el único que de verdad
tiene algo que restaurar— los listeners de Firestore salían denegados y la restauración entera
se perdía en silencio. Era el único consumidor de Firestore fuera de la rama
`AuthState.Success`. También se arregló que una descarga cortada dejaba un archivo truncado
que contaba como "presente" para siempre: ahora se baja a un temporal y se renombra al
terminar (`DescargaAtomica`).

**Lo que este cambio NO hace, a propósito:** no rescata lo que ya estaba en el teléfono. Las
canciones anteriores se perdieron al reinstalar y hay que volver a elegirlas — acordado así.
Tampoco borra de la nube cuando se borra en local, así que cambiar la extensión de una canción
deja un huérfano en `canciones/`. Hay uno ahora mismo, de la prueba.

**Orden obligatorio al desplegar:** las reglas de Storage **antes** que la APK. Si la app llega
primero, toda canción elegida en esa ventana se rechaza en silencio y se queda sin respaldo,
sin aviso en la interfaz y sin reparación posterior.

**Nota de instalación:** en este teléfono `adb install` falla con
`INSTALL_FAILED_USER_RESTRICTED` (restricción de MIUI, distinta del problema de firma de la
entrada 11). Se rodea empujando la APK a `/data/local/tmp` y usando `adb shell pm install`.
Desde Git Bash no funciona —convierte la ruta a Windows—: hay que hacerlo desde PowerShell.

---

## 15. Cambiar las fotos de los logros personales — ✅ HECHO (2026-09-15)

**Detectado:** 2026-09-14.

> agrega al backlog modificar las fotos de los logros personales

Sin concretar todavía **qué** cambia: si es sustituir las imágenes que ya están por otras, o
poder cambiarlas desde la app sin recompilar. Preguntarlo antes de tocar nada.

Dónde vive: las imágenes de logros y medallas se suben a Storage y se restauran solas
(`InsigniaStorageRepository`, `RestauradorDeArchivos`), y el catálogo es
`LogroPersonalCatalogo`. O sea que cambiar una foto es cambiar el archivo, no el código — lo
que apunta a que esto puede acabar siendo una tarea de contenido y no de programación.

**Por qué no corre prisa:** los logros se ven y funcionan; es cuestión de que se vean mejor.

**Resuelto el 2026-09-15: era lo primero de las dos opciones.** El entrenador sustituyó las
imágenes que ya estaban por otras. No hubo cambio de código: acabó siendo una tarea de
contenido, que es justo lo que esta entrada apuntaba como desenlace probable.

Queda descartada, entonces, la otra mitad de la pregunta: **no** se hizo que las fotos se
puedan cambiar desde la app sin recompilar. Si alguna vez vuelve a hacer falta cambiarlas y
se quiere evitar el recompilado, eso es una entrada nueva, no ésta.

---

## 16. Exagerar la animación de cuando se gana una medalla — ⏳ HECHO EN CÓDIGO (2026-09-15), FALTA VERLO EN UN VIDEO

**Detectado:** 2026-09-14.

> exagerar mas la ganada de medallas en cuestion de animacion

Ahora mismo ganar una medalla se celebra poco para lo que es. La idea es que se note: que el
momento se sienta como un premio y no como un cambio de estado.

**Lo primero que hay que decidir es dónde**, porque hay dos sitios y la frase vale para los
dos: la tarjeta de insignias de la web (`web/src/ui/tarjetaInsignias.ts`) y el vídeo resumen
(`video/EscenaResumen.kt`, `TimelineResumen.kt`). No empezar sin aclararlo — son dos trabajos
distintos, con dos técnicas distintas.

**Por qué no corre prisa:** es puro adorno. La medalla se otorga y se ve igual de bien o de
mal que hoy.

### Se eligió el video (2026-09-15)

El entrenador decidió el sitio: **el video resumen**. La tarjeta de la web queda fuera de esta
entrada. Si algún día se quiere animar también ahí, es una entrada nueva: `tarjetaInsignias.ts`
hoy es HTML estático sin ninguna animación, así que sería escribirla de cero en CSS, y además
se vería al abrir la página y no en el momento de ganar la medalla.

### Qué estaba pasando

`dibujarMedalla` **solo interpolaba opacidad**: de alpha 0 a 255 en 600ms, sin escala, sin
entrada y sin rebote. Todo el peso de "premio" lo cargaba el halo, con un sobrepaso modesto a
1.7× que caía en 700ms. Por eso se leía como un cambio de estado: literalmente lo era.

Y había hueco de sobra. La medalla terminaba de entrar a los **3.9s** (3300 + 600) y el
mensaje no arranca hasta los **5.9s**: dos segundos en los que no pasaba nada.

### Lo que se hizo

Tres cambios, todos en `ResumenFrameRenderer.kt`:

- **`escalaEntrada(elapsedMs)`, nueva.** La medalla entra desde 0.4× frenando (ease-out
  cúbica), **se pasa** hasta 1.12× en el aterrizaje, y late amortiguada 1200ms hasta quedarse
  en 1f. El sobrepaso es lo que convierte la aparición en un golpe.
- **`DESTELLO_PICO` de 1.7 a 2.6.** No hizo falta re-sincronizarlo: la curva del destello ya
  picaba exactamente en el aterrizaje (`MEDALLA_INICIO_GRUPAL_MS + MEDALLA_FADE_MS`), así que
  el golpe de luz y el de escala ya caían en el mismo frame. Solo se subió el número.
- **El radio de dibujo se separó del radio de layout.** El nombre de la medalla se sigue
  colgando del radio fijo. Si se colgara del animado, subiría y bajaría con cada rebote.

**`TimelineResumen.kt` no se tocó.** Las duraciones no cambian, el video dura exactamente lo
mismo y ninguna otra escena se corre. La animación se come 1.2s de los 2s muertos y deja
800ms de calma antes del mensaje — a propósito: el mensaje se lee quieto.

**No se metieron partículas ni rayos radiales**, y conviene que quede escrito por qué: el
generador dibuja frame a frame en CPU, entre 930 y 2.300 frames por video (entrada 11).
Escalar un bitmap no cuesta nada; N partículas por frame sí. Si al verlo sabe a poco, esa es
una segunda pasada y hay que medirla, no darla por gratis.

### Qué se verificó, y qué no

Verificado con tests, en `MedallaAnimacionTest.kt` (7 tests, escritos antes de implementar y
vistos fallar): que antes de entrar la escala es la inicial; que la entrada crece sin
retroceder; que en el aterrizaje sobrepasa 1f; que después late **por debajo** de 1f (sin ese
cruce hay decaimiento, no rebote); que vuelve a **1f exacto** antes de
`MENSAJE_MEDALLA_INICIO_MS`; y que el pico de escala y el de destello caen en el mismo
instante. Suite completa en verde: 271 tests.

**Lo que NO se verificó: cómo se ve.** Los tests prueban la forma de la curva, no el trazo.
Hay que generar un video en el teléfono y mirarlo. **Ojo con la entrada 11**: con una build
`debuggable` son ~35 minutos por video; con una release firmada más
`adb shell cmd package compile -m speed -f com.osfit.app`, 86 segundos.

Las dos perillas, si al verlo hay que ajustar: `ESCALA_SOBREPASO` (cuánto se pasa) y
`DESTELLO_PICO` (cuánto brilla). Cambiar cualquiera de las dos no rompe ningún test salvo que
`ESCALA_SOBREPASO` baje de 1f, que es justo lo que ese test protege.

### Segunda pasada (2026-09-15): "casi no se nota"

El entrenador lo vio y no se notaba. Tenía razón, y por **dos** motivos, los dos errores de
la primera pasada y los dos invisibles desde los tests:

**1. El fade se comía la animación.** La opacidad iba de 0 a 255 en los **mismos** 600ms en
que la escala subía de 0.4× a 1.12×. La medalla hacía casi todo su crecimiento siendo
transparente: se animaba, pero no se veía animarse. Ahora la opacidad llega a tope en 180ms
(`MEDALLA_OPACIDAD_MS`) y quedan 420ms de crecimiento a la vista.

**2. El destello estaba saturado, y el cambio anterior no hizo nada.** En `dibujarHalo` el
alpha es `(HALO_ALPHA_MEDALLA * intensidad).coerceIn(0, 255)`, y con `HALO_ALPHA_MEDALLA` en
150 **cualquier intensidad por encima de ~1.7 clampea a 255**. Subir `DESTELLO_PICO` de 1.7 a
2.6 fue literalmente un no-op. El halo no podía brillar más: tenía que crecer. Eso es
`HALO_CRECIMIENTO_DESTELLO`, que agranda el radio del halo con la intensidad y es la perilla
de verdad. Con intensidad 1 —los logros personales— no cambia nada.

Lo demás de esta pasada, ya con eso arreglado:

- **Rango de escala mucho mayor:** 0.12× → sobrepaso 1.38× (antes 0.4× → 1.12×).
- **`rotacionEntrada`, nueva.** Entra ladeada −16°, se pasa a +5° al aterrizar y se endereza
  oscilando hasta 0° exacto. El golpe deja de ser solo de tamaño.
- **`ondaExpansiva`, nueva.** Un aro blanco que sale del borde en el frame del golpe, se abre
  hasta 2.9× el radio y se apaga en 520ms. **Es un solo `drawCircle` en STROKE por frame,
  ~16 frames en total** — por eso éste sí se paga y un sistema de partículas no.
- **Asentamiento de 1200 a 1400ms.** Termina en 5.3s, todavía antes del mensaje (5.9s).

La oscilación amortiguada se extrajo a `oscilacionAmortiguada`, compartida por escala y
rotación: las dos tienen que morir en el mismo instante y en cero exacto, y con dos copias
eso se separa en cuanto alguien toque una.

Tests: 11 en `MedallaAnimacionTest.kt`, cuatro nuevos. Uno de ellos es el que habría cazado el
fallo del fade — *"la medalla ya es opaca mientras todavía está creciendo"*: busca el primer
instante en que la opacidad llega a 1f y exige que en ese momento le quede todavía más de
0.30 de crecimiento por hacer. Suite completa: 275 tests.

**Sigue sin verificarse cómo se ve.** Los tests miden la forma de las curvas; que el resultado
se sienta un premio solo se sabe mirando un video.

---

## 17. Arranque lento de la web — ⏳ DESPLEGADO (2026-09-15), FALTA VERIFICAR Y LO DEMÁS

**Detectado:** 2026-09-15.

> quiero que investigues de la web, cuando un cliente entra a su link, tarda algunos
> segundos en cargar, esto a que se debe? se puede reducir?

**Estado: desplegado el 2026-09-15**, de arrastre con el Bloque A de la entrada 19 —son
cambios de `web/` igual—, desde SISTEMAS-03 y con `npm run build` a mano antes, como avisa la
constante de abajo. El bundle servido es `assets/index-IxZpqViu.js` y la página responde 200.
Lo que **no** se ha hecho es la verificación de la sección "Qué verificar cuando esté
desplegado": eso requiere DevTools contra la página real y sigue pendiente, igual que la lista
de "Lo que queda, en orden de impacto".

El comando que se corrió, que es el que documentaba esta entrada:

```bash
cd web && npm ci && npm run build
cd .. && firebase deploy --only hosting
```

Solo `hosting`: los dos cambios son de `web/`, no tocan functions ni reglas. Y el
`npm run build` va aparte porque `firebase.json` no tiene hooks de `predeploy` (ver la nota
en U1); sin eso se sube el `dist` viejo y parece que el despliegue no sirvió.

### Por qué tardaba

Todo el arranque es una cadena en serie y nada se pinta hasta el último eslabón:
HTML → bundle de Firebase → canje del token contra la function `sesion` →
`signInWithCustomToken` → handshake de Firestore → primer `pintar()`. Hasta ahí, la clienta
veía un `Cargando…` sobre fondo vacío.

Medido en este repo (no estimado), con `npm run build` y con esbuild por módulo:

| Pieza | gzip |
|---|---|
| bundle completo, antes | 170 kB |
| └ `firebase/firestore` | 125 kB (74% del total) |
| └ `firebase/auth` | 25 kB |
| └ `firebase/app` | 8 kB |
| └ `storage` + `functions` | 9 kB |
| CSS | 1.9 kB |

No hay fuentes web ni imágenes pesadas: el peso es todo SDK de Firebase.

### Lo que ya se hizo (commit 543b41c)

**Esqueleto de carga en `index.html`.** Va en el HTML y no en `main.ts` a propósito: así se
pinta al llegar el documento, sin esperar el bundle ni el canje del token. Sus alturas salen
de medir las tarjetas reales en Chromium, renderizando los módulos de UI con datos de
prueba — saludo 38 px, tarjeta del día 237, stats 101, calendario 350 — así que la página no
da un salto al llenarse. Gris neutro, sin colores de la paleta, porque la paleta llega con
el documento de la clienta y el esqueleto no debe cambiar de color a la vista (misma razón
por la que `aplicarPaleta` corre antes del primer `pintar()`).

**Caché persistente de Firestore** (`web/src/firebase.ts`): `initializeFirestore` con
`persistentLocalCache()`. En la segunda visita `onSnapshot` entrega primero lo guardado en
IndexedDB, así que la página pinta antes de que conteste la red, y de paso baja las lecturas
facturadas. Verificado en el código del SDK (`canFallbackFromIndexedDbError`) que si
IndexedDB no está disponible —modo privado, cuota llena, navegador interno de WhatsApp— cae
solo a caché en memoria con un warning en consola; no rompe la página.

**Contrapartida medida, que hay que tener presente:** el caché persistente subió el bundle de
170 a **190 kB gzip**. La primera visita paga esos 20 kB sin recibir nada a cambio (el caché
está vacío); se recuperan en cada visita siguiente. Para una página que se abre casi a diario
el saldo es positivo, pero si alguna vez se decide que no, el cambio es una línea.

### Qué verificar cuando esté desplegado

1. DevTools → Network → "Disable cache": el esqueleto gris debe verse antes de que termine
   de bajar el JS.
2. Recargar **sin** "Disable cache" (la visita repetida): la página debe aparecer con datos
   casi al instante, servidos de IndexedDB.
3. Si en consola sale `Error using user provided cache. Falling back to memory cache`, ese
   navegador no dejó usar IndexedDB. No es un fallo, pero conviene probarlo **abriendo el
   link desde WhatsApp**, que es como entran las clientas de verdad.

### Lo que queda, en orden de impacto

**a) El cold start de `sesion`. Medirlo antes de decidir nada.** `functions/src/sesion.ts` es
`onRequest` sin `minInstances`, así que Cloud Run escala a cero y con el tráfico esporádico
del gimnasio casi siempre arranca en frío (Node 22 + firebase-admin: típicamente 1.5-4 s).
En DevTools, ver cuánto tarda la llamada a `sesion-cuzhc6pwiq-uw.a.run.app`; recargar
enseguida y comparar, porque la segunda pega una instancia ya tibia y la diferencia confirma
el diagnóstico.

Ojo con el matiz: ese canje **solo ocurre con la URL `/c/<token>`**. En visitas siguientes la
sesión persiste y el `fetch` se salta. Si resulta que tarda *siempre*, el culpable no es el
cold start sino que la sesión no persiste — sospecha principal: el navegador interno de
WhatsApp no comparte almacenamiento y cada apertura vuelve a ser "primera vez".

Dos arreglos, y conviene el gratis primero: `functions/src/index.ts` exporta las 4 functions
estáticamente, así que el contenedor de `sesion` carga en cada arranque el módulo de
`avisarFalta` con su `firebase-admin/messaging`, código que `sesion` no usa nunca; moviendo
esos imports dentro de cada handler el arranque se acorta sin costo. Si aun así molesta,
`minInstances: 1` lo elimina, pero se paga ~5-8 USD/mes de instancia tibia 24/7 (se abarata
con `cpu: 0.25`) y hay que ponerlo **solo** en `sesion`.

**b) Diferir `storage` y `functions` con `import()` dinámico.** Devuelve ~9 kB gzip de los 20
que costó el caché. `storage` solo hace falta al resolver las URLs de los videos y
`functions` al tocar una acción: ninguno de los dos en el primer pintado.

**c) Acotar las queries.** `observarAsistencias` (`web/src/datos.ts`) trae *todas* las
asistencias históricas de la clienta, sin `limit` ni filtro de fecha, y crece para siempre;
las otras cinco igual. Limitar a los últimos ~12 meses achica el primer snapshot.

**d) `preconnect` y cache headers.** Un `<link rel="preconnect">` a firestore,
identitytoolkit y el dominio `run.app` ahorra DNS+TLS en cada salto de la cadena serial. Y
`firebase.json` no tiene bloque `headers`, así que los assets con hash salen con el
`max-age` por defecto de Hosting en vez de `immutable`.

**Por qué no corre prisa (lo que queda):** con el esqueleto desplegado la página ya *se ve*
ocupada desde el primer momento, que era lo que hacía que los segundos se sintieran rotos.
Lo de arriba baja los segundos de verdad, pero ninguno es un fallo.

---

## 18. Rotar el token de acceso web que se compartió en un chat

**Detectado:** 2026-09-15, durante la investigación de la entrada 17.

Para que pudiera probar la página se pegó en el chat un link `/c/<token>` de una clienta
real. El token quedó escrito en el historial de esa sesión, que no es un sitio pensado para
guardar credenciales.

Qué hacer: borrar ese documento de `accesosWeb` y generarle un link nuevo desde la app. No
hace falta más — el token es lo único que canjea la sesión, así que revocarlo lo cierra.

**Por qué no corre prisa:** el link da acceso solo a los datos de esa clienta, no a los del
gimnasio, y para usarlo hay que tener el historial del chat. Pero es trabajo de un minuto.

---

## 19. Ejecutar los tres bloques de "Rutinas en la web"

**Detectado:** 2026-09-15, al definir la feature con el entrenador.

> necesito crear una nueva feature que me permita agregar rutinas a la web, estas rutinas
> deben poder venir de dos lugares diferentes, el que yo escoja

Spec y plan escritos y commiteados, sin una sola línea de código todavía:

- `docs/superpowers/specs/2026-09-15-rutinas-en-la-web-design.md`
- `docs/superpowers/plans/2026-09-15-rutinas-en-la-web.md`

El plan son 13 tareas en tres bloques. **El orden es por qué se puede desplegar solo, no por
dependencia técnica**, así que se pueden hacer en sesiones distintas y cortar por donde sea:

- [x] **Bloque A (Tasks 1-2) — Los ejercicios en la página. ✅ HECHO Y DESPLEGADO
  (2026-09-15).** `tarjetaDia` lista nombre, series, repeticiones y `pesoONota`, y el
  día sin ejercicios lo dice en vez de dejar un hueco. El 2026-09-15 se desbloqueó al retomarlo
  desde **SISTEMAS-03**, que sí tiene Node, npm y la CLI de Firebase (ver entrada 20).
- [x] **Bloque B (Tasks 3-5) — Rutina propia y edición por cliente. ✅ HECHO (2026-09-15).**
  Solo app: no toca la web y no necesita despliegue. Sección Rutina dentro de la tarjeta
  Acceso web, edición por día con el diálogo de desprenderse, y confirmación al reasignar
  plantilla a quien tiene rutina propia.
- [x] **Bloque C (Tasks 6-12) — Variaciones que rotan solas. ✅ HECHO Y DESPLEGADO
  (2026-09-15).** Falta instalar la app en el teléfono: el despliegue es sólo la web.
 Modelo, los tres caminos de escritura, `VariacionCalculator`, la UI de
  variaciones y el gemelo `web/src/variacion.ts`. La Task 11 **sí se hizo**, así que la página
  no se queda mostrando siempre la primera variación: ese riesgo ya no aplica.
- [ ] **Task 13 — Verificación en dispositivo. ⏳ PENDIENTE.** No se puede cubrir con tests:
  la rotación depende de asistencias reales en días reales y la UI es Compose, que la suite no
  prueba. Es lo único que queda junto con los dos despliegues. La lista de qué probar está en
  el Task 13 del plan y **no se resume aquí para no tener dos versiones**.

**Tres cosas que conviene saber antes de empezar, y que están argumentadas en el plan:**

**Esto revierte una decisión explícita del spec del 2026-09-10.** Aquel documento tiene una
sección titulada "Por qué la página no muestra los ejercicios" que avisa a quien lo lea
después: *"va a ver una tarjeta de 'hoy te toca' sin ejercicios y va a querer 'arreglarla'.
No es un bug."* El entrenador decidió revertirla el 2026-09-15. El spec nuevo lo dice; el
viejo hay que leerlo sabiendo esto.

**Al entrenador se le avisó que `pesoONota` dejó de ser privado, y aun así pidió desplegar
(2026-09-15).** Desde ese despliegue, una nota suya del tipo «bajarle, se lastimó» se ve en la
pantalla de la clienta. Queda escrito acá porque el riesgo está aceptado, no resuelto: si algún
día estorba, la salida que fija el spec es partir el campo en dos (`peso` visible y `nota`
interna), no dejar de pintarlo — esconderlo en el pintado es justo el error que este spec
corrigió.

**El Task 2 incluye avisarle al entrenador que `pesoONota` dejó de ser privado.** Es un campo
de uso mixto —a veces el peso, a veces una nota suya del tipo "bajarle, se lastimó"— y a
partir del despliegue del Bloque A la clienta lo ve. El riesgo está aceptado por escrito en
el spec, pero eso no es lo mismo que que él se entere el día que aparece en la pantalla. Ese
paso no se salta.

**`registrarAsistencia` se traga los campos que no se nombren.** Construye un `Asistencia(...)`
desde cero y hace `set()`, no un `copy()`. El Bloque C le agrega `variacionRealizada`, y si se
olvida ahí el síntoma sería que la rotación se reinicia sola cada vez que el entrenador
remarca una asistencia, sin que nadie lo relacione. Son tres los caminos que escriben el día
—`registrarAsistencia`, `iniciarTiempo` y `actualizarDiaRealizado`— y los tres tienen que
tratar la variación. Está en la decisión 1 del plan, con la tabla.

**Por qué no corre prisa:** no hay nada roto. Hoy la página funciona igual que siempre y la
rutina se la manda el entrenador por WhatsApp, que es lo que se ha hecho hasta ahora. Lo que
sí conviene es no dejar el Bloque A parado mucho tiempo: es un despliegue de `web/` y ya está
todo decidido.

**Depende de:** nada. Pero cuando se despliegue el Bloque A se lleva por delante lo que siga
sin desplegar de la entrada 17 (el esqueleto de carga y el caché persistente, que están en
`main` desde el 2026-09-15 sin subir). No es un problema —son cambios de `web/` igual— pero
conviene verificar los dos en la misma pasada en vez de creer que el despliegue hizo solo una
cosa.

---

## 20. `DESKTOP-DA82BC2` no tiene Node, npm ni firebase CLI — ✅ RESUELTO CAMBIANDO DE MÁQUINA (2026-09-15)

**Detectado:** 2026-09-15, al arrancar la implementación de la entrada 19.
**Resuelto:** el mismo día, retomando el trabajo desde **SISTEMAS-03**.

> **Ojo al leer lo de abajo: el título original decía "esta máquina" y eso ya engaña.** El
> diagnóstico vale sólo para `DESKTOP-DA82BC2`. **SISTEMAS-03 sí tiene** Node v24.18.0
> (`C:\Program Files\nodejs`), npm 11.16.0 y la CLI de Firebase (`%APPDATA%\npm\firebase`),
> y desde ahí se hizo todo lo de `web/` el 2026-09-15: el Bloque A, la Task 11 y las dos
> suites en verde (264 tests de Kotlin, 108 de TypeScript). Lo que sigue bloqueado no es el
> `web/`: es el despliegue, que está a la espera de decidirlo, no de una herramienta.
>
> Es la segunda opción de las dos que esta misma entrada proponía, y confirma su propia
> conclusión: **preguntar "¿desde cuál máquina?" antes de planear una sesión** ahorra
> descubrirlo a medias. Lo que no se hizo es instalar Node en `DESKTOP-DA82BC2`, así que desde
> ahí sigue sin poderse tocar `web/`.

La máquina **`DESKTOP-DA82BC2`** —una tercera, que el backlog no conocía: hasta ahora solo
aparecían CESAVESIN y SISTEMAS-03— tiene Java 17 y Gradle funcionando, pero **no tiene Node,
ni npm, ni la CLI de Firebase**. Comprobado buscando también en las rutas habituales
(`Program Files\nodejs`, `%APPDATA%\npm`, nvm, scoop): no está en ningún lado, no es que
falte del PATH.

Consecuencia: desde aquí **no se puede tocar nada de `web/` ni desplegar**. En concreto queda
bloqueado:

- **El despliegue pendiente de la entrada 17**, que dice ser "lo primero que hay que hacer en
  la próxima sesión". El esqueleto de carga y el caché persistente siguen sin llegarle a las
  clientas, y `cd web && npm ci && npm run build` + `firebase deploy --only hosting` no corre
  en esta máquina. **Si esa entrada lleva días parada, ésta puede ser la razón.**
- **El Bloque A de la entrada 19** (Tasks 1-2), que es 100% TypeScript en `web/`.
- **La Task 11** de la entrada 19, el gemelo `web/src/variacion.ts`.
- **La Task 12**, el despliegue del Bloque C.

No se escribió el TypeScript "a ciegas" a propósito. El plan exige el ciclo test-primero con
"Expected: FAIL" confirmado antes de implementar, y las Global Constraints lo repiten; escribir
TS que nunca se ejecuta es justo lo que esas convenciones prohíben, y dejaría código sin probar
en la única parte del sistema que ven las clientas directamente.

**Qué hacer, en orden de preferencia:**

1. **Instalar Node LTS en esta máquina** (`winget install OpenJS.NodeJS.LTS`) y la CLI de
   Firebase (`npm i -g firebase-tools`). Es lo que desbloquea todo de una y no depende de
   volver a sentarse en otra laptop. No se hizo sin preguntar: es una máquina de trabajo y
   nadie lo pidió.
2. **Hacer lo de `web/` desde la máquina donde sí esté** (probablemente aquella desde la que
   se escribió la entrada 17, que sí desplegó el 2026-09-12). Funciona, pero deja el trabajo
   partido entre dos sitios y es como se llegó a esto.

**Por qué no corre prisa:** lo de Kotlin —que es la mayor parte de la entrada 19— sí se puede
hacer aquí y se hizo. Pero **ojo**: el Bloque A es la parte que de verdad ven las clientas, y
es la más barata del plan. Que esté bloqueada por una herramienta que falta, y no por una
decisión de diseño, es el peor motivo posible para que se quede parada.

**Relacionado:** la entrada 11 ya documenta que los keystores de depuración difieren por
máquina y que desde CESAVESIN no se puede actualizar la app del teléfono. El proyecto está
repartido entre al menos tres máquinas con capacidades distintas, y conviene tenerlo presente
antes de planear una sesión: preguntar primero "¿desde cuál?" ahorra descubrirlo a medias.

---

## 21. Las plantillas viejas no llegan a la web hasta que se guarden una vez

**Detectado:** 2026-09-15, al meter variaciones en las plantillas compartidas.

Desde hoy, guardar una plantilla la copia a `rutinaAsignada` de cada clienta que la
sigue (`RutinaRepository.propagarASeguidoras`). Eso arregla un fallo que llevaba
existiendo desde que la web muestra ejercicios: **las ediciones de una plantilla nunca
le llegaban a la página de la clienta**, que seguía mostrando la copia congelada del día
en que se le asignó. La app enseñaba la plantilla viva y la web otra cosa, sin que nada
lo dijera.

**Lo que queda pendiente es lo viejo.** La copia se hace *al guardar*, y no se escribió
ninguna migración que recorra las plantillas existentes. Hasta que cada plantilla se abra
y se guarde una vez, sus seguidoras siguen viendo en la web lo que veían ayer.

**Qué hacer:** abrir cada plantilla en la pestaña Rutinas y darle Guardar. No hace falta
cambiar nada; el guardado dispara la copia. Son tantas pulsaciones como plantillas haya.

**Por qué no corre prisa:** no hay nada roto ni peor que antes — es exactamente el estado
en el que llevaban desde siempre. Sólo que ahora tiene arreglo, y el arreglo es trivial.

**Ojo si en vez de eso se escribe una migración:** tiene que escribir **sólo**
`rutinaAsignada`. Tocar `diaActualIndex` o `diaAnclaFecha` le movería el día del ciclo a
todo el mundo de golpe, que es justo el desastre que el spec *Calendario-Rutina como ley*
existe para impedir.

---

## 22. Renombrar un ejercicio le borra su peso propio a quien lo tuviera

**Detectado:** 2026-09-15, al construir los pesos por clienta.

`Cliente.pesoPorEjercicio` se indexa por el **nombre normalizado** del ejercicio, y esa
decisión es la que hace que reordenar la plantilla o meter un ejercicio en medio no le
despegue los pesos a nadie — que es el caso común. El caso raro es el que paga:
cambiarle el nombre a un ejercicio en la plantilla ("Press banca" → "Press plano") deja
huérfano el peso propio de cada clienta que lo tuviera, y todas vuelven a ver el de la
plantilla.

**No se pierde nada visible ni se rompe nada**: el mapa conserva la entrada vieja, sin
usarse, y el ejercicio muestra el peso del grupo. Si se vuelve a poner el nombre
anterior, los pesos reaparecen solos.

**Qué habría que hacer si estorba:** darle un `id` fijo a cada `Ejercicio`, generado al
guardar la plantilla, e indexar el mapa por ese id en vez de por el nombre. Aguanta
también el renombrado. Se valoró el 2026-09-15 y se descartó por precio: obliga a
generar ids, a una pasada sobre las plantillas existentes, y a decidir qué hacer con los
ejercicios que ya existen sin id.

**Por qué no corre prisa:** renombrar un ejercicio es raro, el daño es que un dato vuelve
a su valor por defecto, y se nota en el acto al abrir la pantalla.

**Segundo detalle del mismo diseño:** dos ejercicios con el mismo nombre dentro de una
misma rutina comparten peso propio, porque comparten clave. Si alguna vez hace falta
distinguirlos (una serie de calentamiento y otra pesada del mismo movimiento), la salida
es la misma de arriba.

---

---

## 23. `avisosFalta` deniega la lectura mientras el documento no existe — ✅ HECHO (2026-09-16)

**Detectado:** 2026-09-15, verificando U1 en la página de una clienta de pruebas.

La consola de la página tira un error en cada carga, antes de que la clienta avise:

```
@firebase/firestore: Uncaught Error in snapshot listener:
FirebaseError: [code=permission-denied]: Missing or insufficient permissions.
```

**La causa.** `firestore.rules` protege la colección así:

```
match /avisosFalta/{doc} {
  allow read: if esEntrenador() ||
                 resource.data.clienteId == request.auth.token.clienteId;
}
```

y `observarAvisoFalta` escucha `avisosFalta/{clienteId}_{hoy}`, un documento que **no existe
hasta que la clienta avisa**. Con el documento ausente `resource` es `null`, así que
`resource.data.clienteId` no se puede evaluar y la lectura se deniega. Es la trampa clásica de
las reglas de Firestore: una regla que mira `resource.data` no deja leer lo que no existe.

**Qué rompe, medido y no supuesto.** Menos de lo que parece, y conviene dejarlo escrito para
que nadie lo persiga como si fuera urgente:

- El botón **sí** se esconde tras avisar, y **sigue escondido al recargar**: verificado el
  2026-09-15 en la clienta de pruebas. Para entonces el documento ya existe y la lectura pasa.
- Lo que se pierde es el listener de **esa** carga: muere al primer error. Si la clienta tiene
  la página abierta y avisa desde otro dispositivo, esta pestaña no se entera hasta recargar —
  justo el caso que el comentario de la regla dice querer cubrir.
- Y el ruido: un `permission-denied` en consola en cada visita de cada clienta que todavía no
  ha avisado, o sea casi todas, casi siempre. Eso es lo peor de la entrada, porque **tapa
  errores de verdad**: cualquiera que abra la consola a diagnosticar otra cosa se encuentra
  esto primero.

**El arreglo.** Autorizar por el id del documento, que ya lleva dentro el `clienteId`, en vez
de por el contenido:

```
match /avisosFalta/{doc} {
  allow read: if esEntrenador() ||
                 doc.split('_')[0] == request.auth.token.clienteId;
}
```

Funciona con el documento ausente porque no toca `resource`. Los ids de cliente son
autogenerados por Firestore (alfanuméricos, sin guión bajo), así que partir por `_` es seguro.

**No vale** relajarlo a `resource == null`: dejaría que cualquier sesión comprobara la
existencia de los avisos de cualquier otra clienta probando ids.

**Por qué no corre prisa:** nadie ve nada roto. Pero es un cambio de tres líneas en las reglas
y requiere `firebase deploy --only firestore:rules`, que hasta hoy esta feature no ha tocado.

**Hecho el 2026-09-16**, con la regla tal como estaba escrita arriba, desplegada con
`firebase deploy --only firestore:rules`. Dejó de "no correr prisa" de golpe: ese mismo día se
hicieron visibles los fallos de los listeners en la página, y el `permission-denied` que hasta
entonces era ruido en consola pasó a llevarse la pantalla entera de la clienta, con un código
que ella no podía resolver. Commit `cd61093`.

---

---

## 24. Un icono en Clientes para ver quién cambió su rutina

**Pedido:** 2026-09-16, por el entrenador. En sus palabras:

> agregar un icono en la pantalla de Clientes que me permita identificar cuando un cliente
> cambio su rutina

**Precisado el mismo día**, preguntando qué contaba como "cambió su rutina":

> me refiero a que cambie su rutina desde la web, exactamente como lo que hace 🔄 Cambió su
> día: <motivo>" de Tomar Asistencia. pero desde la pantalla de Clientes

O sea `cambiosDia` —lo que la clienta hace desde su página—, y no el entrenador despegándola
de su plantilla. El indicador ya existe y se dibuja en Tomar Asistencia; lo que falta es el
mismo hecho visible en Clientes.

**Lo que queda por decidir:** cuánto dura. El de Tomar Asistencia solo se dibuja el día del
cambio, igual que el amarillo del aviso de falta, y esa ventana es la que hace que hoy solo se
vea si el entrenador entra a esa pantalla ese día. Si en Clientes se quiere lo mismo, la regla
ya está escrita y solo hay que reusarla.

---

## 25. Lo que quedó pendiente de la ruleta

**Detectado:** 2026-09-18, al terminar la rama `feature/ruleta-revivir-racha`.

La feature "ruleta para revivir la racha" está implementada entera: cuando a una clienta se le
acaban sus 3 revives del mes y tiene la racha rota, apuesta a uno de dos colores; si acierta se
le revive, si falla el mes siguiente tendrá 2 revives en vez de 3. El sorteo vive solo en la
Cloud Function `jugarRuleta`, que escribe un documento por clienta y mes en `ruletas` con id
`{clienteId}_{AAAA-MM}`. Spec en
`docs/superpowers/specs/2026-09-18-ruleta-revivir-racha-design.md`, plan en
`docs/superpowers/plans/2026-09-18-ruleta-revivir-racha.md`.

**Verificado, y sólo esto:** las tres suites en verde — web 154/154, functions 35/35,
`./gradlew test` OK. *(Tras mezclar `main` el 2026-09-21 son 184/184 y 37/37; los de más son
de main, no de la ruleta.)* **No verificado, y es todo lo demás:** no se ha desplegado, no se ha
mezclado a `main`, y no se ha tocado con los ojos ni en el emulador ni en un teléfono real.

### 1. El recorrido manual, que nadie ha hecho

El propio plan lo exige antes de mezclar a `main`, porque todas las clientas tienen su página
funcionando hoy. Lo que falta ver:

- Que el puntero quede dentro del sector del color que nombra el acuse, varias tiradas
  seguidas, ganando y perdiendo (se puede forzar fijando la probabilidad a 1 y a 0 en el
  emulador).
- Encadenar una tirada de prueba con la real: el giro libre de la real tiene que verse como
  una rotación pareja, no como un bamboleo.
- Que "Jugar" esté muerto mientras gira una tirada de prueba, mirando la pestaña de Red para
  confirmar que no sale ninguna llamada.
- Que nada cierre el modal mientras la ruleta gira: el fondo, `Escape`, el botón atrás de
  Android.
- Que la rueda sobreviva a un snapshot ajeno: con la tirada girando, marcarle una asistencia a
  la clienta desde la app del entrenador.
- Que la rueda no brinque al aparecer el acuse.
- Con "reducir movimiento" activado: sin giro, y el resultado en un fundido corto.
- Los cinco estados de la tarjeta, y sobre todo el de cupo disponible, que tiene que verse
  idéntico a como está hoy en producción.
- El mes castigado punta a punta: que la web diga "Te quedan 2 este mes (perdiste la ruleta
  el mes pasado)" y que la app del entrenador diga "Revives: 2 de 2" con el motivo, para la
  misma clienta y el mismo mes; y que borrar el documento de la ruleta devuelva el cupo a 3 en
  los dos lados sin tocar nada más.
- El cruce de medianoche con el detalle de una clienta abierto en el teléfono del entrenador:
  "Revives: X de Y" tiene que cambiar de mes sin recargar.
- El modal en pantalla pequeña y con el texto del sistema agrandado: la ✕ tiene que seguir
  alcanzable, porque es la única salida.
- Dos toques simultáneos desde dos teléfonos con la misma sesión: solo una tirada registrada,
  y el segundo leyendo "Ya jugaste tu tirada de este mes".

### 2. El orden del despliegue, que importa

Las reglas de Firestore y la función van antes que el bundle de la web. Si el bundle sale
primero, los dos `observarTirada` chocan con `permission-denied` hasta que las reglas estén
arriba: degrada sin romper nada (los listeners mueren, la tirada se queda en `null` y el cupo
se comporta como hoy), pero llena la consola de errores — exactamente el ruido que describe la
entrada 23. Y una clienta podría tocar "Leer propuesta" contra una función que todavía no
existe.

### 3. `aplicarTirada` escribe sin transacción, y el spec sí pedía una

En `functions/src/jugarRuleta.ts`, la tirada se registra con `create()` y la justificación de
la falta se escribe después, en dos operaciones sueltas. El orden está pensado a propósito (la
tirada primero, para que una falla no deje premio con tirada intacta), pero si la segunda
escritura falla —timeout, `UNAVAILABLE`, contención— la clienta queda con la tirada del mes
gastada, un documento que dice `gano: true`, y la racha sin revivir; al reintentar recibe "Ya
jugaste tu tirada de este mes" y no puede arreglarlo desde la página. La ventana es de
milisegundos y el entrenador puede justificar la falta a mano, por eso se dejó pasar antes del
despliegue; arreglarlo obliga a reestructurar `aplicarTirada`, que hoy está limpia y bien
probada.

### 4. Cuatro detalles de pulido que no afectan al número ni a la apuesta

- La tirada de prueba no tiene fase de giro libre: `girarLibre` y `frenar` se llaman en el
  mismo tick, así que entra directo al frenado mientras la real arranca con 800 ms de rotación
  pareja. El spec decía "misma animación", y el ensayo existe justo para que la real no
  sorprenda.
- La app del entrenador dice "(perdió la ruleta en 2026-08)" donde el spec escribía "(perdió
  la ruleta en agosto)".
- El test de `web/src/ui/ruletaGiro.test.ts` reimplementa a mano el margen de 10°, el
  `conic-gradient` y la posición del puntero en vez de leerlos, así que si alguien invierte
  los colores del gradiente o mueve el puntero, el test seguiría verde. Se dejó así a
  propósito: exportar constantes internas solo para el test sería peor.
- En la fase `"error"` tras un `already-exists` ("Ya jugaste tu tirada de este mes"), el botón
  "Jugar" sigue habilitado e invita a una apuesta que fallará siempre.

---

## 26. El acuse de la ruleta nombraba un color que la clienta no ve — ✅ HECHO (2026-09-22)

**Detectado:** 2026-09-22, en el primer recorrido con la ruleta en pantalla.

La clienta de pruebas tiene paleta turquesa. La rueda salió turquesa y ámbar, el puntero cayó
en el sector turquesa —correcto— y el texto dijo **"Cayó en morado"**.

`web/src/ui/ruleta.ts` tenía los nombres escritos a mano:

```ts
const NOMBRE: Record<Color, string> = { primario: "morado", ambar: "ámbar" };
```

Pero la ficha y el sector son `var(--primario)`: la paleta por clienta de la entrada 7. O sea
que "morado" sólo acierta con `porDefectoWeb`, y **con cualquier otra paleta la clienta lee un
color que no tiene delante, justo en la frase que le dice si ganó o perdió**. No era sólo el
`aria-label`: el mismo mapa alimentaba las tres frases visibles — ganar, perder y ensayar.

**Por qué se escapó:** ningún test tocaba esos textos. Y encaja con lo que la entrada 25 §4 ya
avisaba de `ruletaGiro.test.ts`, que reimplementa el gradiente a mano en vez de leerlo: los
colores de este modal no los estaba mirando nadie.

**Arreglado sin nombrar el tono.** El primario pasa a ser "tu color"; el ámbar, que no sale de
la paleta, se sigue nombrando. Son dos formas —`cayo` y `apuesta`— porque las dos frases piden
gramática distinta ("Cayó en ___" y "Apostar ___"), y unificarlas en una sola cadena deja una
de las dos mal escrita. Hay un test que lo dice, para que nadie lo "simplifique".

Tres tests nuevos en `web/src/ui/ruleta.test.ts`, **comprobados fallando contra el código
viejo** antes de darlos por buenos. Suite 187/187 y `npm run build` limpio.

**No está desplegado:** el canal de preview sigue sirviendo el bundle que dice "morado".

---

## 27. La ✕ de la ruleta mide 27×26, y es la única salida del modal

**Detectado:** 2026-09-22, en el recorrido.

A 320×568 con la raíz a 24 px la ✕ queda dentro del viewport y no provoca scroll horizontal,
así que el punto "la ✕ tiene que seguir alcanzable" de la entrada 25 §1 **pasa**. Pero mide
**27×26 px**, por debajo del mínimo de 44×44 — que las fichas de color del mismo modal **sí**
respetan. O sea que el código ya conoce la regla y la ✕ es la que se sale de ella.

**Por qué no corre prisa:** fallar el toque no rompe ni pierde nada, el modal sigue ahí. Pero
es la única salida a propósito —ni `Escape` ni el fondo lo cierran— así que en un teléfono
pequeño una clienta con dedos grandes se queda peleando con la propuesta hasta acertar.

**Qué hacer:** subir el área táctil a 44×44 sin agrandar el glifo, con padding o un `::before`
transparente. No obliga a rediseñar nada.

---

## 28. La ruleta se ve pobre: hacerla realista, o pixel art

**Pedido:** 2026-09-22, al verla girar por primera vez.

Hoy la rueda es lo mínimo que funciona: un `div` de 200×200 con
`conic-gradient(var(--primario) 0deg 180deg, var(--ambar) 180deg 360deg)`, un puntero fijo a
las 12 y `rotate()` para girar. Dos medias tartas planas. Se entiende, pero no parece una
ruleta: parece un gráfico de sectores.

**Lo primero que hay que decidir es cuál de las dos**, porque tiran en direcciones opuestas y
empezar sin elegir es trabajo tirado:

- **Realista.** Aro metálico, bisel, sombra proyectada, separadores entre sectores, quizá un
  reflejo que no gire con la rueda. Pide salir del `conic-gradient` a SVG o canvas.
- **Pixel art.** Rueda de baja resolución, bordes dentados a propósito, paleta reducida, y
  **rotación a saltos** (`steps()`) en vez de continua, que es lo que hace que se lea como
  pixel art y no como un PNG girando borroso.

**Por qué no corre prisa:** es puro aspecto. El sorteo vive en `jugarRuleta`, en el servidor, y
no se entera de cómo se pinte la rueda.

### Tres cosas que hay que respetar, y una de ellas no tiene red

**El mapa de ángulos es un contrato con `ruletaGiro.ts`.** Ese módulo calcula el aterrizaje
dando por hecho que `primario` ocupa de 0° a 180° y `ambar` de 180° a 360°, medidos desde las
12 en horario. Si el rediseño reordena o reparte distinto los sectores, hay que cambiar los
dos a la vez.

**Y ahí no hay red:** la entrada 25 §4 ya avisa de que `ruletaGiro.test.ts` **reimplementa a
mano** el margen, el `conic-gradient` y la posición del puntero en vez de leerlos. O sea que
invertir los colores del gradiente dejaría el test en verde y al puntero señalando el color
contrario al que anuncia el acuse — exactamente el fallo que la entrada 26 acaba de destapar
por otra vía. Quien toque el dibujo arregla ese test primero, o lo comprueba con los ojos.

**La rueda se dibuja 50/50 aunque el sorteo no lo sea** (está en el spec). Realista invita a
meter más sectores; hacerlo rompe esa decisión y hay que ir al spec antes, no después.

**`prefers-reduced-motion` tiene que seguir cumpliendo.** Hoy da el resultado en 330 ms sin
girar, contra 4136 ms del modo normal (verificado el 2026-09-22). Pixel art con `steps()` es
justo el caso en que es fácil dejarse un `animation` suelto que se salte la regla.

**Y no tocar la paleta.** El sector primario es `var(--primario)`, el color de cada clienta.
Un rediseño que fije los colores a mano vuelve a meter el fallo de la entrada 26.

---
