# Calendario-Rutina como fuente de verdad del día de rutina

Fecha: 2026-09-02
Estado: aprobado, pendiente de implementar

## Problema

Hoy el día que le toca a un cliente vive en tres campos de `Cliente`
(`diaActualIndex`, `diaPendienteIndex`, `diaPendienteFecha`) que se escriben desde
tres sitios distintos: marcar asistencia, corregir el día en la pestaña Rutina, y
"Asignar día". Ninguno es la autoridad, así que se descuadran entre sí.

Bugs concretos que salieron de ahí:

1. Iniciar el cronómetro marcaba asistencia pero no registraba el día de rutina, y
   el cliente aparecía como "Sin registrar". (Corregido en `d8a94c3`.)
2. Escribir un pendiente con la fecha de hoy desactivaba el override de
   `diaEfectivo`, que caía de vuelta a un `diaActualIndex` viejo: el día efectivo
   saltaba hacia atrás. (Corregido en `abd2db4`.)
3. Como "Asignar día" limpia el pendiente, corregir después un registro viejo
   vuelve a escribirlo y pisa la asignación manual en silencio. (Documentado en
   `CorregirDiaRealizadoTest`, sin corregir.)
4. Asignar un día después de guardar la asistencia deja el registro diciendo un día
   y al cliente en otro. (Documentado en `AsignarDiaInteraccionTest`, sin corregir.)

Los tres primeros son síntomas del mismo defecto: un caché con varios escritores y
ningún dueño.

## Regla

El historial de asistencias es la ley. El día que le toca a un cliente **se deduce**,
no se guarda:

```
díaQueToca(cliente, asistencias, hoy):
    última = la asistencia más reciente del cliente tal que
                 asistió, tiene díaRutinaRealizado, y  ancla < fecha ≤ hoy

    si no hay última  ->  día del ancla
    si última.fecha == hoy  ->  última.díaRutinaRealizado   (lo está haciendo hoy)
    si no  ->  (última.díaRutinaRealizado + 1) mod totalDías
```

Las faltas guardan `diaRutinaRealizado = null`, así que quedan fuera del filtro por
construcción: faltar no avanza el ciclo, sin necesitar una regla aparte.

## El ancla

"Asignar día" sigue existiendo como corrección manual, y es lo único que puede
contradecir al historial. Se guarda como un ancla con fecha:

- `Cliente.diaActualIndex` — el día asignado (se conserva el nombre del campo).
- `Cliente.diaAnclaFecha` — **campo nuevo**, la fecha en que se asignó.

El ancla **corta el historial**: solo cuentan las asistencias con
`fecha > diaAnclaFecha`, estrictamente posteriores. Eso arregla el bug 3: un registro
anterior o del mismo día que el ancla ya no puede pisar la asignación.

**"Asignar día" no toca ningún registro de asistencia.** Cambia el día que le toca al
cliente de aquí en adelante, y Calendario-Rutina no se entera hasta que el cliente
tenga una asistencia nueva; en ese momento el registro se crea con el día anclado y el
historial vuelve a mandar.

La dirección contraria sí propaga: corregir el día desde Calendario-Rutina cambia lo
que muestra la pestaña de Cliente, porque el día se deduce del registro.

Esto reemplaza al bug 4: el registro y el cliente pueden decir cosas distintas, pero ya
no es una desincronización accidental sino la semántica buscada — el registro es
historia (qué hizo ese día) y el ancla es intención (qué le toca ahora).

## Campos que se retiran

`diaPendienteIndex` y `diaPendienteFecha` dejan de escribirse. Con ellos desaparece
la clase de bug entera: ya no hay un caché que pueda quedar viejo.

No se borran del modelo todavía, porque la migración los necesita para leer el estado
congelado (ver abajo). Quedan como campos de solo lectura y marcados como obsoletos.

## Migración: congelar, no recalcular

Decisión tomada: **nadie debe ver cambiar su día al actualizar la app.**

Los clientes que ya existen no tienen `diaAnclaFecha`. Para ellos:

- `anclaFecha` = `FECHA_CORTE` (`2026-09-01`), el día anterior a este cambio.
- `anclaDía`  = la fórmula vieja `diaEfectivo(...)` evaluada **en el día siguiente a
  `FECHA_CORTE`**, no en la fecha de hoy.

Evaluarla en una fecha fija la congela: el resultado no se mueve según pase el tiempo,
y como después de este cambio nadie vuelve a escribir los campos pendientes, el valor
queda estable para siempre.

Las dos fechas están desplazadas un día a propósito, para que ningún registro se cuente
dos veces ni se pierda:

- Un pendiente con fecha ≤ `FECHA_CORTE` ya venció al evaluar en el día siguiente, así
  que va incluido en `anclaDía`; su registro queda fuera del filtro (`fecha > ancla` es
  falso). Contado una vez.
- Un registro posterior a `FECHA_CORTE` no entra en `anclaDía` (su pendiente aún no
  había vencido en esa fecha) pero sí pasa el filtro. Contado una vez.

Esto no requiere ninguna escritura de migración sobre Firestore.

Contrapartida aceptada: los desvíos que el bug 2 ya dejó guardados **no se reparan
solos**. Un cliente que quedó en el día equivocado sigue igual hasta que se corrija a
mano con "Asignar día". Se eligió esto sobre recalcular desde el historial completo
para que la actualización no mueva días de forma visible ni dependa de que los
registros viejos tengan bien el `diaRutinaRealizado`.

## Dónde se lee

Los tres sitios que muestran el día necesitan el historial del cliente. Dos ya lo
cargan:

| Pantalla | Historial | Nota |
|---|---|---|
| Clientes (lista) | ya carga `observarTodasAsistencias()` para las rachas | reutilizar |
| Detalle de cliente | ya carga `observarAsistenciasPorCliente()` para la racha | reutilizar |
| Tomar asistencia | solo carga la fecha abierta | **hay que añadir el historial** |
| Sandbox | en memoria | trivial |

## Escrituras que se simplifican

`registrarAsistencia` e `iniciarTiempo` dejan de tocar al cliente: solo escriben el
registro de asistencia. Se acaba el batch cruzado entre las colecciones `asistencias`
y `clientes`, y con él la posibilidad de que las dos queden desincronizadas.

`guardarCambiosDia` (corregir el día en la pestaña Rutina) solo actualiza el registro.
Desaparece `debeActualizarPendiente`, que existía únicamente para proteger el caché.

`reiniciarDia` solo borra los registros del día; ya no necesita deshacer pendientes.

## Verificación

- Los tests existentes de secuencia (`AvanceDiaSecuenciaTest`,
  `AsignarDiaInteraccionTest`, `CorregirDiaRealizadoTest`) se reescriben contra la
  regla nueva y deben seguir cubriendo los mismos escenarios.
- Tests nuevos para: el ancla cortando el historial, la congelación en `FECHA_CORTE`,
  y que un cliente sin historial ni ancla cae al día 0.
- Verificación en dispositivo con la pantalla Sandbox antes de dar por bueno el cambio.
