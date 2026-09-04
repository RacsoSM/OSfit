package com.osfit.app.domain

import com.osfit.app.data.model.CategoriaMedallaAutomatica
import com.osfit.app.data.model.Cliente
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class MedallaCalculatorTest {

    private val rangoDummy = RangoResumen(
        inicio = LocalDate.of(2024, 3, 1), fin = LocalDate.of(2024, 3, 15),
        tipo = TipoResumen.QUINCENAL, encabezado = "1ra quincena de marzo"
    )
    private val primero = RankingResultado(puesto = 1, nombresPorEncima = emptyList())
    private val segundo = RankingResultado(puesto = 2, nombresPorEncima = listOf("Otro"))

    private fun resumen(
        rankingAsistencia: RankingResultado = segundo,
        rankingTiempo: RankingResultado = segundo,
        rankingRacha: RankingResultado? = segundo,
        rankingEsfuerzo: RankingResultado? = segundo,
        rankingConstancia: RankingResultado? = segundo
    ) = ResumenClienteData(
        cliente = Cliente(id = "a", nombre = "Ana"),
        rango = rangoDummy,
        diasAsistidos = 5,
        rankingAsistencia = rankingAsistencia,
        minutosEnGym = 200,
        rankingTiempo = rankingTiempo,
        diaFavoritoNombre = "Lunes",
        rachaMasLarga = 3,
        rankingRacha = rankingRacha,
        rankingEsfuerzo = rankingEsfuerzo,
        rankingConstancia = rankingConstancia
    )

    @Test
    fun `sugiere la unica categoria donde el cliente quedo en puesto 1`() {
        val resumen = resumen(rankingEsfuerzo = primero)
        assertEquals(CategoriaMedallaAutomatica.ESFUERZO, MedallaCalculator.sugerirCategoria(resumen))
    }

    @Test
    fun `sin puesto 1 en ninguna categoria no sugiere nada`() {
        assertEquals(null, MedallaCalculator.sugerirCategoria(resumen()))
    }

    @Test
    fun `con empate en varias categorias del mismo cliente usa el orden de prioridad`() {
        // Prioridad: Asistencia > Tiempo > Racha > Esfuerzo > Constancia
        val resumen = resumen(rankingRacha = primero, rankingConstancia = primero, rankingTiempo = primero)
        assertEquals(CategoriaMedallaAutomatica.TIEMPO, MedallaCalculator.sugerirCategoria(resumen))
    }

    @Test
    fun `un empate real en el numero ya deja a ambos clientes en puesto 1, sin logica extra aqui`() {
        // calcularRanking ya resuelve esto: dos clientes con el mismo valor comparten puesto 1,
        // cada uno con su propio RankingResultado(puesto = 1, ...) independiente.
        val cliente1 = resumen(rankingAsistencia = primero)
        val cliente2 = resumen(rankingAsistencia = primero)
        assertEquals(CategoriaMedallaAutomatica.ASISTENCIA, MedallaCalculator.sugerirCategoria(cliente1))
        assertEquals(CategoriaMedallaAutomatica.ASISTENCIA, MedallaCalculator.sugerirCategoria(cliente2))
    }
}
