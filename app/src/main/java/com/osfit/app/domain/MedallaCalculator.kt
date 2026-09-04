package com.osfit.app.domain

import com.osfit.app.data.model.CategoriaMedallaAutomatica
import com.osfit.app.data.model.CategoriaMedallaAutomatica.ASISTENCIA
import com.osfit.app.data.model.CategoriaMedallaAutomatica.CONSTANCIA
import com.osfit.app.data.model.CategoriaMedallaAutomatica.ESFUERZO
import com.osfit.app.data.model.CategoriaMedallaAutomatica.RACHA
import com.osfit.app.data.model.CategoriaMedallaAutomatica.TIEMPO

/**
 * Decide qué categoría de medalla automática sugerir para un cliente, a partir de los
 * rankings ya calculados en su propio [ResumenClienteData] (comparados contra los demás
 * clientes activos por [ResumenClienteCalculator.calcularResumenCliente]). Un empate real en
 * el número ya deja a más de un cliente en puesto 1 -eso lo resuelve `calcularRanking`-, así
 * que esta función solo decide, para ESTE cliente, cuál de sus categorías en puesto 1 mostrar
 * cuando ganó más de una.
 */
object MedallaCalculator {

    // Orden de prioridad fijo para desempatar entre categorías del MISMO cliente cuando quedó
    // en puesto 1 en más de una — nunca desempata entre personas.
    private val PRIORIDAD = listOf(ASISTENCIA, TIEMPO, RACHA, ESFUERZO, CONSTANCIA)

    fun sugerirCategoria(resumen: ResumenClienteData): CategoriaMedallaAutomatica? {
        val candidatas = buildSet {
            if (resumen.rankingAsistencia.puesto == 1) add(ASISTENCIA)
            if (resumen.rankingTiempo.puesto == 1) add(TIEMPO)
            if (resumen.rankingRacha?.puesto == 1) add(RACHA)
            if (resumen.rankingEsfuerzo?.puesto == 1) add(ESFUERZO)
            if (resumen.rankingConstancia?.puesto == 1) add(CONSTANCIA)
        }
        return PRIORIDAD.firstOrNull { it in candidatas }
    }
}
