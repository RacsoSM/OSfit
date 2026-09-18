# La ruleta: una segunda oportunidad cuando ya no quedan vidas

## Contexto y objetivo

El cliente tiene **3 revives al mes** para reparar la falta que le rompió la
racha. Cuando se le acaban, la tarjeta de "Revivir mi racha" sigue apareciendo
pero con el botón muerto y un letrero que dice, en efecto, "ya no hay nada que
hacer". Es el único lugar de la página donde el cliente se topa con una pared
lisa.

Este diseño convierte esa pared en una apuesta. Sin vidas y con la racha rota,
la tarjeta ofrece un juego: el cliente elige uno de dos colores, la ruleta
gira, y si acierta se le revive la racha. Si falla, el mes siguiente tendrá 2
revives en vez de 3.

No cambia nada de lo que ya funciona: con cupo disponible, la tarjeta se
comporta exactamente como hoy.

## Alcance

**Entra:** la propuesta dentro de la tarjeta de revivir, el modal en primer
plano con la ruleta animada, la función `jugarRuleta` en el servidor, la
colección `ruletas`, el castigo del mes siguiente reflejado en el cupo (web y
Kotlin), y la tirada de prueba.

**No entra:** notificaciones al entrenador cuando alguien juega, historial de
tiradas visible para el cliente, más de dos colores, apuestas de otra cosa que
no sea el cupo del mes siguiente.

## Decisiones tomadas y por qué

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| **Una tirada por mes**, gane o pierda | Una por cada racha rota | Con castigo no acumulable, la segunda derrota del mes sale gratis. Una sola tirada es lo que hace que ganar valga algo. |
| **El castigo no se acumula**: el piso es 2 | 3 → 2 → 1 → 0 | Un cliente en 0 revives permanentes es un cliente al que la página ya solo le da malas noticias. |
| **El castigo cae sobre el mes siguiente** | Sobre el mes en curso | Es lo que dice el texto que lee el cliente. La regla que se promete es la regla que se aplica. |
| **70/30 a favor del cliente**, con la ruleta dibujada mitad y mitad | 50/50 honesto | Decisión del entrenador: quiere que ganar sea lo probable sin que se vea regalado. Ver "Riesgo aceptado" al final. |
| **El sorteo vive solo en el servidor** | Sortear en el navegador y validar después | Un sorteo en el cliente se gana siempre desde la consola del navegador. No es negociable. |
| **Un documento por cliente y mes** en `ruletas` | Colecciones separadas `tiradas` y `castigos` | Un solo hecho ("perdió en septiembre") responde las dos preguntas: si ya jugó, y si está castigado. Dos colecciones pueden desincronizarse. |
| **El cupo sigue siendo derivado**, sin contadores | Un contador de revives por cliente | Es el principio que ya rige `cupo.ts`: si el entrenador corrige algo, el cupo se corrige solo. |

## La tarjeta: estados y textos

La tarjeta de `tarjetaRevivir()` en `web/src/ui/accionFalta.ts` gana dos
estados. La regla que los ordena: **el juego solo existe donde hoy hay una
pared.**

| Condición | Qué muestra |
|---|---|
| No hay falta rota reparable | Nada (sin cambios) |
| Cuenta pausada (`!cliente.activo`) | "Tu cuenta está pausada. Habla con tu entrenador." (sin cambios; no se ofrece jugar) |
| Hay cupo disponible | "💔 Revivir mi racha" + cuántos quedan (sin cambios) |
| **Sin cupo, no jugó este mes** | La propuesta + botón "Leer propuesta" |
| **Sin cupo, ya jugó este mes** | "Ya usaste tus revives de este mes. Y tu tirada." — sin botón |

Texto de la propuesta en la tarjeta:

> 💔 **Te quedaste sin vidas para revivir tu racha… pero te tengo una
> propuesta.**
>
> `[ Leer propuesta ]`

Texto dentro del modal:

> **Te propongo un juego.**
>
> Si adivinas en qué color caerá la ruleta, te revivo tu racha. Si no le
> atinas, el próximo mes tendrás solo 2 oportunidades para revivir en vez de 3.
>
> **¿Quieres jugar?**

### Los acuses

**Si gana**, el festejo va dentro del modal. La tarjeta de abajo no necesita
acuse: al justificarse la falta, `faltaQueRompioLaRacha()` devuelve `null` y la
tarjeta se retira sola, que es lo que ya pasa hoy tras un revive normal.

**Si pierde**, el acuse va dentro del modal y **tiene que nombrar el costo**:

> Cayó en morado. El próximo mes tendrás 2 revives en vez de 3.

Un "perdiste" a secas deja al cliente sin saber qué acaba de pasarle.

### El mes castigado se explica solo

Cuando el cupo del mes sea 2 y no 3, la nota `cuantosQuedan()` no puede seguir
hablando de "tus 3 revives". En un mes castigado dice:

> Te quedan 2 este mes (perdiste la ruleta el mes pasado).

Sin esa frase el cliente ve un número raro y no sabe por qué.

## El modal y la ruleta

### Dónde vive en el DOM

Módulo nuevo `web/src/ui/ruleta.ts`, con su propio estado interno — el mismo
patrón de `accionFalta.ts` y `accionDia.ts` — y su propio nodo `#ruleta`,
hermano de `#videos`, creado en `prepararEstructura()`.

**No se repinta desde `pintar()`.** `pintar()` rehace el `innerHTML` de
`#contenido` en cada snapshot de Firestore, y hay dos precedentes escritos en
`main.ts` de animaciones que murieron por eso: el saludo (la máquina de
escribir arrancaba y moría a los 2 ms) y los videos (el `<video>` volvía a
empezar). Una ruleta girando dentro de `#contenido` se moriría a media tirada
en cuanto el entrenador marque una asistencia. `#ruleta` se repinta solo cuando
cambia su propio estado.

### El primer plano

Overlay fijo sobre toda la pantalla: `--fondo` al 80 % con
`backdrop-filter: blur(4px)`; encima, la tarjeta sobre `--superficie-alta`. Lo
de atrás queda visible pero apagado e intocable.

**Mientras la ruleta gira, nada cierra el modal** — ni el fondo, ni `Escape`,
ni la ✕. Cerrar a media tirada dejaría al cliente sin saber qué pasó con su
apuesta, y la apuesta ya está cobrada en el servidor.

### La salida

Una **✕ discreta arriba a la derecha**, que cierra sin costo cuando no hay
nada girando. No jugar no es perder, y "Leer propuesta" sigue en la tarjeta
para volver. Sin salida, "Leer propuesta" es una trampa y el cliente aprende a
no tocarla.

### El dibujo

Un `<div>` circular con `conic-gradient` de dos sectores iguales y un puntero
fijo arriba. Gira con `transform: rotate()`. Sin canvas y sin librerías: el
proyecto no tiene dependencias de UI y esto no amerita la primera.

Los dos colores son **`--primario`** (el de la paleta de la clienta) y
**`--ambar`**. Deliberadamente **no** `--verde` ni `--rojo`: en el calendario
esos dos ya significan "asistió" y "faltó", y verlos en una ruleta que decide
justo eso confunde.

### La elección

Los dos colores son tocables dentro del modal. Al tocar uno queda marcado y
**"Jugar" se habilita**; antes de eso está deshabilitado. Una sola
confirmación: tocar "Jugar" ya es la apuesta.

### La animación, en dos fases

**Fase 1 — giro libre.** Arranca al tocar "Jugar", en el mismo instante, no
cuando responde el servidor. Rotación lineal e infinita a velocidad constante.
En el gimnasio con datos móviles, la alternativa es una tarjeta congelada
diciendo "Enviando…" durante dos segundos, que es justo donde la tensión se
vuelve sospecha.

**Fase 2 — frenado.** Al llegar la respuesta, se frena hasta el ángulo del
color ganador con una curva de salida lenta. El reencaminado **no se puede
notar**, y eso impone tres reglas:

1. **Se lee el ángulo real del instante del relevo**, de la matriz de
   transformación calculada (`getComputedStyle`), no de una cuenta propia. Si
   se asume el ángulo, la rueda pega un salto visible justo en el momento en
   que el cliente más la está mirando.
2. **El frenado dura mínimo 3 vueltas completas** más el ángulo destino. La
   corrección queda absorbida dentro de las vueltas y es imperceptible.
3. **El giro libre dura un mínimo fijo (~800 ms)** aunque el servidor responda
   antes. Así el frenado siempre tiene la misma forma y la duración de la
   espera no delata el resultado.

**Aterriza en un punto distinto cada vez.** Dentro del sector que mandó el
servidor, el ángulo final lleva una variación aleatoria. Si siempre cae clavada
en el mismo grado, se nota que el dibujo obedece a un dato.

**`prefers-reduced-motion`**: sin giro. El resultado aparece con un fundido
corto.

### La tirada de prueba

Misma animación, pero:

- El color lo decide el navegador con `Math.random()`. **No toca el servidor**
  y no tiene ninguna relación con el sorteo real.
- Ilimitada: no cuenta, no revive, no castiga.
- El resultado se rotula **"Tirada de prueba — esta no cuenta"**.
- **Mientras una prueba está girando, "Jugar" queda deshabilitado.** Que un
  toque impaciente convierta un ensayo en la apuesta real sería el peor fallo
  posible de esta pantalla.

## El servidor

### La colección `ruletas`

Id compuesto `{clienteId}_{AAAA-MM}`. Campos:

```
clienteId: string
mes:       string   // "AAAA-MM"
color:     string   // el color en que cayó
gano:      boolean
fecha:     string   // AAAA-MM-DD de la tirada
```

El id compuesto es lo que hace atómico el "una tirada por mes": la función
escribe con `create()`, y si el documento ya existe la escritura falla sola.
Dos toques simultáneos desde dos teléfonos no pueden producir dos tiradas.

En `firestore.rules`, el cliente **lee** su propio documento (lo necesita para
saber si ya jugó y para calcular su cupo) y **nunca escribe**: solo la función.

### `jugarRuleta`

Una sola llamada, con el mismo patrón que `revivirRacha.ts`:

1. Identifica al cliente por la sesión (`clienteDeLaSesion`), nunca por lo que
   mande la página.
2. **Revalida todo en el servidor**: que la cuenta esté activa, que haya una
   falta rota dentro de la ventana reparable (`faltaQueRompioLaRacha`), que el
   cupo del mes esté en cero, y que no exista tirada de este mes. Igual que hoy
   no se confía en la fecha que manda la web, tampoco se confía en "te juro que
   no tengo vidas".
3. **Sortea**: `Math.random() < PROBABILIDAD_GANAR` con
   `PROBABILIDAD_GANAR = 0.7`, constante del servidor. El navegador nunca la
   conoce.
4. **Escribe en una transacción**: el documento de `ruletas` con `create()`, y
   si ganó, la justificación de la falta.
5. Devuelve `{ gano, color }`.

Errores, como `HttpsError` con códigos que la web distingue:

| Código | Cuándo | Qué lee el cliente |
|---|---|---|
| `failed-precondition` | No hay falta reparable, o el cliente todavía tiene cupo | "Ya no hay nada que revivir." |
| `already-exists` | Ya jugó este mes | "Ya jugaste tu tirada de este mes." |
| `permission-denied` | Cuenta pausada | "Tu cuenta está pausada. Habla con tu entrenador." |
| cualquier otro | Red, fallo | "No pudimos girar la ruleta. Inténtalo otra vez en un momento." |

### El premio no gasta cupo

La justificación que otorga la ruleta se marca con una bandera propia,
**`ganadaEnRuleta: true`**, además de `justificada`. Es necesaria: si se
marcara como `justificadaPorCliente`, `gastadosEnElMes()` la contaría como un
revive usado y el premio se cobraría a sí mismo.

Los demás campos del documento de asistencia se escriben igual que en
`revivirRacha`, con la misma forma que el data class `Asistencia` de Kotlin.

### El cupo deja de ser una constante

```
disponiblesEnElMes(mes) = max( (MAXIMO_POR_MES - castigo(mes)) - gastados(mes), 0 )

castigo(mes) = 1  si existe ruletas/{clienteId}_{mes anterior} con gano == false
               0  en cualquier otro caso
```

Sigue sin haber contadores. Si el documento de la ruleta se borra, el cupo
vuelve solo a 3 — el mismo principio que ya rige `cupo.ts`.

`disponiblesEnElMes()` y `gastadosEnElMes()` reciben el documento de ruleta del
mes anterior (o `null`) como parámetro explícito, no lo leen ellas: hoy son
funciones puras y probables en Node, y tienen que seguir siéndolo.

### El gemelo Kotlin

`CupoRevivesCalculator` y su test cambian igual que `cupo.ts`: el castigo entra
como parámetro. `ClienteDetailViewModel` lee el documento de ruleta del mes
anterior, y la línea de `ClienteDetailScreen.kt` que hoy dice
`"Revives: $revivesDisponibles de 3 disponibles este mes"` refleja el máximo
real y **dice por qué**:

> Revives: 1 de 2 (perdió la ruleta en agosto)

Si la app del entrenador y la del cliente dicen números distintos sobre el
mismo mes, el reclamo por WhatsApp le llega al entrenador.

## Qué se prueba

Ciclo TDD, como el resto del repo.

**Web (`vitest`)**

- `cupo.test.ts`: cupo con castigo y sin castigo; el castigo del mes anterior
  no afecta a dos meses después; el castigo no baja el cupo por debajo de 0.
- `ruleta.test.ts`: elegibilidad de la propuesta en los cinco estados de la
  tabla; "Jugar" deshabilitado sin color elegido y durante una prueba; el
  ángulo final cae dentro del sector del color devuelto; el ángulo final varía
  entre tiradas del mismo color.
- `accionFalta.test.ts`: con cupo, la tarjeta no cambia (regresión).

**Functions**

- Rechaza la segunda tirada del mismo mes.
- Rechaza con cupo disponible, sin falta reparable, y con cuenta pausada.
- El premio justifica la falta con `ganadaEnRuleta` y **no** con
  `justificadaPorCliente`.
- La derrota escribe el documento con `gano:false` y no toca las asistencias.
- Distribución del sorteo con la fuente de azar inyectada (no `Math.random`
  global), para poder fijarla.

**Kotlin (`./gradlew test`)**

- `CupoRevivesCalculatorTest`: los mismos casos que `cupo.test.ts`, para que
  los gemelos no se separen.

## Cómo se prueba antes de producción

Todos los clientes tienen su web funcionando hoy, así que nada de esto toca
`main` hasta estar visto en un teléfono real.

- El trabajo vive en la rama **`feature/ruleta-revivir-racha`**.
- Las funciones nuevas se prueban con el emulador de Firebase, no contra el
  proyecto de producción.
- El cambio de `cupo.ts` y de `CupoRevivesCalculator` es el de mayor riesgo:
  toca el camino que **todos** los clientes usan hoy, no solo los que se
  quedaron sin vidas. Por eso la prueba de regresión "con cupo, la tarjeta no
  cambia" es obligatoria antes de mezclar.
- Se mezcla a `main` solo después de recorrer a mano los cinco estados de la
  tabla de la tarjeta.

## Riesgo aceptado

La ruleta se dibuja mitad y mitad pero el sorteo es 70/30 a favor del cliente.
Es una decisión consciente del entrenador. Se deja anotada porque es la única
parte del diseño donde lo que se ve y lo que pasa no coinciden, y porque hay
una salida si algún día molesta: dibujar el sector ganador con el tamaño que le
corresponde y decirlo en la tarjeta ("la ruleta está cargada a tu favor"). Ese
cambio es solo de presentación — el servidor no se toca.

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `web/src/ui/ruleta.ts` | **nuevo** — estado, HTML del modal, animación |
| `web/src/ui/accionFalta.ts` | los dos estados nuevos de la tarjeta y el botón "Leer propuesta" |
| `web/src/cupo.ts` | el castigo entra en el cálculo |
| `web/src/acciones.ts` | el binding de `jugarRuleta` |
| `web/src/datos.ts` | observar el documento de ruleta del mes y del anterior |
| `web/src/main.ts` | el nodo `#ruleta` fuera de la zona repintada |
| `web/src/estilos.css` | overlay, tarjeta del modal, ruleta, animaciones |
| `functions/src/jugarRuleta.ts` | **nuevo** |
| `functions/src/index.ts` | exportarla |
| `firestore.rules` | lectura propia de `ruletas`, escritura nunca |
| `app/.../CupoRevivesCalculator.kt` | el castigo como parámetro |
| `app/.../ClienteDetailViewModel.kt` | leer la ruleta del mes anterior |
| `app/.../ClienteDetailScreen.kt` | el máximo real y el motivo |
