# Medallas y logros por cliente

## Contexto y objetivo

Al final del resumen quincenal en video, se quiere premiar al cliente con una
medalla o logro según el apartado en el que más destacó ese período
(asistencia, tiempo, racha, esfuerzo, o constancia en su día favorito),
mostrada en una escena nueva con una imagen de referencia. La medalla también
queda guardada en un nuevo apartado del perfil del cliente ("Logros"), como
historial.

La decisión de qué medalla otorgar es automática (por ranking), pero el
entrenador puede ajustarla manualmente antes de generar el video — incluyendo
otorgar una medalla que no ganó por número (p. ej. una subjetiva como "más
buena onda"), o repetir la misma medalla en más de un cliente aunque no haya
empate real, siempre que sea una elección manual explícita.

Alcance: solo el resumen **quincenal**. Semanal y mensual no se tocan.

## Modelo de datos

### Catálogo de medallas (compartido, Firestore `medallas`)

```kotlin
enum class CategoriaMedallaAutomatica { ASISTENCIA, TIEMPO, RACHA, ESFUERZO, CONSTANCIA }

data class MedallaCatalogo(
    val id: String = "",
    val nombre: String = "",
    // null = medalla subjetiva (creada y otorgada manualmente, sin fórmula).
    val categoria: CategoriaMedallaAutomatica? = null,
    // filesDir/medallas/<id>.<ext>; null = usa la imagen empaquetada de la categoría
    // (solo aplica a las 5 automáticas) o el ícono genérico (subjetivas sin imagen propia).
    val imagenArchivo: String? = null
)
```

Las 5 categorías automáticas se siembran con id fijo (`"asistencia"`,
`"tiempo"`, `"racha"`, `"esfuerzo"`, `"constancia"`) la primera vez que se
abre el catálogo, si no existen todavía (`asegurarCategoriasAutomaticas`,
idempotente). Son editables (nombre, imagen) pero no borrables — la UI no
ofrece la opción de borrar cuando `categoria != null`. Las subjetivas usan id
autogenerado por Firestore y sí son borrables.

### Medalla otorgada (por cliente, Firestore `clientes/{clienteId}/medallas`)

```kotlin
data class MedallaOtorgada(
    val rangoInicio: String = "",     // ISO date del inicio de la quincena; doc id (upsert por período)
    val medallaId: String = "",       // referencia a MedallaCatalogo.id
    val nombreMedalla: String = "",   // copia del nombre al momento de otorgarla
    val encabezadoRango: String = "", // "2da quincena de agosto", para mostrar en Logros sin recalcular
    val fueAjustadaManualmente: Boolean = false
)
```

`nombreMedalla` y `encabezadoRango` se copian (denormalizan) al momento de
otorgar para que el historial en "Logros" no cambie retroactivamente si el
catálogo se edita después.

Nada en este modelo impide que dos clientes reciban `medallaId` igual en la
misma quincena — cada registro es independiente por cliente. La sugerencia
automática solo determina el valor por defecto que ve el entrenador antes de
confirmar.

### Extensión a `ResumenClienteData`

Dos rankings nuevos, calculados en `calcularResumenCliente` exactamente igual
que los tres que ya existen (comparando contra `clientesActivos`):

```kotlin
val rankingEsfuerzo: RankingResultado?,    // por porcentajeEntrenando descendente; null si el cliente no tiene desglose
val rankingConstancia: RankingResultado?   // por (máximo de conteoDias) / diasAsistidos descendente; null si diasAsistidos == 0
```

Ambos son nulos para el cliente en cuestión cuando no son computables para él
(sin `segundosPorEjercicio`/`minutosDescanso`, o sin asistencias), igual que
ya pasa con `rachaMasLarga`/`rankingRacha` en el resumen semanal.

## Lógica de decisión (`MedallaCalculator`, domain puro)

```kotlin
object MedallaCalculator {
    // Orden de prioridad fijo para desempatar EntreCategorías cuando el mismo cliente
    // queda en puesto 1 en más de una — nunca desempata entre personas, eso ya lo
    // resuelve calcularRanking (un empate real en el número dejaría a ambos en puesto 1).
    private val PRIORIDAD = listOf(ASISTENCIA, TIEMPO, RACHA, ESFUERZO, CONSTANCIA)

    fun sugerirCategoria(resumen: ResumenClienteData): CategoriaMedallaAutomatica? {
        val candidatas = listOfNotNull(
            ASISTENCIA.takeIf { resumen.rankingAsistencia.puesto == 1 },
            TIEMPO.takeIf { resumen.rankingTiempo.puesto == 1 },
            RACHA.takeIf { resumen.rankingRacha?.puesto == 1 },
            ESFUERZO.takeIf { resumen.rankingEsfuerzo?.puesto == 1 },
            CONSTANCIA.takeIf { resumen.rankingConstancia?.puesto == 1 }
        )
        return PRIORIDAD.firstOrNull { it in candidatas }
    }
}
```

Puramente por cliente: no necesita el resumen de los demás clientes activos
por separado, porque los 5 rankings ya vienen resueltos contra ellos dentro
de `ResumenClienteData`.

## Repositorio

```kotlin
class MedallaRepository(db: FirebaseFirestore = FirebaseFirestore.getInstance()) {
    fun observarCatalogo(): Flow<List<MedallaCatalogo>>
    suspend fun asegurarCategoriasAutomaticas()
    suspend fun guardarMedalla(medalla: MedallaCatalogo): String
    suspend fun eliminarMedalla(medallaId: String)  // lanza si la medalla tiene categoria != null

    fun observarOtorgadas(clienteId: String): Flow<List<MedallaOtorgada>>
    suspend fun otorgarMedalla(clienteId: String, otorgada: MedallaOtorgada)  // set, doc id = rangoInicio
}
```

Se agrega a `AppContainer` igual que los repositorios existentes.

### Imágenes (`MedallaImagenUtil`)

Mismo patrón que `CancionUtil`: copia la imagen elegida por el trainer a
`filesDir/medallas/<medallaId>.<ext>` (no depende de un `content://`
revocable). Resolución de bitmap para mostrar (catálogo o video):

1. `imagenArchivo != null` → decodificar ese archivo.
2. si no, y `categoria != null` → drawable empaquetado por categoría
   (`R.drawable.medalla_asistencia`, etc.; se diseñan las 5 imágenes).
3. si no (subjetiva sin imagen propia) → sin bitmap; el renderer dibuja un
   ícono genérico con Canvas (una estrella simple), no queda vacío.

## UI

### Catálogo (`Screen.Medallas`, nueva entrada en el drawer bajo "Top"/"Sandbox")

Lista las 5 automáticas primero, luego las subjetivas, cada una con imagen +
nombre. Tocar una automática: editar nombre / reemplazar imagen (sin opción
de borrar). Botón "Nueva medalla": crea una subjetiva (nombre + imagen
opcional). Las subjetivas tienen opción de borrar (con confirmación; borra
también su archivo de imagen si tenía uno).

### Flujo de confirmación al generar el resumen quincenal

Solo se activa cuando `tipo == QUINCENAL`; semanal y mensual generan
directo, como hoy.

1. Se elige la quincena (`SeleccionarRangoResumenDialog`, sin cambios).
2. Se calcula el resumen del cliente (ya trae las 5 rankings).
3. `MedallaCalculator.sugerirCategoria(resumen)` da la categoría sugerida (o
   ninguna); se busca en el catálogo la medalla de esa categoría.
4. Se abre `ConfirmarMedallaDialog`: sugerencia destacada arriba, lista
   completa del catálogo debajo (radio buttons, mismo estilo que el selector
   de período) + opción "Sin medalla", preseleccionando la sugerencia (o "Sin
   medalla" si no hubo).
5. Al confirmar: se guarda `MedallaOtorgada` vía `medallaRepository`
   (independiente de si el video después falla), y se genera el video con el
   resumen ya calculado — sin recomputar — pasando la medalla elegida.

### "Logros" en el perfil

Una tarjeta expandible más en `ClienteDetailScreen` (mismo patrón visual que
"Rutina asignada"), listando cada `MedallaOtorgada` del cliente —imagen +
nombre + quincena—, más reciente primero. No se agrega una pantalla nueva
para esto.

## Video

### Escena nueva

```kotlin
data class Medalla(val nombre: String, val imagen: Bitmap?) : EscenaResumen()
```

Se agrega en `ResumenVideoGenerator.construirEscenas` solo si se confirmó una
medalla (no "Sin medalla"), justo antes de `Despedida` (después de
`RachaMasLarga`). El `Bitmap` se decodifica una sola vez en
`generarYCompartir` (ahí ya hay `Context`) y se pasa resuelto — el
`ResumenFrameRenderer` sigue sin depender de `Context`, igual que hoy.

### Render

Mismo lenguaje visual que las demás escenas: título con máquina de escribir
("¡Felicidades! Te ganaste:"), imagen centrada con fade-in, nombre de la
medalla debajo en `DESTACADO`. Duración ~6-7s, en línea con las demás escenas
de cierre.

## Testing

- `MedallaCalculatorTest` (nuevo): empate real en el número → ambos clientes
  sugeridos; sin ganador en ninguna categoría → `null`; prioridad fija
  cuando el mismo cliente empata en más de una categoría.
- `ResumenClienteCalculatorTest`: casos para `rankingEsfuerzo` y
  `rankingConstancia`, incluyendo cuándo quedan `null`.
- `ResumenVideoGeneratorTest`: la escena `Medalla` aparece solo cuando se
  pasa una medalla, y solo puede pasarse en el flujo quincenal.
- Render de imagen (`ResumenFrameRenderer`, `MedallaImagenUtil`) no es
  testeable por JVM unit test (requiere `android.graphics.Bitmap` real) —
  misma limitación que ya existe para el resto del renderer; se verifica
  igual que las escenas anteriores, generando un video real en el
  dispositivo antes de dar por terminada la feature.

## Fuera de alcance (explícito)

- No se toca el resumen semanal ni mensual.
- No hay medalla "por defecto" para quien no ganó ninguna categoría (se
  decidió explícitamente: sin sugerencia, el trainer puede igual asignar una
  manualmente).
- No hay límite de una medalla por categoría por quincena entre clientes.
