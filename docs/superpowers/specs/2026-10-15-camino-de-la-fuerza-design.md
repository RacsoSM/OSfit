# El camino de la Fuerza (web del cliente)

Backlog 2, punto 13.

## Contexto y objetivo

En Músculos la clienta ya ve su rango por músculo y, al tocar uno, "te faltan X kg para el
siguiente rango" (`siguienteRango` en `web/src/fuerza.ts`). Eso da un solo objetivo, lejano:
un rango entero puede tardar semanas.

**El camino de la Fuerza** convierte ese avance en un camino vertical de paradas, como el de
Duolingo: las cumplidas, la actual resaltada y las siguientes bloqueadas, hasta Élite. Cada
parada es un objetivo concreto y alcanzable en el próximo entrenamiento ("Press de banca:
27.5 kg × 9"), calculado con sus pesos máximos registrados.

**Decisiones tomadas (entrenador, 2026-10-15):**

- **Un camino por músculo, uno a la vez.** Arriba, una franja "Hoy" con una mini tarjeta por
  cada músculo de su día (2 o 3) y su parada actual; abajo, el camino completo del elegido.
  No van caminos lado a lado: en un teléfono no caben los objetivos escritos.
- **Las paradas salen del ejercicio de su mejor marca** en ese músculo, automático (el mismo
  que hoy da el "te faltan X kg"). Si con otro ejercicio llega más lejos, el camino sigue con ese.
- **Escalones chicos con doble progresión:** primero +1 rep hasta el tope del rango, luego
  sube el peso y regresa al inicio del rango. Los cambios de rango son paradas especiales con
  su insignia.
- **Incrementos del gimnasio:** barra y mancuernas de 2.5 kg (las mancuernas van de 2.5 a
  37.5 kg); máquinas y poleas de 4.5 kg.
- **Rango de reps:** 8–12 en general; pantorrilla y abdomen, 12–20.
- **Se ve todo el camino hasta Élite**, con la vista centrada en la parada actual.
- **Vive en una tarjeta en Inicio** con la parada actual de los músculos de su día de hoy; al
  tocarla se abre el camino completo.
- **Al cumplir una parada:** sale en el resumen al terminar el entrenamiento ("¡Parada
  cumplida!"), y al abrir el camino la parada se marca y la siguiente se desbloquea con una
  animación. Sin aviso al entrenador ni medalla (por ahora).
- **Lo cumplido no se pierde.** Si deja de entrenar y su rango en Músculos baja (ventana de 8
  semanas), el camino no retrocede. Para eso el servidor guarda sus mejores marcas de siempre.

**Fuera de alcance (por ahora):** aviso al entrenador, medallas por parada, que la clienta
elija el ejercicio de cada músculo, caminos por ejercicio y un camino general mezclado.

## Las paradas

### El ejercicio de cada músculo

Para cada músculo se toma, entre los ejercicios donde ese músculo es **principal**
(`musculos[m] === 1`, la misma regla de "primero los directos" del mapa), el que da el nivel
más alto con su **mejor marca de siempre** (no la de 8 semanas). Usar la de siempre evita que
el camino cambie de ejercicio solo porque una marca vieja salió de la ventana.

### Doble progresión

Las paradas de un ejercicio de peso son la escalera:

```
(p, 8) → (p, 9) → (p, 10) → (p, 11) → (p, 12) → (p + Δ, 8) → (p + Δ, 9) → …
```

- **Δ (incremento), por equipo:** barra 2.5 kg; mancuernas 2.5 kg por mancuerna; máquina y
  polea 4.5 kg. Van como constantes por equipo, para cambiarlas sin tocar el resto.
- **Tope de las mancuernas: 37.5 kg.** Al llegar a 37.5 kg × tope de reps el camino de ese
  ejercicio termina con "Llegaste a las mancuernas más pesadas del gimnasio": más reps ya no
  suben el nivel (`unoRm` topa en 12). Si para entonces ese músculo tiene una marca mejor con
  otro ejercicio, el camino sigue con ese.
- **Rango de reps:** 8–12 en general; **12–20 en pantorrilla y abdomen** (según el músculo
  del camino). Ojo: `unoRm` no cuenta más de 12 reps, así que entre 12 y 20 las paradas suben
  de reps sin subir el nivel; el nivel sube solo al pasar al siguiente peso. Es lo esperado:
  la parada de rango cae en un cambio de peso.
- **Inicio de la escalera (`p₀`):** el peso de su primera marca en ese ejercicio, redondeado
  hacia abajo al múltiplo de Δ. Se guarda (ver Datos) para que la escalera no se mueva.
- **Ejercicios corporales:** solo reps, +1 por parada, desde su primera marca hasta las reps
  que pide Élite.

### Cuándo está cumplida una parada

Una parada `(p, r)` está cumplida si **alguna vez** hizo una serie de ese ejercicio con
**peso ≥ p y reps ≥ r**. Es una comparación directa, no por 1RM estimado: en la escalera,
`(p, 12)` puede pesar más en 1RM que `(p + Δ, 8)`, así que ordenar por 1RM rompería el orden.

La **parada actual** es la primera no cumplida de la escalera. Las anteriores se ven
cumplidas aunque haya saltado alguna: si pasó directo de 20 × 8 a 22.5 × 10, se marcan como
cumplidas 20 × 9 hasta 22.5 × 10.

### Paradas de rango

Cada parada se convierte a nivel con el cálculo de siempre (`unoRm`, peso corporal, ajuste
por grasa y edad, estándares del ejercicio). La **primera parada cuyo nivel alcanza un rango**
(Ascenso, En forma, … Élite) es parada de rango: lleva la insignia y el nombre del rango. El
camino termina en la parada que alcanza Élite.

Como el nivel depende del peso corporal actual, si cambia su peso las paradas de rango se
mueven de lugar; las paradas en sí (peso × reps) no cambian.

### Sin datos

- **Músculo sin marcas:** en lugar del camino, "Registra un ejercicio de {músculo} para
  empezar tu camino", con los ejercicios del banco que lo trabajan como principal (los de su
  rutina primero).
- **Sin peso corporal o sin sexo:** lo mismo que en Músculos (pide completar el perfil o el
  peso), porque sin ellos no hay paradas de rango.

## Dónde se ve

### Los músculos de hoy

Los **músculos principales** (`musculos[m] === 1`) de los ejercicios de su rutina para hoy, el
mismo día que pinta la tarjeta del día, en el orden en que aparecen en la rutina y sin
repetir. Normalmente son 2 o 3. Un día de descanso o sin rutina, no hay "Hoy" y se usa su
músculo más avanzado en su lugar, para que nada se quede vacío.

### Tarjeta en Inicio

"El camino de la Fuerza", debajo de la tarjeta del día: la misma franja "Hoy" que la ventana,
una fila por músculo con su parada actual:

```
El camino de la Fuerza
  Pecho   · Press de banca      27.5 kg × 9
  Tríceps · Extensión en polea  15 kg × 11
                                   Ver mi camino ›
```

Tocar una fila abre el camino en ese músculo; "Ver mi camino" lo abre en el primero.

### Ventana "El camino de la Fuerza"

Subventana de Inicio (`PADRE: { camino: "inicio" }`, con la flecha fija de atrás como Amigos).

```
 ←  El camino de la Fuerza

 HOY
 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │ Pecho  ● │ │ Tríceps  │ │ Hombro   │
 │ 27.5 × 9 │ │ 15 × 11  │ │ 9 × 10   │
 └──────────┘ └──────────┘ └──────────┘
 Otros: Bíceps · Espalda · Pierna · …

        ✅ 25 × 12
           │
        ⭐ 27.5 × 9   ← ahora
           │
        🔒 27.5 × 10
```

- **Franja "Hoy":** una mini tarjeta por músculo de hoy, con su parada actual y el color de
  su rango; la elegida va marcada. Tocar otra cambia de camino.
- **"Otros":** los demás músculos con camino (o sin marcas, para empezar), en una fila más
  chica que se desplaza a lo ancho.
- **Deslizar a los lados** sobre el camino pasa al músculo siguiente o anterior de la franja
  "Hoy" (y después de "Otros").
- **El camino:** vertical, con nodos en zigzag suave como Duolingo, unidos por una línea.
  - Cumplida: nodo lleno con ✓.
  - Actual: nodo grande, resaltado, con el objetivo escrito y el ejercicio ("Press de banca ·
    27.5 kg × 9").
  - Bloqueada: nodo apagado con candado y su objetivo en gris.
  - De rango: nodo con la insignia del rango (`insigniaRango`) y su nombre.
- Al abrir o cambiar de músculo, se desplaza solo hasta la parada actual.
- Con decenas de paradas por músculo (por ejemplo, de 20 a 100 kg son ~160), se dibujan
  todas en HTML simple: no hace falta virtualizar a este tamaño.
- Tiene que verse bien en todos los estilos de la web (neón, cómic, pixel, sakura,
  minimalista, halloween): colores de los tokens de cada estilo, sin colores fijos.

### Celebración

- **Resumen al terminar** (Registro y guiado): una sección "¡Parada cumplida!" por cada
  músculo que avanzó, con cuántas paradas subió y la nueva parada actual ("Pecho: +2 paradas.
  Siguiente: 27.5 kg × 10"). Se calcula comparando las marcas antes y después del
  entrenamiento, como ya se hace con los cambios de rango (`armarResumen`).
- **Al abrir el camino:** la web recuerda por músculo la última parada actual que vio
  (`localStorage`, por teléfono). Si ahora va más adelante, las nuevas cumplidas se marcan con
  una animación corta y el nodo actual "se desbloquea". Si `localStorage` falla, simplemente
  no hay animación.

## Datos

### Equipo en el banco: `ejercicios/{id}.equipo` (campo nuevo)

Hoy el banco no dice si un ejercicio es de barra, mancuerna, máquina o polea, y el
incremento depende de eso. Campo nuevo `equipo: "barra" | "mancuerna" | "maquina" | "polea" |
"corporal"`. Se llena con un script: una primera propuesta por el nombre y el id ("polea",
"máquina", `pesoPorMancuerna`, `tipo: "corporal"`), que el entrenador revisa en una lista
antes de cargarla. Sin `equipo`, se usa 2.5 kg.

### Mejores marcas: `clientes/{cid}/marcas/{ejercicioId}` (nueva)

```
{
  ejercicioId: string,
  inicio: number,            // p₀ de la escalera (kg); 0 en corporales
  frontera: [ { peso: number | null, reps: number, fecha: "AAAA-MM-DD" } ],
  actualizado: Timestamp
}
```

`frontera` son sus series **no superadas** de siempre: las que ninguna otra supera en peso
y reps a la vez. Con eso alcanza para saber qué paradas están cumplidas, y la lista es corta
(unas pocas series por ejercicio). La clienta la lee (para el camino) pero solo la escribe el
servidor, como las sesiones.

Las marcas no pasan por la ventana de 8 semanas: son de siempre. Músculos sigue usando
`fuerzaPorMusculo` con la ventana, sin cambios.

### Quién la escribe

- **`registrarSesion`:** después de guardar la sesión, por cada ejercicio de la sesión mezcla
  sus series en la frontera (y fija `inicio` si es la primera vez). Una lectura y una
  escritura por ejercicio.
- **`editarSesion` y `borrarSesion`:** recalculan desde cero la frontera de los ejercicios
  afectados con todas sus sesiones. Así un peso mal capturado y luego corregido no deja una
  parada cumplida que no es.
- **Respaldo inicial:** un script (`functions/scripts/`) que arma las marcas de todas las
  clientas con sus sesiones existentes, para que el camino arranque con su historia.

### Reglas

```
match /marcas/{doc} {
  allow read: if esEntrenador() || esCliente(cid);
  allow write: if esEntrenador();
}
```

### Código compartido

La lógica de la escalera y las paradas va en un módulo puro nuevo, `web/src/camino.ts`
(escalera, paradas cumplidas, parada actual, paradas de rango), con pruebas. La mezcla de la
frontera va en servidor y web como **gemelos** con prueba de igualdad, igual que
`functions/src/fuerza.ts`.

## Fases

1. **Equipo en el banco:** el campo `equipo` con su script y la revisión del entrenador.
2. **Marcas en el servidor:** colección `marcas`, frontera en `registrarSesion` /
   `editarSesion` / `borrarSesion`, reglas y script de respaldo. Se puede desplegar sola: no
   cambia nada visible.
3. **Cálculo del camino:** `web/src/camino.ts` con pruebas (escalera, cumplidas, actual,
   rangos, corporales, sin datos).
4. **Ventana del camino:** subventana, selector de músculo, nodos, desplazamiento a la actual.
5. **Tarjeta en Inicio.**
6. **Celebración:** sección en el resumen y animación al abrir.

## Preguntas abiertas

Ninguna por ahora: los incrementos, los rangos de reps y cómo se ven varios músculos por día
quedaron decididos (2026-10-15).
