package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class Cliente(
    val id: String = "",
    val nombre: String = "",
    val telefono: String = "",
    val activo: Boolean = true,
    val rutinaAsignada: Rutina? = null,
    val plantillaOrigenId: String = "",
    // Ancla de "Asignar día": el día asignado manualmente y desde cuándo vale. El día que
    // le toca al cliente se deduce del historial de asistencias (Calendario-Rutina); el
    // ancla solo manda mientras no haya asistencias posteriores a su fecha.
    val diaActualIndex: Int = 0,
    val diaAnclaFecha: String? = null,
    // Obsoletos: ya no se escriben. Se conservan solo para congelar el día de los clientes
    // que existían antes de que Calendario-Rutina pasara a ser la fuente de verdad.
    // Ver RutinaProgressCalculator.FECHA_CORTE.
    @Deprecated("Reemplazado por la derivación desde asistencias")
    val diaPendienteIndex: Int? = null,
    @Deprecated("Reemplazado por la derivación desde asistencias")
    val diaPendienteFecha: String? = null,
    val fechaProximoPago: Timestamp? = null,
    val fechaIngreso: Timestamp? = null,
    val ejercicioFavoritoPorDia: Map<String, String> = emptyMap(),
    /**
     * Peso o nota **de esta clienta** para un ejercicio, indexado por el nombre normalizado
     * (ver `domain/PesosPropios.kt`). Existe porque `pesoONota` vive dentro de la plantilla y
     * por tanto es el mismo para todas las que la siguen: el ejercicio es del programa, pero el
     * peso es de la persona.
     *
     * **Sólo se aplica mientras [plantillaOrigenId] tenga valor.** En rutina propia manda
     * [rutinaAsignada], y aplicarlo encima pisaría lo que el entrenador escribió en su editor.
     * Se conserva aunque se desprenda, para que vuelva a servir si algún día regresa al grupo.
     */
    val pesoPorEjercicio: Map<String, String> = emptyMap(),
    val diaFavoritoIndex: Int? = null,
    val peso: Double? = null,
    val altura: Double? = null,
    val edad: Int? = null,
    /**
     * "H" o "M": qué mapa muscular le toca en la web (frente y espalda de hombre o de mujer).
     * Lo elige el entrenador en "Editar cliente". null = clienta anterior al campo o sin
     * elegir; la web le muestra un aviso en vez del mapa. Ver [Sexo].
     */
    val sexo: String? = null,
    val segundosPorEjercicio: Int? = null,
    val minutosDescanso: Double? = null,
    // Nombre del archivo dentro de filesDir/canciones/ (no la URI original: se copia al
    // elegirla para no depender de un permiso de content:// que puede revocarse).
    val cancionArchivo: String? = null,
    // Ruta del respaldo en Storage, `canciones/<clienteId>.<ext>`. Se guarda la ruta y no la
    // URL de descarga por el mismo motivo que los resúmenes: una URL permanente dentro del
    // documento vale sin sesión. null = clienta anterior a este campo, o subida que falló;
    // en los dos casos no hay nada que restaurar.
    val cancionRuta: String? = null,
    val cancionInicioSegundos: Int? = null,
    // Resultado denormalizado de RutinaProgressCalculator.denormalizar(), solo para que la
    // web no reimplemente el cálculo. La app **no** lee estos campos: sigue llamando al
    // calculador. Así un valor viejo degrada la web pero no puede corromper nada.
    val ultimoDia: Int? = null,
    val ultimoDiaFecha: String? = null,
    val ultimoDiaEsAncla: Boolean = false,
    // Comodidad de UI: si está desincronizado, la ficha ofrece "Compartir" en vez de
    // "Copiar link". La verdad sobre el acceso vive en la colección accesosWeb.
    val tieneAccesoWeb: Boolean = false,
    // Si la web le muestra la tarjeta "Tu periodo vence en X días". Apagado por defecto: el
    // entrenador lo prende solo para las clientas a las que quiere recordarles el pago.
    val recordatorioPago: Boolean = false,
    // Llave del entrenador para las notificaciones de la web. Apagada por defecto: solo
    // reciben avisos las clientas que él habilite, además de que ellas den permiso en su
    // teléfono. La función `enviarNotificacion` la vuelve a revisar al enviar.
    val notificacionesWeb: Boolean = false,
    // Qué avisos automáticos le llegan, por llave de [AvisoAutomatico]. Ausente = apagado. Solo
    // salen además con [notificacionesWeb] prendido: esa llave sigue mandando sobre todo.
    val avisosAutomaticos: Map<String, Boolean> = emptyMap()
)
