package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import java.time.LocalDate
import java.time.YearMonth

/**
 * El color de cada día del Calendario: qué porcentaje de sus clientes fue ese día.
 *
 * Dos reglas del entrenador (2026-10-21):
 * - **Contra los clientes que había ese día**, no contra los activos de hoy. Antes, con más
 *   clientes hoy que hace meses, los días viejos salían en rojo aunque hubieran ido casi todos.
 * - **Sin los que entrenan a distancia**, ni en el total ni en los que fueron: no vienen al
 *   gimnasio, así que solo bajarían el porcentaje.
 *
 * No se guarda cuándo se dio de baja alguien, y la fecha de ingreso no siempre está. Por eso un
 * cliente cuenta desde su ingreso o desde su primera asistencia registrada (lo que sea antes)
 * y, si ya está inactivo, hasta su último registro. Uno activo sin ingreso ni registros cuenta
 * desde hoy: antes no hay nada que diga que ya estaba.
 */
object AsistenciaCalendario {

    enum class Nivel { SIN_DATOS, BAJA, MEDIA, BUENA }

    /** Lo que se necesita de cada cliente. `ingreso` ya convertido al día local. */
    data class ClienteDelCalendario(
        val id: String,
        val activo: Boolean,
        val aDistancia: Boolean,
        val ingreso: LocalDate?
    )

    /** Desde cuándo y hasta cuándo cuenta un cliente; null si nunca cuenta. */
    private fun periodo(
        c: ClienteDelCalendario,
        fechas: List<LocalDate>,
        hoy: LocalDate
    ): ClosedRange<LocalDate>? {
        if (c.aDistancia) return null
        val primera = fechas.minOrNull()
        val inicio = listOfNotNull(c.ingreso, primera).minOrNull() ?: if (c.activo) hoy else return null
        val fin = if (c.activo) LocalDate.MAX else fechas.maxOrNull() ?: return null
        return if (inicio <= fin) inicio..fin else null
    }

    /** Los clientes que cuentan cada día del mes y cuántos de ellos fueron, sin los de a distancia. */
    fun conteoDelMes(
        clientes: List<ClienteDelCalendario>,
        asistencias: List<Asistencia>,
        mes: YearMonth,
        hoy: LocalDate
    ): Map<LocalDate, Pair<Int, Int>> {
        val porCliente = asistencias.groupBy { it.clienteId }
        val periodos = clientes.mapNotNull { c ->
            val fechas = porCliente[c.id].orEmpty().mapNotNull { runCatching { LocalDate.parse(it.fecha) }.getOrNull() }
            periodo(c, fechas, hoy)?.let { c.id to it }
        }.toMap()
        val fueron = asistencias.filter { it.asistio && it.clienteId in periodos }.groupBy { it.fecha }
        return (1..mes.lengthOfMonth()).associate { dia ->
            val fecha = mes.atDay(dia)
            val total = periodos.values.count { fecha in it }
            val asistieron = fueron[fecha.toString()].orEmpty()
                .map { it.clienteId }.distinct()
                .count { periodos[it]?.contains(fecha) == true }
            fecha to (asistieron to total)
        }
    }

    fun nivelesDelMes(
        clientes: List<ClienteDelCalendario>,
        asistencias: List<Asistencia>,
        mes: YearMonth,
        hoy: LocalDate
    ): Map<LocalDate, Nivel> = conteoDelMes(clientes, asistencias, mes, hoy).mapValues { (_, conteo) ->
        val (asistieron, total) = conteo
        if (asistieron == 0 || total == 0) return@mapValues Nivel.SIN_DATOS
        val porcentaje = asistieron.toDouble() / total
        when {
            porcentaje >= 0.65 -> Nivel.BUENA
            porcentaje >= 0.35 -> Nivel.MEDIA
            else -> Nivel.BAJA
        }
    }
}
