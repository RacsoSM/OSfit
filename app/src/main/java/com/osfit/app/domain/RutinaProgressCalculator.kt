package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.DiaDenormalizado
import java.time.LocalDate

/**
 * Determina qué día del ciclo de rutina le toca a un cliente.
 *
 * La fuente de verdad es el historial de asistencias (Calendario-Rutina): el día se
 * deduce del último día registrado, no se guarda en el cliente. "Asignar día" deja un
 * ancla que manda solo mientras no haya asistencias posteriores a su fecha.
 *
 * [Cliente.diaAnclaFecha] es **exclusiva**: el historial toma el mando estrictamente
 * después de ella. Por eso [AsignarDiaManual] fecha el ancla en el día anterior a la
 * corrección — así la asistencia del mismo día ya cuenta y el ciclo avanza al día
 * siguiente en vez de quedarse trabado en el día asignado.
 */
object RutinaProgressCalculator {

    /**
     * Día anterior a que Calendario-Rutina pasara a ser la fuente de verdad.
     *
     * Los clientes creados antes de ese cambio no tienen [Cliente.diaAnclaFecha]: su día
     * se congela evaluando la fórmula vieja en el día siguiente a esta fecha, y a partir
     * de aquí manda el historial. Congelar (en vez de recalcular desde el historial
     * completo) evita que a nadie le cambie el día al actualizar la app.
     */
    const val FECHA_CORTE = "2026-09-01"

    /** Día del ancla y la última fecha que cubre (exclusiva), para clientes viejos y nuevos. */
    private data class Ancla(val dia: Int, val fecha: String)

    private fun anclaDe(cliente: Cliente): Ancla {
        val fechaAncla = cliente.diaAnclaFecha
        if (fechaAncla != null) return Ancla(cliente.diaActualIndex, fechaAncla)

        // Cliente anterior al cambio: se congela con la fórmula vieja, evaluada un día
        // después del corte para que los pendientes de esa fecha o anteriores ya hayan
        // vencido y queden contados aquí en vez de en el historial.
        val diaCongelado = diaEfectivoLegacy(
            diaActualIndex = cliente.diaActualIndex,
            diaPendienteIndex = cliente.diaPendienteIndex,
            diaPendienteFecha = cliente.diaPendienteFecha,
            hoy = LocalDate.parse(FECHA_CORTE).plusDays(1).toString()
        )
        return Ancla(diaCongelado, FECHA_CORTE)
    }

    /**
     * Fórmula anterior al cambio, conservada solo para congelar el día de los clientes
     * que ya existían. No usar para lógica nueva.
     */
    private fun diaEfectivoLegacy(
        diaActualIndex: Int,
        diaPendienteIndex: Int?,
        diaPendienteFecha: String?,
        hoy: String
    ): Int = if (diaPendienteIndex != null && diaPendienteFecha != null && hoy > diaPendienteFecha) {
        diaPendienteIndex
    } else {
        diaActualIndex
    }

    /**
     * El ancla que manda de verdad hoy.
     *
     * Con [reinicioSemanal], nunca puede ser anterior al domingo pasado: eso es todo lo que
     * hace falta para que el día sea "la N-ésima asistencia de la semana", porque el ancla ya
     * es exclusiva y `diaQueToca` ya ignora todo lo anterior a ella.
     *
     * Un ancla manual de esta misma semana sobrevive la comparación y manda hasta el domingo,
     * que es cuando el corrimiento la barre sola. No hay nada que borrar ni que programar.
     */
    private fun anclaEfectiva(ancla: Ancla, hoy: String, reinicioSemanal: Boolean): Ancla {
        if (!reinicioSemanal) return ancla
        val domingo = SemanaDeRutina.domingoAnterior(hoy)
        return if (ancla.fecha >= domingo) ancla else Ancla(dia = 0, fecha = domingo)
    }

    /**
     * Día del ciclo que le toca al cliente en [hoy].
     *
     * Toma la asistencia más reciente posterior al ancla: si es de hoy, es el día que está
     * haciendo hoy; si es anterior, le toca el siguiente del ciclo. Las faltas guardan
     * `diaRutinaRealizado = null`, así que quedan fuera por construcción y no avanzan el ciclo.
     *
     * Con [com.osfit.app.data.model.Rutina.reinicioSemanal] cambian dos cosas: el ancla nunca
     * es anterior al domingo pasado (ver [anclaEfectiva]), y el ciclo no da la vuelta —después
     * del último día viene [DiaQueToca.Descanso], no el primero—. Juntas hacen que el día sea
     * la N-ésima asistencia de la semana.
     *
     * [asistenciasDelCliente] puede traer asistencias de cualquier fecha; se filtran aquí.
     */
    fun diaQueToca(cliente: Cliente, asistenciasDelCliente: List<Asistencia>, hoy: String): DiaQueToca {
        val rutina = cliente.rutinaAsignada ?: return DiaQueToca.SinRutina
        val totalDias = rutina.dias.size
        if (totalDias <= 0) return DiaQueToca.SinRutina

        val ancla = anclaEfectiva(anclaDe(cliente), hoy, rutina.reinicioSemanal)

        val ultima = asistenciasDelCliente
            .filter { it.clienteId == cliente.id || cliente.id.isEmpty() }
            .filter { it.asistio && it.diaRutinaRealizado != null }
            .filter { it.fecha > ancla.fecha && it.fecha <= hoy }
            .maxByOrNull { it.fecha }
            ?: return DiaQueToca.Dia(ancla.dia.coerceIn(0, totalDias - 1))

        val realizado = ultima.diaRutinaRealizado!!.coerceIn(0, totalDias - 1)
        return when {
            ultima.fecha == hoy -> DiaQueToca.Dia(realizado)
            rutina.reinicioSemanal && realizado + 1 >= totalDias -> DiaQueToca.Descanso
            else -> DiaQueToca.Dia(siguienteDia(realizado, totalDias))
        }
    }

    /** Versión de conveniencia para "hoy" real. */
    fun diaQueToca(cliente: Cliente, asistenciasDelCliente: List<Asistencia>): DiaQueToca =
        diaQueToca(cliente, asistenciasDelCliente, LocalDate.now().toString())

    /**
     * Comprime el estado del cliente en el trío que la web interpreta, para que no tenga que
     * reimplementar [diaQueToca] en TypeScript. Vive en este archivo, y no en una clase
     * aparte, para que comparta [anclaDe] con el cálculo real: es lo que hace estructuralmente
     * imposible que las dos versiones se separen.
     *
     * Contrato, verificado en `DiaDenormalizadoTest`: para toda fecha `d >= hoy`,
     * `interpretar(denormalizar(c, a, hoy), totalDias, d) == diaQueToca(c, a, d)`, mientras no
     * haya asistencias posteriores a [hoy] ni escrituras nuevas.
     *
     * Las asistencias posteriores a [hoy] se ignoran igual que en [diaQueToca]. Si el
     * entrenador registra una fecha futura, el trío no la refleja hasta la siguiente
     * escritura — la web muestra un día viejo, nunca uno inventado.
     */
    fun denormalizar(
        cliente: Cliente,
        asistenciasDelCliente: List<Asistencia>,
        hoy: String
    ): DiaDenormalizado {
        val rutina = cliente.rutinaAsignada ?: return DiaDenormalizado()
        val totalDias = rutina.dias.size
        if (totalDias <= 0) return DiaDenormalizado()

        val ancla = anclaEfectiva(anclaDe(cliente), hoy, rutina.reinicioSemanal)

        val ultima = asistenciasDelCliente
            .filter { it.clienteId == cliente.id || cliente.id.isEmpty() }
            .filter { it.asistio && it.diaRutinaRealizado != null }
            .filter { it.fecha > ancla.fecha && it.fecha <= hoy }
            .maxByOrNull { it.fecha }
            ?: return DiaDenormalizado(
                dia = ancla.dia.coerceIn(0, totalDias - 1),
                fecha = ancla.fecha,
                esAncla = true
            )

        return DiaDenormalizado(
            dia = ultima.diaRutinaRealizado!!.coerceIn(0, totalDias - 1),
            fecha = ultima.fecha,
            esAncla = false
        )
    }

    /**
     * Interpreta el trío de [denormalizar]. Es la referencia de las pocas líneas que corre la
     * web: si cambia acá, hay que cambiar `web/src/dia.ts`.
     *
     * El cruce de semana se decide **antes** que el ancla, porque con [reinicioSemanal] un
     * ancla de la semana pasada también tiene que reiniciarse.
     */
    fun interpretar(
        valor: DiaDenormalizado,
        totalDias: Int,
        fecha: String,
        reinicioSemanal: Boolean = false
    ): DiaQueToca {
        val dia = valor.dia ?: return DiaQueToca.SinRutina
        if (totalDias <= 0) return DiaQueToca.SinRutina
        val acotado = dia.coerceIn(0, totalDias - 1)
        val fechaValor = valor.fecha

        if (reinicioSemanal && fechaValor != null &&
            SemanaDeRutina.lunesDe(fechaValor) < SemanaDeRutina.lunesDe(fecha)
        ) return DiaQueToca.Dia(0)

        if (valor.esAncla) return DiaQueToca.Dia(acotado)
        if (fechaValor == fecha) return DiaQueToca.Dia(acotado)
        if (reinicioSemanal && acotado + 1 >= totalDias) return DiaQueToca.Descanso
        return DiaQueToca.Dia(siguienteDia(acotado, totalDias))
    }

    /** Siguiente día del ciclo, dando la vuelta al llegar al final. */
    fun siguienteDia(diaRealizado: Int, totalDias: Int): Int {
        require(totalDias > 0) { "totalDias debe ser mayor a 0, fue $totalDias" }
        val siguiente = diaRealizado + 1
        return if (siguiente >= totalDias) 0 else siguiente
    }
}
