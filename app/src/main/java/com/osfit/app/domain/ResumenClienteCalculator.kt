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
    val conteoDias: List<ConteoDiaRutina> = emptyList()
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
     */
    fun conteoDiasEnRango(asistencias: List<Asistencia>, nombresDias: List<String>): List<ConteoDiaRutina> {
        val conteo = asistencias.mapNotNull { it.diaRutinaRealizado }
            .groupingBy { it }
            .eachCount()
        return conteo.entries
            .mapNotNull { (indice, veces) -> nombresDias.getOrNull(indice)?.let { ConteoDiaRutina(it, veces) } }
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

        val nombresDias = cliente.rutinaAsignada?.dias?.map { it.nombreDia } ?: emptyList()
        val asistenciasDelCliente = asistenciasPorCliente[cliente.id] ?: emptyList()
        val conteoDias = conteoDiasEnRango(asistenciasDelCliente, nombresDias)
        val diaFavoritoNombre = diaFavoritoEnRango(asistenciasDelCliente, nombresDias)

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

        val desgloseEsfuerzo = calcularDesgloseEsfuerzo(
            minutosEnGym = minutosEnGym,
            segundosPorEjercicio = cliente.segundosPorEjercicio,
            minutosDescanso = cliente.minutosDescanso
        )

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
            conteoDias = conteoDias
        )
    }
}
