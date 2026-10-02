package com.osfit.app.video

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.PI

/** Geometría en minutos, sin promediar ni alterar los datos entregados por el generador. */
internal object GeometriaMancu {
    private val formato = DateTimeFormatter.ofPattern("dd/MM")
    fun fechaEje(fecha: LocalDate): String = fecha.format(formato)
    fun maximoGrafica(minutos: List<Int>): Int = maxOf(120, minutos.maxOrNull() ?: 0)
    fun yGrafica(minutos: Int, maximo: Int, arriba: Float, abajo: Float): Float =
        abajo - minutos.toFloat() / maximo * (abajo - arriba)
    fun barridoDona(veces: Int, total: Int): Float = if (total > 0) veces.toFloat() / total * 360f else 0f
    fun partirNombreDia(nombre: String): List<String> {
        if (nombre.length <= 12) return listOf(nombre)
        val espacio = nombre.indices.filter { nombre[it] == ' ' }.minByOrNull { abs(it - nombre.length / 2) }
        return if (espacio == null) listOf(nombre.take(12), nombre.drop(12))
        else listOf(nombre.substring(0, espacio).trim(), nombre.substring(espacio + 1).trim())
    }
    // Un ciclo suave de 1.2 s mantiene los pies quietos al escalar desde su apoyo.
    fun sentadilla(tMs: Long): Float = (0.5 - 0.5 * cos(2 * PI * Math.floorMod(tMs, 1200L) / 1200.0)).toFloat()
    fun salida(tMs: Long): Float = ((tMs - 4500L) / 1500f).coerceIn(0f, 1f)
}
