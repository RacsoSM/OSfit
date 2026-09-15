# Rutinas en la web

## Contexto y objetivo

Hoy la página del cliente dice **qué día** le toca ("Día 1 · Pecho y espalda") y
nunca **qué ejercicios** hacer. Este diseño agrega los ejercicios, y agrega una
forma de que la rutina de una clienta deje de ser una copia de la plantilla
compartida y pase a ser suya, con **variaciones que rotan solas** dentro de cada
día del ciclo.

El caso que lo origina, en palabras del entrenador: Jaime tiene una rutina de 3
días que se repite —Día 1 pecho y espalda, Día 2 hombro/bíceps/tríceps, Día 3
pierna completa—, pero *no siempre que Jaime haga pecho y espalda va a ver los
mismos ejercicios*: algunos días empieza por espalda, otros por pecho, otros con
ejercicios distintos.

La app Android no cambia de rol: el entrenador sigue siendo el único que escribe.
La clienta sigue leyendo.

## Lo que este spec revierte, a propósito

El spec [2026-09-10-web-clientes-design.md](2026-09-10-web-clientes-design.md)
tiene una sección titulada **"Por qué la página no muestra los ejercicios"** que
avisa literalmente: *"Quien lea este spec más adelante va a ver una tarjeta de
'hoy te toca' sin ejercicios y va a querer 'arreglarla'. No es un bug."* El
motivo era que la entrega de la rutina siguiera siendo un acto del entrenador y
no un autoservicio.

**Esa decisión queda revertida aquí, por decisión explícita del entrenador el
2026-09-15.** No se descubrió un problema con el razonamiento: cambió lo que se
quiere. El aviso de aquel spec cumplió su función —obligó a que esto fuera una
decisión y no un descuido— y deja de aplicar desde este documento. Quien lea
aquel spec debe leer también éste.

Hay un detalle que conviene saber al revertirla: **la restricción nunca fue de
datos, solo de pintado.** `firestore.rules:19` concede `allow read` sobre el
documento completo del cliente, y `web/src/datos.ts` ya declara `Ejercicio`,
`DiaRutina` y `Cliente.rutinaAsignada`. Los ejercicios —y `pesoONota`— **ya
viajan al navegador de la clienta en cada visita**; lo único que los ocultaba era
que `tarjetaDia.ts` no los dibujaba. Cualquiera con DevTools abierto ya los veía.
Eso reduce el trabajo (no hay que tocar reglas para leer la rutina) y quita peso
al argumento de privacidad de la decisión original.

## Alcance

**Se agrega:**

- Los ejercicios del día de hoy en la página de la clienta.
- Un modo **rutina propia** por cliente, alternativo a seguir una plantilla
  compartida.
- **Variaciones por día** dentro de la rutina propia, que rotan solas vuelta a
  vuelta.
- Una tarjeta de rutina dentro de la tarjeta **Web** de la ficha del cliente, que
  muestra la rutina y deja editarla solo para esa persona.

**No se agrega, y es deliberado:**

- La clienta sigue sin poder editar nada de su rutina. Lee.
- La clienta ve **solo el día de hoy**, no los otros días del ciclo.
- Las plantillas compartidas **no** llevan variaciones (ver más abajo).
- La clienta no se entera de que las variaciones existen: no hay etiqueta, no hay
  "Variación B de 3". Solo ve los ejercicios de hoy.

## Las dos fuentes, y cómo se elige

La elección es **por cliente, todo o nada**. Un cliente está en uno de dos modos:

| Modo | De dónde sale la rutina | Variaciones |
|---|---|---|
| **Plantilla compartida** | La plantilla viva de la pestaña Rutinas | No |
| **Rutina propia** | La copia guardada en el documento del cliente | Sí |

### El campo que ya existe para esto

**No se agrega un campo de modo.** `Cliente.plantillaOrigenId` ya discrimina los
dos casos, y meter un booleano aparte crearía dos fuentes de verdad que pueden
contradecirse.

- `plantillaOrigenId` con valor → **plantilla compartida**. Es lo que hace
  [ClienteDetailScreen.kt:188](../../../app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt#L188):
  busca la plantilla viva y usa esa, ignorando la copia congelada, para que los
  ejercicios que se le agreguen a la plantilla lleguen a todos.
- `plantillaOrigenId` vacío → **rutina propia**. La copia en
  `Cliente.rutinaAsignada` pasa a ser la verdad.

Lo bueno de esto es que el `?:` de esa misma línea ya cae a `rutinaAsignada`
cuando no encuentra plantilla, así que **desprenderse es borrar
`plantillaOrigenId`** y el código de lectura ya hace lo correcto.

### Un estado que hoy se confunde y hay que separar

`plantillas.firstOrNull { it.id == plantillaOrigenId }` devuelve `null` en dos
situaciones distintas que hoy se ven igual: el cliente tiene rutina propia, o
**la plantilla que seguía fue borrada**. Con la feature nueva la diferencia
importa, porque la tarjeta tiene que decir de dónde sale lo que muestra. La
tarjeta distingue tres estados:

- `plantillaOrigenId` vacío → "Rutina propia".
- `plantillaOrigenId` con plantilla existente → "Sigue la plantilla «Fuerza 3 días»".
- `plantillaOrigenId` con plantilla inexistente → "⚠ La plantilla que seguía ya no
  existe. Está usando la última copia." Con un botón para convertirla en rutina
  propia y quitar el aviso.

### Desprenderse de la plantilla

Editar los ejercicios de un cliente que sigue una plantilla lo convierte a rutina
propia. **Con aviso antes, no callado**, porque a partir de ahí los cambios de la
plantilla dejan de llegarle y eso no se nota hasta semanas después:

> Jaime va a dejar de seguir la plantilla «Fuerza 3 días». Los cambios que le
> hagas a la plantilla ya no le van a llegar.
> `[Cancelar]` `[Entiendo]`

Al aceptar: se congela la plantilla viva en `rutinaAsignada` (la viva, no la copia
vieja, que puede tener meses) y se borra `plantillaOrigenId`. Nada más. El día del
ciclo no se toca: las variaciones son otra cosa y no deben mover el ciclo.

### Volver a una plantilla destruye la rutina propia

`FirestoreClienteRepository.asignarRutina` sobreescribe `rutinaAsignada` entero y
resetea `diaActualIndex`/`diaAnclaFecha`. Asignarle una plantilla a alguien que
tiene rutina propia **le borra sus variaciones y sus ejercicios personalizados,
sin vuelta atrás**. Hoy no pide confirmación porque no había nada que perder. Con
esta feature sí lo hay, así que la asignación pide confirmación **solo cuando el
cliente está en rutina propia**.

## Variaciones

### Por qué solo en rutina propia

Una plantilla compartida con variaciones obligaría a decidir si Ana y Jaime, en la
misma plantilla, rotan juntos o por separado, y las dos respuestas se defienden.
Dejarlas fuera mantiene la plantilla como lo que es hoy —una lista de ejercicios
por día— y no toca el editor de la pestaña Rutinas en absoluto. Si más adelante se
quieren en plantillas, el modelo de datos de abajo ya lo permite sin cambios.

### Cada día rota por su cuenta

Las variaciones son **por día del ciclo, independientes entre sí**. El Día 1 puede
tener 3, el Día 2 ninguna y el Día 3 dos. Un día sin variaciones se comporta
exactamente como hoy.

### Modelo de datos

```kotlin
data class VariacionDia(
    val ejercicios: List<Ejercicio> = emptyList()
)

data class DiaRutina(
    val nombreDia: String = "",
    val ejercicios: List<Ejercicio> = emptyList(),      // igual que hoy
    val variaciones: List<VariacionDia> = emptyList()   // nuevo
)
```

`VariacionDia` existe **porque Firestore no admite arreglos anidados**: un
`List<List<Ejercicio>>` no se puede guardar. Envolver cada variación en un objeto
la convierte en un arreglo de mapas, que sí.

**Invariante: exactamente una de las dos listas está llena.**

- `variaciones` vacía → manda `ejercicios`. Es el estado de todo lo que existe hoy
  y el de toda plantilla compartida. **Sin migración**: Firestore omite los campos
  que nunca se escribieron, así que cada documento actual llega con `variaciones`
  ausente y se comporta igual que siempre.
- `variaciones` con contenido → manda `variaciones`, y `ejercicios` queda **vacía**.

Al crear la **primera** variación de un día, la app mueve `ejercicios` a
`variaciones[0]` y vacía `ejercicios`. Se vacía en vez de dejarla ahí porque una
lista que ya nadie lee se queda vieja en silencio y el siguiente que la mire va a
creerle. Al borrar la última variación, el camino inverso.

### Qué variación toca hoy

Aquí está la parte que hay que hacer bien. El día del ciclo **no se guarda, se
deriva** del historial de asistencias
([RutinaProgressCalculator](../../../app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt)),
y esa decisión existe porque guardarlo causó desincronizaciones —de ahí el spec
*Calendario-Rutina como ley* y la `FECHA_CORTE`. La variación tiene que colgar del
mismo mecanismo o el bug se repite, ahora con las variaciones.

**La regla es un espejo de `diaQueToca`:** se mira la **última** asistencia a ese
día del ciclo y se avanza una posición.

```
variacionQueToca(dia, asistencias, hoy, total):
    si total <= 1: 0
    ultima = la asistencia mas reciente con
                 asistio == true
                 diaRutinaRealizado == dia
                 fecha <= hoy
    si no hay ultima:        0              # nunca ha hecho este dia
    v = ultima.variacionRealizada ?: 0
    si ultima.fecha == hoy:  v              # ya entreno hoy: se queda en la que hizo
    si no:                   (v + 1) % total
```

Para eso, `Asistencia` gana un campo, al lado del que ya guarda qué día se hizo:

```kotlin
val variacionRealizada: Int? = null
```

Se escribe al registrar la asistencia, con la variación que se le estaba
sirviendo. **Es un registro de lo que pasó, no un contador mutable** — la misma
naturaleza que `diaRutinaRealizado`, que ya vive ahí.

#### Por qué así y no contando las ocurrencias

Lo acordado fue "contar el historial: nada que guardar, nada que desincronizar".
Esto lo cumple —la variación se sigue derivando del historial, y no hay ningún
contador que pueda quedarse trabado— pero no cuenta ocurrencias, mira la última.
Tres razones:

1. **Contar rompe si se acota la query.** La entrada 17c del backlog propone
   limitar `observarAsistencias` a los últimos ~12 meses, porque hoy trae *todas*
   las asistencias históricas y crece para siempre. Con un conteo, acotar la
   ventana cambia el total y **le mueve la variación a todo el mundo, en silencio**.
   Mirando la última no pasa nada: una ventana de 12 meses siempre contiene la
   última vuelta del ciclo. Las dos mejoras conviven sin coordinarse.
2. **Contar se mueve si corriges el pasado.** Borrar o corregir una asistencia
   vieja recorre una posición todas las variaciones posteriores. Mirar la última
   solo se afecta si tocas justo la última.
3. **Es la misma forma que `diaQueToca`.** Mismos bordes, misma regla de "si es de
   hoy, es lo que estás haciendo hoy", un solo modelo mental para las dos cosas.

Y el costo habitual de guardar un campo nuevo —migrar lo viejo— aquí no existe:
**hoy no hay variaciones**, así que ninguna asistencia histórica tenía una que
preservar. Las que llegan sin el campo valen 0, que es exactamente lo correcto.

#### La estabilidad durante el día

Que la variación no cambie a media jornada importa: la clienta abre su página en
la mañana, ve los ejercicios, el entrenador le marca asistencia, y la página **no
debe** saltar a otros ejercicios mientras ella entrena. La rama `ultima.fecha ==
hoy → v` es lo que lo garantiza, igual que `diaQueToca` fija el día cuando la
asistencia es de hoy.

#### Las faltas no rotan

Una falta guarda `diaRutinaRealizado = null`, así que queda fuera del filtro por
construcción y no avanza la variación — igual que no avanza el día. Si Jaime no
vino el día que le tocaba Día 1 variación B, la próxima vez que haga Día 1 le
sigue tocando la B.

### Dónde vive el cálculo

Igual que el día: la lógica en Kotlin, y un gemelo en TypeScript que la web usa.

- `app/src/main/java/com/osfit/app/domain/VariacionCalculator.kt` — en `domain/`
  porque es lógica pura sin Android, que es lo único que cubre la suite de tests.
- `web/src/variacion.ts` — con el mismo comentario **GEMELO** que lleva
  `web/src/dia.ts`: *"Si cambia allá, cambia acá."*

A diferencia del día, **esto no se denormaliza al documento del cliente**. El día
se denormalizó (`ultimoDia`, `ultimoDiaFecha`, `ultimoDiaEsAncla`) porque su
cálculo es difícil —ancla, corte, clientes viejos— y no valía la pena reescribirlo
en la web. La variación es una búsqueda del máximo sobre asistencias que la web
**ya tiene descargadas** (`observarAsistencias`), así que denormalizarla solo
agregaría un campo capaz de quedar viejo, sin ahorrar nada.

## La app: la tarjeta dentro de Web

La tarjeta **Acceso web** de la ficha del cliente
([ClienteDetailScreen.kt:375-430](../../../app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt#L375))
pasa a ser *todo lo que la clienta ve en su página*, y la rutina entra ahí. Ese es
el criterio que decide qué va en esta tarjeta y qué no.

Dentro de ella, una sección **Rutina** con:

- De dónde sale (los tres estados de arriba).
- Los días del ciclo, con el de hoy marcado, plegables.
- Dentro de cada día, sus ejercicios. Si tiene variaciones, las variaciones con
  sus ejercicios, y cuál le toca hoy a esta clienta.
- **Editar** por día: agregar, quitar, reordenar y modificar ejercicios.
- **Agregar variación** / **Quitar variación**, solo en rutina propia.

### La otra tarjeta de rutina

Ya existe una tarjeta **"Rutina asignada"** en
[ClienteDetailScreen.kt:182](../../../app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt#L182)
con el nombre de la rutina, los nombres de los días, el día actual y el botón de
mandarla por WhatsApp. **Se queda como está y no se duplica el contenido**: esa
tarjeta responde *qué rutina tiene y qué día le toca*; la nueva responde *qué
ejercicios ve la clienta*. El botón de WhatsApp sigue sirviendo —manda la rutina
al que la pide sin abrir la página— y no hay motivo para quitarlo.

Si con el uso las dos se sienten redundantes, fusionarlas es trabajo de después y
no de ahora.

## La web: la tarjeta del día

`web/src/ui/tarjetaDia.ts` pasa a listar los ejercicios del día de hoy debajo del
nombre del día. **Su comentario de las líneas 24-29 dice hoy lo contrario de esto
y hay que reescribirlo**, apuntando a este spec; si se deja, el siguiente que lo
lea va a creer que la lista de ejercicios es un error y la va a quitar.

De cada ejercicio se muestran **nombre, series, repeticiones y `pesoONota`**.

Estados, en este orden de precedencia:

1. **Fin de semana** → el estado "hoy toca descansar" que ya existe manda, y no se
   listan ejercicios. Sábado y domingo no cuentan para la racha y no hay nada que
   hacer.
2. **Sin rutina asignada** → la tarjeta 🌱 "Todavía no tienes rutina" que ya
   existe, sin cambios.
3. **Con rutina, día sin ejercicios** → el nombre del día solo, como hoy. Es el
   caso mayoritario al empezar: el entrenador dijo que *la mayoría de las rutinas
   no traen ejercicios*. Con un texto que lo explique en vez de un hueco:
   "Tu entrenador todavía no cargó los ejercicios de este día."
4. **Con ejercicios** → la lista.

El escapado va con `escapar()`, que ya está en ese archivo: `pesoONota` es texto
libre escrito por el entrenador y termina dentro del HTML.

## Riesgos y decisiones aceptadas

**`pesoONota` queda a la vista de la clienta.** Es un campo de uso mixto: a veces
tiene el peso ("30 kg"), a veces una nota del entrenador para sí mismo ("bajarle,
se lastimó"). Se decidió mostrarlo el 2026-09-15 sabiendo esto. Atenúa el riesgo
—pero no lo elimina— que el campo ya viajaba al navegador. **El entrenador tiene
que saber que ese campo dejó de ser privado**, y conviene decírselo el día que
esto se despliegue, no dejarlo escrito solo aquí. Si más adelante estorba, la
salida es partir el campo en dos (`peso` visible y `nota` interna), no esconderlo
en el pintado, que es justo el error que este spec corrige.

**La plantilla viva le llega a todos.** No es nuevo, pero con ejercicios en la web
se nota más: agregarle un ejercicio a una plantilla se lo agrega a todas las
clientas que la siguen, al instante y sin avisar. Es lo que se quiere, y es
exactamente el motivo por el que existe el modo rutina propia.

**Acotar `observarAsistencias` (backlog 17c) ya no rompe esto**, gracias a la
decisión de mirar la última asistencia en vez de contarlas. Queda escrito aquí
para que quien haga la 17c no se pregunte si tiene que coordinarse: no tiene.

## Compatibilidad

Nada de esto necesita migración ni despliegue coordinado:

- `DiaRutina.variaciones` ausente = vacía = comportamiento de hoy.
- `Asistencia.variacionRealizada` ausente = 0.
- `Cliente.plantillaOrigenId` ya existe y ya tiene los dos valores que hacen falta;
  todos los clientes actuales lo tienen puesto y siguen en modo plantilla.
- `firestore.rules` **no cambia**: la clienta ya lee su documento entero.
- Una web vieja contra datos nuevos ignora `variaciones` y muestra `ejercicios`,
  que estará vacía en quien tenga variaciones — degrada al caso 3 de arriba, no
  rompe.
