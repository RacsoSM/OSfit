package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.roundToInt
import kotlin.random.Random

enum class TipoResumen { SEMANAL, QUINCENAL, MENSUAL }

data class RangoResumen(
    val inicio: LocalDate,
    val fin: LocalDate,
    val tipo: TipoResumen,
    val encabezado: String
)

data class RankingResultado(
    val puesto: Int,
    val nombresPorEncima: List<String>
)

data class DesgloseEsfuerzo(
    val minutosEntrenando: Int,
    val minutosDescansando: Int,
    val porcentajeEntrenando: Int
)

data class PuntoTiempoDiario(val fecha: LocalDate, val minutos: Int)

data class ConteoDiaRutina(val nombreDia: String, val veces: Int)

data class ResumenClienteData(
    val cliente: Cliente,
    val rango: RangoResumen,
    val diasAsistidos: Int,
    val rankingAsistencia: RankingResultado,
    val minutosEnGym: Int,
    val rankingTiempo: RankingResultado,
    val diaFavoritoNombre: String?,
    val rachaMasLarga: Int?,
    val rankingRacha: RankingResultado?,
    val desgloseEsfuerzo: DesgloseEsfuerzo? = null,
    // Minutos asistidos por cada día del rango, en orden (rango.inicio primero), 0 en los
    // días sin asistencia. Alimenta la gráfica de línea de la escena Tiempo del video.
    val tiempoPorDia: List<PuntoTiempoDiario> = emptyList(),
    // Cuántas veces se hizo cada día de la rutina en el rango, de mayor a menor. Alimenta la
    // gráfica de dona de la escena DiaFavorito del video.
    val conteoDias: List<ConteoDiaRutina> = emptyList(),
    // Ranking cruzado contra clientesActivos por porcentaje entrenando (DesgloseEsfuerzo).
    // null si el propio cliente no tiene segundosPorEjercicio/minutosDescanso configurados.
    val rankingEsfuerzo: RankingResultado? = null,
    // Ranking cruzado contra clientesActivos por (máximo de conteoDias) / diasAsistidos: qué
    // tan seguido repite su día más frecuente, relativo a cuánto asistió en total. null si el
    // propio cliente no tiene asistencias en el rango.
    val rankingConstancia: RankingResultado? = null
)

/**
 * Calcula el resumen de estadísticas de un cliente (asistencia, tiempo en el gym,
 * día favorito, racha) comparado contra los demás clientes activos, para un rango
 * de fechas dado. La misma máquina sirve tanto para el resumen semanal como el
 * mensual: solo cambia el [RangoResumen] que se le pasa.
 */
object ResumenClienteCalculator {

    fun numeroSemanaDelMes(fecha: LocalDate): Int {
        var contador = 0
        var dia = fecha.withDayOfMonth(1)
        while (!dia.isAfter(fecha)) {
            if (dia.dayOfWeek == DayOfWeek.FRIDAY) contador++
            dia = dia.plusDays(1)
        }
        return contador.coerceAtLeast(1)
    }

    fun rangoSemanal(fechaReferencia: LocalDate): RangoResumen {
        val lunes = fechaReferencia.minusDays((fechaReferencia.dayOfWeek.value - DayOfWeek.MONDAY.value).toLong())
        val viernes = lunes.plusDays(4)
        val nombreMes = viernes.month.getDisplayName(TextStyle.FULL, Locale("es"))
        return RangoResumen(
            inicio = lunes,
            fin = viernes,
            tipo = TipoResumen.SEMANAL,
            encabezado = "Semana ${numeroSemanaDelMes(viernes)} de $nombreMes"
        )
    }

    /**
     * Quincena de nómina: días 1-15 y 16-fin de mes, según en cuál caiga [fechaReferencia].
     */
    fun rangoQuincenal(fechaReferencia: LocalDate): RangoResumen {
        val nombreMes = fechaReferencia.month.getDisplayName(TextStyle.FULL, Locale("es"))
        return if (fechaReferencia.dayOfMonth <= 15) {
            RangoResumen(
                inicio = fechaReferencia.withDayOfMonth(1),
                fin = fechaReferencia.withDayOfMonth(15),
                tipo = TipoResumen.QUINCENAL,
                encabezado = "1ra quincena de $nombreMes"
            )
        } else {
            RangoResumen(
                inicio = fechaReferencia.withDayOfMonth(16),
                fin = YearMonth.from(fechaReferencia).atEndOfMonth(),
                tipo = TipoResumen.QUINCENAL,
                encabezado = "2da quincena de $nombreMes"
            )
        }
    }

    fun rangoMensual(mes: YearMonth): RangoResumen {
        val nombreMes = mes.month.getDisplayName(TextStyle.FULL, Locale("es"))
        return RangoResumen(
            inicio = mes.atDay(1),
            fin = mes.atEndOfMonth(),
            tipo = TipoResumen.MENSUAL,
            encabezado = "Mes de $nombreMes"
        )
    }

    /**
     * Días hábiles del rango: lunes a viernes, ignorando sábados y domingos. Es el total
     * contra el que el video compara los días asistidos ("asististe 8 días de 9 días hábiles").
     */
    fun contarDiasHabiles(rango: RangoResumen): Int {
        var contador = 0
        var dia = rango.inicio
        while (!dia.isAfter(rango.fin)) {
            if (dia.dayOfWeek != DayOfWeek.SATURDAY && dia.dayOfWeek != DayOfWeek.SUNDAY) contador++
            dia = dia.plusDays(1)
        }
        return contador
    }

    fun calcularRanking(valoresPorCliente: List<Pair<Cliente, Int>>, clienteId: String): RankingResultado {
        val grupos = valoresPorCliente
            .groupBy { it.second }
            .toSortedMap(compareByDescending { it })
        var puesto = 1
        val nombresPorEncima = mutableListOf<String>()
        var puestoDelCliente = 1
        for ((_, clientesDelGrupo) in grupos) {
            if (clientesDelGrupo.any { it.first.id == clienteId }) {
                puestoDelCliente = puesto
                break
            }
            nombresPorEncima += clientesDelGrupo.map { it.first.nombre }
            puesto += clientesDelGrupo.size
        }
        return RankingResultado(puesto = puestoDelCliente, nombresPorEncima = nombresPorEncima)
    }

    /**
     * Cuántas veces se hizo cada día de la rutina actual en [asistencias], de mayor a menor.
     * Los índices de [Asistencia.diaRutinaRealizado] que ya no existen en [nombresDias]
     * (rutina reasignada a media semana) se descartan.
     * Si varios días de la rutina tienen el mismo nombre (ej. "Pecho, hombro y tríceps"
     * como día 1 y día 4), se agrupan y suman sus ocurrencias.
     */
    fun conteoDiasEnRango(asistencias: List<Asistencia>, nombresDias: List<String>): List<ConteoDiaRutina> {
        val conteoPorIndice = asistencias.mapNotNull { it.diaRutinaRealizado }
            .groupingBy { it }
            .eachCount()
        val nombresConVeces = conteoPorIndice.entries
            .mapNotNull { (indice, veces) ->
                nombresDias.getOrNull(indice)?.takeIf { it.isNotBlank() }?.let { it to veces }
            }
        return nombresConVeces
            .groupBy { (nombre, _) -> nombre.trim().lowercase() }
            .map { (_, pares) ->
                val nombreOriginal = pares.first().first.trim()
                val totalVeces = pares.sumOf { it.second }
                ConteoDiaRutina(nombreOriginal, totalVeces)
            }
            .sortedByDescending { it.veces }
    }

    fun diaFavoritoEnRango(asistencias: List<Asistencia>, nombresDias: List<String>): String? {
        val conteo = conteoDiasEnRango(asistencias, nombresDias)
        if (conteo.isEmpty()) return null
        val maximo = conteo.first().veces
        val empatados = conteo.filter { it.veces == maximo }
        return empatados[Random.nextInt(empatados.size)].nombreDia
    }

    fun leyendaPorPuesto(puesto: Int): String = when {
        puesto == 1 -> "¡Felicidades, tú eres el mejor!"
        puesto in 2..3 -> "¡Felicidades, estás en el podio, sigue así!"
        puesto in 4..5 -> "¡Estás muy cerca del podio!"
        else -> "Échale ganitas jefe"
    }

    fun calcularDesgloseEsfuerzo(
        minutosEnGym: Int,
        segundosPorEjercicio: Int?,
        minutosDescanso: Double?
    ): DesgloseEsfuerzo? {
        if (segundosPorEjercicio == null || minutosDescanso == null) return null
        if (minutosEnGym <= 0) return null
        if (segundosPorEjercicio <= 0 || minutosDescanso < 0) return null

        val ciclo = segundosPorEjercicio + minutosDescanso * 60
        if (ciclo <= 0) return null

        val fraccion = segundosPorEjercicio / ciclo
        val minutosEntrenando = (minutosEnGym * fraccion).roundToInt()
        val minutosDescansando = minutosEnGym - minutosEntrenando
        val porcentajeEntrenando = (fraccion * 100).roundToInt()

        return DesgloseEsfuerzo(
            minutosEntrenando = minutosEntrenando,
            minutosDescansando = minutosDescansando,
            porcentajeEntrenando = porcentajeEntrenando
        )
    }

    /**
     * Minutos asistidos por cada día de [rango.inicio] a [rango.fin] (ambos incluidos),
     * en orden cronológico, 0 en los días sin asistencia. [asistenciasCliente] puede traer
     * registros no asistidos (soborno) o de fuera del rango; se filtran acá.
     */
    fun tiempoPorDiaEnRango(asistenciasCliente: List<Asistencia>, rango: RangoResumen): List<PuntoTiempoDiario> {
        val minutosPorFecha = asistenciasCliente
            .filter { it.asistio }
            .groupingBy { it.fecha }
            .fold(0) { acumulado, asistencia -> acumulado + (asistencia.duracionMinutos ?: 0) }
        return generateSequence(rango.inicio) { it.plusDays(1) }
            .takeWhile { !it.isAfter(rango.fin) }
            .map { fecha -> PuntoTiempoDiario(fecha, minutosPorFecha[fecha.toString()] ?: 0) }
            .toList()
    }

    fun calcularResumenCliente(
        cliente: Cliente,
        clientesActivos: List<Cliente>,
        asistenciasEnRango: List<Asistencia>,
        rango: RangoResumen
    ): ResumenClienteData {
        val asistenciasPorCliente = asistenciasEnRango.filter { it.asistio }.groupBy { it.clienteId }

        val diasAsistidos = asistenciasPorCliente[cliente.id]?.size ?: 0
        val valoresAsistencia = clientesActivos.map { c -> c to (asistenciasPorCliente[c.id]?.size ?: 0) }
        val rankingAsistencia = calcularRanking(valoresAsistencia, cliente.id)

        val minutosEnGym = asistenciasPorCliente[cliente.id]?.sumOf { it.duracionMinutos ?: 0 } ?: 0
        val valoresTiempo = clientesActivos.map { c ->
            c to (asistenciasPorCliente[c.id]?.sumOf { a -> a.duracionMinutos ?: 0 } ?: 0)
        }
        val rankingTiempo = calcularRanking(valoresTiempo, cliente.id)

        val desgloseEsfuerzo = calcularDesgloseEsfuerzo(
            minutosEnGym = minutosEnGym,
            segundosPorEjercicio = cliente.segundosPorEjercicio,
            minutosDescanso = cliente.minutosDescanso
        )
        // Solo compara contra clientes que también tengan segundos/descanso configurados: el
        // porcentaje entrenando no es comparable si al otro cliente le falta ese dato.
        val valoresEsfuerzo = clientesActivos.mapNotNull { c ->
            val minutosC = asistenciasPorCliente[c.id]?.sumOf { it.duracionMinutos ?: 0 } ?: 0
            calcularDesgloseEsfuerzo(minutosC, c.segundosPorEjercicio, c.minutosDescanso)?.let { c to it.porcentajeEntrenando }
        }
        val rankingEsfuerzo = if (desgloseEsfuerzo != null) calcularRanking(valoresEsfuerzo, cliente.id) else null

        val nombresDias = cliente.rutinaAsignada?.dias?.map { it.nombreDia } ?: emptyList()
        val asistenciasDelCliente = asistenciasPorCliente[cliente.id] ?: emptyList()
        val conteoDias = conteoDiasEnRango(asistenciasDelCliente, nombresDias)
        val diaFavoritoNombre = diaFavoritoEnRango(asistenciasDelCliente, nombresDias)

        // Constancia: qué tan seguido repite su día más frecuente, relativo a cuánto asistió en
        // total (si no, quien asiste más siempre ganaría solo por acumular más repeticiones).
        // Escalado a entero (x1000) porque calcularRanking compara valores Int.
        val valoresConstancia = clientesActivos.mapNotNull { c ->
            val asistenciasC = asistenciasPorCliente[c.id] ?: emptyList()
            if (asistenciasC.isEmpty()) return@mapNotNull null
            val nombresDiasC = c.rutinaAsignada?.dias?.map { it.nombreDia } ?: emptyList()
            val maximoC = conteoDiasEnRango(asistenciasC, nombresDiasC).maxOfOrNull { it.veces } ?: 0
            c to (maximoC * 1000 / asistenciasC.size)
        }
        val rankingConstancia = if (diasAsistidos > 0) calcularRanking(valoresConstancia, cliente.id) else null

        var rachaMasLarga: Int? = null
        var rankingRacha: RankingResultado? = null
        if (rango.tipo == TipoResumen.MENSUAL || rango.tipo == TipoResumen.QUINCENAL) {
            // La racha es lo único donde una falta justificada ("soborno") cuenta como
            // asistencia, así que se parte de todos los registros, no solo de los asistidos.
            val registrosPorCliente = asistenciasEnRango.groupBy { it.clienteId }
            val fechasCliente = RachaCalculator.fechasQueCuentan(registrosPorCliente[cliente.id].orEmpty())
            rachaMasLarga = RachaCalculator.calcularRachaMasLargaEnRango(fechasCliente, rango.inicio, rango.fin)
            val valoresRacha = clientesActivos.map { c ->
                val fechas = RachaCalculator.fechasQueCuentan(registrosPorCliente[c.id].orEmpty())
                c to RachaCalculator.calcularRachaMasLargaEnRango(fechas, rango.inicio, rango.fin)
            }
            rankingRacha = calcularRanking(valoresRacha, cliente.id)
        }

        val tiempoPorDia = tiempoPorDiaEnRango(
            asistenciasEnRango.filter { it.clienteId == cliente.id },
            rango
        )

        return ResumenClienteData(
            cliente = cliente,
            rango = rango,
            diasAsistidos = diasAsistidos,
            rankingAsistencia = rankingAsistencia,
            minutosEnGym = minutosEnGym,
            rankingTiempo = rankingTiempo,
            diaFavoritoNombre = diaFavoritoNombre,
            rachaMasLarga = rachaMasLarga,
            rankingRacha = rankingRacha,
            desgloseEsfuerzo = desgloseEsfuerzo,
            tiempoPorDia = tiempoPorDia,
            conteoDias = conteoDias,
            rankingEsfuerzo = rankingEsfuerzo,
            rankingConstancia = rankingConstancia
        )
    }
}
