# Registrar cardio (web del cliente)

## Contexto y objetivo

Registro sirve para las pesas: series con peso y reps. Las clientas también hacen cardio en
las máquinas del gimnasio y no tenían dónde anotarlo. Este cambio agrega un apartado para
registrar el cardio: en qué máquina, cuántos minutos y, si quieren, la inclinación y la velocidad.

**Decisiones tomadas (entrenador, 2026-10-20), entre tres maquetas:**

- **Botón propio en Registro** (maqueta "B"): debajo de "Iniciar entrenamiento", un botón
  **"🏃 Registrar cardio"** → pantalla **"¿En qué hiciste cardio?"** con las cuatro máquinas en
  grande → los datos → "Guardar cardio".
  - **Sin entrenamiento abierto**, el cardio se guarda solo, como un entrenamiento propio: sirve
    para quien solo fue a hacer cardio, y cuenta en "Tu semana" y en su asistencia como cualquier
    entrenamiento.
  - **Con un entrenamiento abierto**, se agrega a ese y se regresa a él.
  - **Con un entrenamiento ya guardado ese día** (pedido del entrenador, el mismo 2026-10-20), se
    agrega a ese en vez de crear otro: se reenvía por la cola con el mismo id, su día, sus horas y
    su origen, y el servidor lo reescribe (`registrarSesion` guarda con `set`). Termina a la hora
    del cardio. Si espera en la cola, se agrega al de la cola. Si ya traía esa máquina, se suman
    los minutos. Si trae un ejercicio que ya no está en el banco, el cardio va solo, porque el
    servidor rechazaría el entrenamiento entero.
- **Las máquinas:** caminadora, escaladora, elíptica y bicicleta, con sus animaciones de Gym
  visual (`3666`, `2311`, `2141`, `0798`).
- **Los datos:** **minutos** (obligatorio), **inclinación** y **velocidad** (opcionales). La
  inclinación solo se pide en la caminadora y la elíptica, las únicas que la tienen; la
  velocidad, en todas (en la caminadora en km/h; en las otras, el número que marque la máquina).

**Fuera de alcance:** distancia y calorías (el entrenador eligió no pedirlas), cardio en la app
del entrenador, metas de cardio y cardio fuera del gimnasio.

## Datos

Un tipo nuevo de ejercicio en el banco, **`cardio`**, con las cuatro máquinas en el grupo
`cardio`. Se guarda como los de tiempo, que ya existen: **una sola serie** con `reps` = minutos y
`peso` en null, más dos campos opcionales de la serie:

```ts
{ ejercicioId: "caminadora", series: [{ reps: 25, peso: null, inclinacion: 8, velocidad: 5.5 }] }
```

Así todo lo que ya lee sesiones sigue funcionando sin cambios: la fuerza ignora lo que no tiene
estándares, el historial y "Tu semana" cuentan una serie, y Estadísticas lo trata aparte.

- `registrarSesion` (y `editarSesion`, que usa la misma validación) acepta el tipo `cardio`:
  exactamente una serie, minutos enteros de 1 a 300, sin peso ni bajadas, inclinación de 0 a 30 y
  velocidad de 0 a 40 (números, con decimales).
- Las máquinas no llevan músculos principales (no pintan el mapa ni salen en Estadísticas como
  músculo); sí secundarios, para el resumen.
- El cardio solo, sin entrenamiento abierto, se manda por la cola (`cola.ts`) como un
  entrenamiento terminado: `iniciadaEn` = ahora − minutos, `terminadaEn` = ahora. Sin internet o
  con el modo sin datos se manda después.

## Pantallas (`web/src/ui/registro.ts`)

1. **Inicio de Registro:** el botón "🏃 Registrar cardio" debajo de "Iniciar entrenamiento" (o de
   "Continuar entrenamiento"). "Tu semana" suma además los minutos de cardio.
2. **"¿En qué hiciste cardio?":** las cuatro máquinas en cuadrícula de 2 × 2 con su animación.
3. **La máquina:** su animación chica y "Anota lo que marca la pantalla de la máquina"; los campos
   en renglones (etiqueta a la izquierda, número a la derecha); "Guardar cardio". Si faltan los
   minutos, se reclama como cualquier otro campo.
4. **Después de guardar:** sin entrenamiento abierto, regresa al inicio de Registro con "🏃 Cardio
   guardado: Caminadora, 25 min"; con uno abierto, regresa a él con la máquina agregada.
5. **Dentro de un entrenamiento**, el cardio se ve y se corrige con los mismos tres campos en vez
   de la tabla de series. Las máquinas también salen en la sección Cardio de "¿Qué ejercicio
   hiciste?", como cualquier ejercicio.
6. **Historial:** "25 min · inclinación 8 · 5.5 km/h".

## Estadísticas

Una máquina de cardio se ve como un ejercicio con sus propios datos clave: veces, minutos totales,
sesión más larga y velocidad máxima; la gráfica muestra los minutos de cada día.
