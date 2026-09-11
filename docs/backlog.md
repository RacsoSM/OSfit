# Backlog

Cosas detectadas que **no** son urgentes y que no bloquean el flujo principal. Cada entrada
dice qué pasa, por qué no corre prisa, y qué habría que hacer. Se revisa cuando haya hueco,
no en mitad de otra cosa.

Convención: una entrada se borra de aquí cuando se arregla, y el arreglo se explica en el
commit — no se marca "hecho" y se deja.

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
