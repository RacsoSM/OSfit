# Mancu: repertorio de acciones, transiciones variadas y texto negro legible — Plan

**Antes:** `docs/superpowers/plans/2026-10-02-animaciones-mancu.md` (ya implementado: viaje entre
escenas, poses SENALA/ABAJO/TRISTE, caminata, letras con vida, reloj visible, `ActorMancu`).

**Pedido del trainer (2026-10-02), tras ver el video en el celular:** "Me agrada, pero quiero
diferentes animaciones para Mancu, no que siempre esté saludando, que haga más cosas a lo largo del
video; que existan más tipos de transiciones entre diapositivas y que vaya alternando entre ellas;
y cambiar la tipografía negra exclusivamente porque no se alcanza a leer. Las naranjas están
perfectas."

## Reglas (se mantienen)

Blobs intacto; `TextosEscena` intacto; tests existentes sin modificar (solo añadir); sin objetos
pesados por frame; curvas puras en `MancuAnimacion` (o un objeto puro nuevo) con test; un worker a
la vez; commit local por tarea; sin push. `RitmoVideo.MANCU` (ventana 1000 ms) no cambia.

## A. Texto negro legible (tarea 6)

**Causa:** `TextoMancu.pintarTitulo` pinta relleno + contorno de tinta de 6 px + sombra dura de
tinta. Con relleno `TINTA` las tres capas son del mismo color: la letra engorda y los huecos
(a, e, o, d) se tapan. Con relleno rojo el contorno negro sí contrasta: por eso se lee.

**Cambio:** solo cuando el color del título es oscuro (`TINTA`; usar una función pura
`esColorOscuro(color)` por luminancia < 0.3, testeada):
- **Sin contorno de tinta** y **sin sombra negra**.
- Halo fino color papel claro (`#FFF7E3`, trazo 5 px, `Join.ROUND`) detrás del relleno, para
  separarlo del sol y de las gráficas.
- Sombra dura **suave** en color sol oscuro (`#E3B94F`, desplazamiento 3, 4) detrás del halo, que
  mantiene el look "pegatina" sin ensuciar.
- Interletraje ligeramente mayor para negro (`letterSpacing = 0.03f`) — medir con el mismo `Paint`
  para que `measureText` y el dibujo coincidan; para rojo sigue en 0.
- Rojo/naranja: **exactamente igual que hoy**.
- Paints nuevos como campos (`haloClaro`, `sombraSuave`).

## B. Transiciones variadas que se alternan (tarea 7)

Hoy solo existe la nube. Se agregan tres; la transición entre la escena `i` y la `i+1` usa
`TipoTransicionMancu.paraIndice(i)` = `[NUBE, TELON, IRIS, BROCHA][i % 4]` (función pura testeada:
nunca dos seguidas iguales). Todas usan la misma ventana de 1000 ms, tapan del todo en
`a = 0.5` (cambio de escena con `escenaVisibleEsEntrante`) y destapan en la segunda mitad.

| Tipo | Cómo se ve | Viaje de Mancu |
|---|---|---|
| `NUBE` | La actual. | `CORRER` (el actual: sale por la derecha, entra por la izquierda). |
| `TELON` | Dos cortinas rojas (`ROJO`, pliegues verticales más oscuros `#A82E1E`, borde de tinta 8 px) que se cierran desde los lados y se encuentran al centro; una cenefa ondulada arriba baja con ellas. Al abrir, se retiran hacia los lados. | `CORRER`. |
| `IRIS` | Capa de tinta `TINTA` con un agujero circular que se cierra hasta 0 (centrado en Mancu si está presente; si no, en el centro) y se reabre centrado en el Mancu entrante. `Path` con `FillType.EVEN_ODD` (rect + círculo), campo reutilizado; anillo de sol de 12 px en el borde del agujero. | `SALTO`: en la salida se agacha y salta hacia arriba fuera de cuadro; en la llegada cae desde arriba con `squash` al aterrizar. |
| `BROCHA` | 3 pinceladas gruesas en zigzag (amarillo sol, rojo, sol) que barren la pantalla en diagonal de izquierda-arriba a derecha-abajo, cada una con bordes irregulares (dientes de cerdas precalculados en `FloatArray`) y contorno de tinta; al destapar, las pinceladas se retiran en la misma dirección (salen por la derecha). | `SALTO`. |

- Pura en `MancuAnimacion` (o `TransicionesMancu`): `paraIndice`, progreso de cada tipo (0..1..0
  por mitades) y el viaje `SALTO`: `viajeSaltoY(a)` (fracción del alto: 0 → −1.2 antes de 0.5;
  +… cae desde −1.2 a 0 en la segunda mitad con ease-in y aterrizaje), `viajeSaltoEscalaY(a)`.
- `RendererMancu`: necesita el índice del tramo saliente (`timeline.tramos.indexOf` cacheado o
  índice por búsqueda sin asignar) para elegir el tipo; un renderer de transición por tipo, todos
  como campos (clases `TransicionTelonMancu`, `TransicionIrisMancu`, `TransicionBrochaMancu` junto a
  `NubeTransicionMancu`, con una interfaz común `TransicionMancu { fun dibujar(canvas, ancho, alto,
  progreso, a, centroX, centroY) }`).
- Líneas de velocidad: horizontales en `CORRER`, verticales en `SALTO`.

## C. Repertorio de acciones de Mancu (tareas 8 y 9)

Hoy, fuera de los momentos clave, Mancu casi siempre está en `HOLA` con `ondeo`. Se crea un
repertorio de **acciones** reutilizables y cada escena usa otras distintas, de modo que el saludo
solo aparece en el Saludo y la Despedida.

### Dibujo (tarea 8) — `PoseMancu` / `MancuDibujo`

- `Brazos.LIBRE`: cada brazo definido por `anguloBrazoIzq`, `anguloBrazoDer` (grados, convención de
  SENALA: 0 = derecha, −90 = arriba) y `codoIzq`, `codoDer` (−1..1: curvatura de la manguera; 0 =
  recto). Mano a 52 unidades del hombro (40, 88) / (160, 88).
- `guanteDer` / `guanteIzq`: `Guante.ABIERTO` (el actual), `PUNO` (círculo con dos líneas de
  dedos), `PULGAR` (puño + pulgar hacia arriba).
- `reloj: Boolean`: reloj de pulsera rojo con esfera blanca en la muñeca izquierda.
- `Ojos.GUINO` (ojo derecho cerrado en arco `^`, izquierdo normal).
- `piernasAbiertas: Float` (0..1): abre las piernas en "A" (para tijeras y baile); se ignora si
  `fasePaso >= 0`.
- `Brazos.MUSCULO`: ambos brazos doblados hacia arriba presumiendo bíceps (codo afuera, puño
  arriba), con dos líneas de "fuerza" junto a cada brazo.
- Las poses existentes no cambian.

### Acciones (tarea 8) — objeto puro `AccionesMancu`

`enum class AccionMancu { SALUDAR, APLAUDIR, TIJERAS, BAILAR, MUSCULO, PULGAR, RELOJ, ESTIRARSE,
VOLTERETA, CORRER_SITIO }` y una función pura que, dado `(accion, tDesdeInicioMs)`, devuelve los
parámetros de pose y cuerpo (data class `CuadroAccion` con ángulos, codos, guantes, ojos, boca,
piernasAbiertas, fasePaso, alturaPx, rotacion, escalaY, confeti, ...). `ActorMancu` gana
`actuar(x, y, tamano, accion, tMs, poseBase)` que la aplica. Tests: periodicidad, rangos, que
VOLTERETA dé 360° exactos y termine en 0, que TIJERAS cierre y abra piernas y brazos a la vez.

| Acción | Movimiento |
|---|---|
| `SALUDAR` | La actual (HOLA + ondeo). |
| `APLAUDIR` | Brazos LIBRE al frente que se juntan y separan cada 450 ms; en el choque, 3 rayitas de impacto entre los guantes; ojos FELIZ. |
| `TIJERAS` | Saltos de tijera: ciclo 700 ms, brazos de abajo (±60° desde vertical) a arriba (±160°), piernas 0↔1, salto de 30 px, boca ABIERTA. |
| `BAILAR` | Ciclo 900 ms: cuerpo se inclina ±10°, un brazo arriba señalando al cielo y el otro a la cadera alternando (estilo disco), pasos laterales (piernasAbiertas 0.4 + fasePaso lenta), GUINO a mitad del ciclo. |
| `MUSCULO` | Brazos MUSCULO con pulso de escala 1 → 1.06 cada 600 ms, ojos FUERZA, boca DIENTES. |
| `PULGAR` | Brazo derecho LIBRE al frente con guante PULGAR, izquierdo en la cadera, GUINO, ligero rebote. |
| `RELOJ` | Levanta la muñeca izquierda con `reloj`, mira hacia ella (LADO), boca O; a los 900 ms se encoge de hombros (brazos LIBRE abiertos hacia abajo) y sonríe. |
| `ESTIRARSE` | Brazos rectos arriba, cuerpo estirado (escalaY 1.08) inclinándose ±8° lento, boca O (bostezo). |
| `VOLTERETA` | Salto con anticipación (`alturaSalto`, 220 px) girando 360° en el aire alrededor del centro del disco, confeti, aterriza con squash. Duración 900 ms. |
| `CORRER_SITIO` | Trote en el lugar (fasePaso 360 ms), brazos LIBRE alternando con codos doblados, sudor. |

### Coreografía (tarea 9) — qué hace en cada escena

Se conservan los momentos clave (entradas, saltos de reacción, SENALA, golpes en letras, medalla);
se **reemplazan los tramos de relleno en `HOLA` con ondeo** por acciones:

| Escena | Antes | Ahora |
|---|---|---|
| Saludo | Saluda todo el tiempo | Cae, **saluda** (900–2300), salto celebrando, luego **PULGAR**. |
| Asistencia | Salto y saluda | Mira, salto de reacción y luego **APLAUDIR**; puesto 1 → **BAILAR** con confeti; 0 días → triste (igual). |
| Tiempo | Señala la gráfica | Mira, SENALA el máximo, saltito, luego **RELOJ** (encaja con "tiempo"). |
| Día favorito | Señala la dona | SENALA la rebanada y salta, luego **ESTIRARSE**. |
| Racha | Sentadillas, salto, saluda | Sentadillas, salto, luego **TIJERAS** (puesto 1: **CORRER_SITIO** → **MUSCULO**). |
| Medalla | Salto y saluda en el mensaje | Mira, salto con la medalla, luego **MUSCULO** durante el mensaje. Sin medalla: **PULGAR**. |
| Logros | Señala y saltitos | SENALA cada logro, luego **VOLTERETA** y **BAILAR**. |
| Despedida | Saluda y camina | **Saluda** y camina (igual, es la despedida). |

Si una escena se repite (varias escenas de logros), alterna entre BAILAR y APLAUDIR según el número
de logros, para no repetir exactamente.

## Tareas (un worker cada una, en orden)

6. Texto negro legible (`TextoMancu` + test de `esColorOscuro`).
7. Transiciones `TELON`, `IRIS`, `BROCHA`, alternancia y viaje `SALTO` (`RendererMancu` + clases
   nuevas + tests puros).
8. Dibujo nuevo (LIBRE, guantes, reloj, GUINO, piernasAbiertas, MUSCULO) + `AccionesMancu` +
   `ActorMancu.actuar` + tests.
9. Coreografía con acciones en las ocho escenas.

Tras cada tarea: el coordinador verifica (`./gradlew testDebugUnitTest assembleDebug --offline
--rerun-tasks -q`, total de tests, `git diff` de lo protegido) y libera el worker. Al final:
`installDebug` y revisión del trainer.

## Qué mirar en el celular

1. ¿El texto negro ahora se lee bien sobre el papel y sobre el sol? ¿El rojo sigue igual?
2. ¿Se notan las cuatro transiciones distintas y se sienten parte del mismo estilo?
3. ¿Mancu se ve "vivo" y variado? ¿Alguna acción se ve rara (brazos, voltereta)?
4. Tiempo de generación (IRIS y BROCHA son baratos; TELON también).
