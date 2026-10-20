# Registrar cardio (web del cliente)

## Contexto y objetivo

Registro sirve para las pesas: series con peso y reps. Las clientas también hacen cardio en
las máquinas del gimnasio y no tenían dónde anotarlo. Este cambio agrega un apartado para
registrar el cardio: en qué máquina, cuántos minutos y, si quieren, la inclinación y la velocidad.

**Decisiones tomadas (entrenador, 2026-10-20), entre tres maquetas:**

- **Solo dentro de un entrenamiento** (cambio del entrenador, el mismo 2026-10-20, sobre la
  maqueta "B"): en un entrenamiento abierto, un botón **"🏃 Agregar cardio"** debajo de "+ Agregar
  ejercicio" → pantalla **"¿En qué hiciste cardio?"** (con la flecha de atrás) con las cuatro
  máquinas en grande. Al tocar una, **se agrega como un ejercicio más** y se abre en grande; en
  vez de la tabla de series, su tarjeta pide los minutos, la inclinación y la velocidad. Ya no hay
  "Registrar cardio" fuera de un entrenamiento, ni cardio guardado solo o pegado al entrenamiento
  ya guardado de ese día (lo primero que se hizo, y se quitó).
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

## Pantallas (`web/src/ui/registro.ts`)

1. **En un entrenamiento abierto:** el botón "🏃 Agregar cardio" debajo de "+ Agregar ejercicio"
   (no en la corrección de uno pasado).
2. **"¿En qué hiciste cardio?":** la flecha de atrás (regresa al entrenamiento) y las cuatro
   máquinas en cuadrícula de 2 × 2 con su animación. Cada una usa el mismo `data-agregar` que el
   grid de ejercicios: se agrega igual, con lo de la última vez prellenado.
3. **La tarjeta de la máquina** en el entrenamiento: su animación y sus renglones (etiqueta a la
   izquierda, número a la derecha) en vez de las series. Minutos obligatorio; inclinación (solo
   caminadora y elíptica) y velocidad opcionales. Sin minutos, "Terminar entrenamiento" lo reclama.
4. Las máquinas también salen en la sección Cardio de "¿Qué ejercicio hiciste?".
5. **Historial:** "25 min · inclinación 8 · 5.5 km/h". "Tu semana" suma los minutos de cardio.

## Estadísticas

Una máquina de cardio se ve como un ejercicio con sus propios datos clave: veces, minutos totales,
sesión más larga y velocidad máxima; la gráfica muestra los minutos de cada día.
