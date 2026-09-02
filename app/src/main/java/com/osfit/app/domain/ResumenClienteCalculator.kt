package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale
import kotlin.random.Random

enum class TipoResumen { SEMANAL, MENSUAL }

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

data class ResumenClienteData(
    val cliente: Cliente,
    val rango: RangoResumen,
    val diasAsistidos: Int,
    val rankingAsistencia: RankingResultado,
    val minutosEnGym: Int,
    val rankingTiempo: RankingResultado,
    val diaFavoritoNombre: String?,
    val rachaMasLarga: Int?,
    val rankingRacha: RankingResultado?
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

    fun diaFavoritoEnRango(asistencias: List<Asistencia>, nombresDias: List<String>): String? {
        val conteo = asistencias.mapNotNull { it.diaRutinaRealizado }
            .groupingBy { it }
            .eachCount()
        if (conteo.isEmpty()) return null
        val maximo = conteo.values.max()
        val empatados = conteo.filterValues { it == maximo }.keys.toList()
        val indiceElegido = empatados[Random.nextInt(empatados.size)]
        return nombresDias.getOrNull(indiceElegido)
    }

    fun leyendaPorPuesto(puesto: Int): String = when {
        puesto == 1 -> "¡Felicidades, tú eres el mejor!"
        puesto in 2..3 -> "¡Felicidades, estás en el podio, sigue así!"
        puesto in 4..5 -> "¡Estás muy cerca del podio!"
        else -> "Échale ganitas jefe"
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
        val diaFavoritoNombre = diaFavoritoEnRango(asistenciasPorCliente[cliente.id] ?: emptyList(), nombresDias)

        var rachaMasLarga: Int? = null
        var rankingRacha: RankingResultado? = null
        if (rango.tipo == TipoResumen.MENSUAL) {
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

        return ResumenClienteData(
            cliente = cliente,
            rango = rango,
            diasAsistidos = diasAsistidos,
            rankingAsistencia = rankingAsistencia,
            minutosEnGym = minutosEnGym,
            rankingTiempo = rankingTiempo,
            diaFavoritoNombre = diaFavoritoNombre,
            rachaMasLarga = rachaMasLarga,
            rankingRacha = rankingRacha
        )
    }
}
