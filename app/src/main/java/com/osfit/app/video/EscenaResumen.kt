package com.osfit.app.video

import android.graphics.Bitmap
import com.osfit.app.data.model.CategoriaMedallaAutomatica
import com.osfit.app.domain.ConteoDiaRutina
import com.osfit.app.domain.DesgloseEsfuerzo
import com.osfit.app.domain.PuntoTiempoDiario
import com.osfit.app.domain.RankingResultado

sealed class EscenaResumen {
    data class Saludo(val nombreCliente: String) : EscenaResumen()
    data class Asistencia(
        val encabezadoRango: String,
        val dias: Int,
        val unidad: String,
        val ranking: RankingResultado
    ) : EscenaResumen()
    data class Tiempo(
        val minutos: Int,
        val ranking: RankingResultado,
        // Minutos por día del rango, en orden; alimenta la gráfica de línea de la escena.
        val tiempoPorDia: List<PuntoTiempoDiario> = emptyList()
    ) : EscenaResumen()
    data class Esfuerzo(
        val minutosTotales: Int,
        val desglose: DesgloseEsfuerzo
    ) : EscenaResumen()
    data class DiaFavorito(
        val nombreDia: String?,
        val unidad: String,
        val diasAsistidos: Int,
        // Cuántas veces se hizo cada día de rutina en el rango, de mayor a menor; alimenta la
        // gráfica de dona de la escena.
        val conteoDias: List<ConteoDiaRutina> = emptyList()
    ) : EscenaResumen()
    data class RachaMasLarga(val dias: Int, val ranking: RankingResultado) : EscenaResumen()
    data class Medalla(
        // null = no se otorgó ninguna medalla ("Sin medalla"): no se dibuja imagen ni nombre,
        // solo mensaje.
        val nombre: String?,
        // null = medalla subjetiva, o no se otorgó ninguna; usada para elegir el color/glifo de
        // la insignia por defecto cuando no hay imagenPersonalizada.
        val categoria: CategoriaMedallaAutomatica?,
        val imagenPersonalizada: Bitmap?,
        // Ya con "$nombrePersona" reemplazado por el nombre del cliente. Puede venir vacío si
        // la medalla no tiene mensaje configurado.
        val mensaje: String
    ) : EscenaResumen()

    /** Un logro personal ya resuelto para dibujar: bitmap decodificado y mensaje con
     *  "$nombrePersona" reemplazado. */
    data class LogroEnEscena(
        val nombre: String,
        val imagen: Bitmap?,
        // Sólo se dibuja cuando su escena trae un único logro: con 2 o 3 no cabe legible.
        val mensaje: String
    )

    /** Entre 1 y 3 logros personales otorgados en la quincena. Si se otorgaron más, el
     *  generador arma varias escenas de a 3 (ver ResumenVideoGenerator.construirEscenas). */
    data class LogrosPersonales(val logros: List<LogroEnEscena>) : EscenaResumen()

    object Despedida : EscenaResumen()
}
