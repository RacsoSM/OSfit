package com.osfit.app.video

import com.osfit.app.domain.DesgloseEsfuerzo
import com.osfit.app.domain.RankingResultado

sealed class EscenaResumen {
    data class Saludo(val nombreCliente: String) : EscenaResumen()
    data class Asistencia(
        val encabezadoRango: String,
        val dias: Int,
        val unidad: String,
        val ranking: RankingResultado
    ) : EscenaResumen()
    data class Tiempo(val minutos: Int, val ranking: RankingResultado) : EscenaResumen()
    data class Esfuerzo(
        val minutosTotales: Int,
        val desglose: DesgloseEsfuerzo
    ) : EscenaResumen()
    data class DiaFavorito(val nombreDia: String?, val unidad: String, val diasAsistidos: Int) : EscenaResumen()
    data class RachaMasLarga(val dias: Int, val ranking: RankingResultado) : EscenaResumen()
}
