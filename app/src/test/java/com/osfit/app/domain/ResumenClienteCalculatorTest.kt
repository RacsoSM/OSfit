package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Rutina
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class ResumenClienteCalculatorTest {

    @Test
    fun `numeroSemanaDelMes cuenta los viernes transcurridos en el mes`() {
        assertEquals(1, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 1)))
        assertEquals(2, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 8)))
        assertEquals(3, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 15)))
        assertEquals(5, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 29)))
    }

    @Test
    fun `numeroSemanaDelMes con una fecha que no es viernes cuenta los viernes ya pasados`() {
        // 20 de marzo 2024 es miércoles; ya pasaron los viernes 1, 8 y 15 (3 viernes)
        assertEquals(3, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 20)))
    }

    @Test
    fun `rangoSemanal arma el rango lunes-viernes de la semana de la fecha dada`() {
        // 20 de marzo 2024 es miércoles, su semana va del 18 (lunes) al 22 (viernes)
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        assertEquals(LocalDate.of(2024, 3, 18), rango.inicio)
        assertEquals(LocalDate.of(2024, 3, 22), rango.fin)
        assertEquals(TipoResumen.SEMANAL, rango.tipo)
        assertEquals("Semana 4 de marzo", rango.encabezado)
    }

    @Test
    fun `rangoMensual arma el rango del mes completo`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        assertEquals(LocalDate.of(2024, 3, 1), rango.inicio)
        assertEquals(LocalDate.of(2024, 3, 31), rango.fin)
        assertEquals(TipoResumen.MENSUAL, rango.tipo)
        assertEquals("Mes de marzo", rango.encabezado)
    }

    @Test
    fun `contarDiasHabiles ignora sabados y domingos`() {
        // La semana lunes-viernes son 5 días hábiles.
        val semana = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        assertEquals(5, ResumenClienteCalculator.contarDiasHabiles(semana))

        // Marzo 2024: 31 días, 5 sábados y 5 domingos.
        val mes = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        assertEquals(21, ResumenClienteCalculator.contarDiasHabiles(mes))

        // 1ra quincena de marzo 2024: del viernes 1 al viernes 15, con 2 fines de semana.
        val quincena = ResumenClienteCalculator.rangoQuincenal(LocalDate.of(2024, 3, 8))
        assertEquals(11, ResumenClienteCalculator.contarDiasHabiles(quincena))
    }

    @Test
    fun `rangoQuincenal arma el 1-15 cuando la fecha cae en la primera mitad del mes`() {
        val rango = ResumenClienteCalculator.rangoQuincenal(LocalDate.of(2024, 3, 8))
        assertEquals(LocalDate.of(2024, 3, 1), rango.inicio)
        assertEquals(LocalDate.of(2024, 3, 15), rango.fin)
        assertEquals(TipoResumen.QUINCENAL, rango.tipo)
        assertEquals("1ra quincena de marzo", rango.encabezado)
    }

    @Test
    fun `rangoQuincenal arma el 16-fin de mes cuando la fecha cae en la segunda mitad del mes`() {
        val rango = ResumenClienteCalculator.rangoQuincenal(LocalDate.of(2024, 3, 20))
        assertEquals(LocalDate.of(2024, 3, 16), rango.inicio)
        assertEquals(LocalDate.of(2024, 3, 31), rango.fin)
        assertEquals(TipoResumen.QUINCENAL, rango.tipo)
        assertEquals("2da quincena de marzo", rango.encabezado)
    }

    @Test
    fun `tiempoPorDiaEnRango arma un valor por cada dia del rango, 0 sin asistencia`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val asistencias = listOf(
            Asistencia(clienteId = "c1", fecha = "2024-03-18", asistio = true, duracionMinutos = 45),
            Asistencia(clienteId = "c1", fecha = "2024-03-20", asistio = true, duracionMinutos = 60),
            // No asistió: no debe sumar aunque tenga duracionMinutos.
            Asistencia(clienteId = "c1", fecha = "2024-03-21", asistio = false, duracionMinutos = 30)
        )

        val resultado = ResumenClienteCalculator.tiempoPorDiaEnRango(asistencias, rango)

        assertEquals(listOf(45, 0, 60, 0, 0), resultado.map { it.minutos })
        assertEquals(
            listOf(
                LocalDate.of(2024, 3, 18), LocalDate.of(2024, 3, 19), LocalDate.of(2024, 3, 20),
                LocalDate.of(2024, 3, 21), LocalDate.of(2024, 3, 22)
            ),
            resultado.map { it.fecha }
        )
    }

    @Test
    fun `tiempoPorDiaEnRango suma varios registros del mismo dia`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val asistencias = listOf(
            Asistencia(clienteId = "c1", fecha = "2024-03-18", asistio = true, duracionMinutos = 20),
            Asistencia(clienteId = "c1", fecha = "2024-03-18", asistio = true, duracionMinutos = 25)
        )

        val resultado = ResumenClienteCalculator.tiempoPorDiaEnRango(asistencias, rango)

        assertEquals(listOf(45, 0, 0, 0, 0), resultado.map { it.minutos })
    }

    @Test
    fun `leyendaPorPuesto devuelve el mensaje correcto segun el puesto`() {
        assertEquals("¡Felicidades, tú eres el mejor!", ResumenClienteCalculator.leyendaPorPuesto(1))
        assertEquals("¡Felicidades, estás en el podio, sigue así!", ResumenClienteCalculator.leyendaPorPuesto(2))
        assertEquals("¡Felicidades, estás en el podio, sigue así!", ResumenClienteCalculator.leyendaPorPuesto(3))
        assertEquals("¡Estás muy cerca del podio!", ResumenClienteCalculator.leyendaPorPuesto(4))
        assertEquals("¡Estás muy cerca del podio!", ResumenClienteCalculator.leyendaPorPuesto(5))
        assertEquals("Échale ganitas jefe", ResumenClienteCalculator.leyendaPorPuesto(6))
    }

    @Test
    fun `calcularRanking sin empates ubica el puesto y los nombres por encima`() {
        val a = Cliente(id = "a", nombre = "Ana")
        val b = Cliente(id = "b", nombre = "Beto")
        val c = Cliente(id = "c", nombre = "Caro")
        val valores = listOf(a to 5, b to 3, c to 1)
        val resultado = ResumenClienteCalculator.calcularRanking(valores, "b")
        assertEquals(2, resultado.puesto)
        assertEquals(listOf("Ana"), resultado.nombresPorEncima)
    }

    @Test
    fun `calcularRanking en primer lugar no tiene nadie por encima`() {
        val a = Cliente(id = "a", nombre = "Ana")
        val b = Cliente(id = "b", nombre = "Beto")
        val resultado = ResumenClienteCalculator.calcularRanking(listOf(a to 5, b to 3), "a")
        assertEquals(1, resultado.puesto)
        assertEquals(emptyList<String>(), resultado.nombresPorEncima)
    }

    @Test
    fun `calcularRanking con empate comparten puesto`() {
        val a = Cliente(id = "a", nombre = "Ana")
        val b = Cliente(id = "b", nombre = "Beto")
        val c = Cliente(id = "c", nombre = "Caro")
        // Ana y Beto empatados en 5, Caro con 2: Caro queda en puesto 3, detrás de ambos
        val valores = listOf(a to 5, b to 5, c to 2)
        val resultado = ResumenClienteCalculator.calcularRanking(valores, "c")
        assertEquals(3, resultado.puesto)
        assertEquals(listOf("Ana", "Beto"), resultado.nombresPorEncima)

        val resultadoAna = ResumenClienteCalculator.calcularRanking(valores, "a")
        assertEquals(1, resultadoAna.puesto)
        assertEquals(emptyList<String>(), resultadoAna.nombresPorEncima)
    }

    @Test
    fun `calcularRanking con todos empatados en cero deja a todos en primer lugar`() {
        // Caso real de hoy: ningún cliente tiene duracionMinutos capturado todavía, así que
        // en la tarjeta de Tiempo todos empatan en 0 y a todos se les dice "¡Vas primero!".
        val a = Cliente(id = "a", nombre = "Ana")
        val b = Cliente(id = "b", nombre = "Beto")
        val c = Cliente(id = "c", nombre = "Caro")
        val valores = listOf(a to 0, b to 0, c to 0)
        for (id in listOf("a", "b", "c")) {
            val resultado = ResumenClienteCalculator.calcularRanking(valores, id)
            assertEquals(1, resultado.puesto)
            assertEquals(emptyList<String>(), resultado.nombresPorEncima)
        }
    }

    @Test
    fun `diaFavoritoEnRango devuelve el dia con mas repeticiones`() {
        val dias = listOf("Pecho", "Espalda", "Pierna")
        val asistencias = listOf(
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 1)
        )
        assertEquals("Pecho", ResumenClienteCalculator.diaFavoritoEnRango(asistencias, dias))
    }

    @Test
    fun `conteoDiasEnRango cuenta cada dia y ordena de mayor a menor`() {
        val dias = listOf("Pecho", "Espalda", "Pierna")
        val asistencias = listOf(
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 1),
            Asistencia(diaRutinaRealizado = 2),
            Asistencia(diaRutinaRealizado = 2),
            Asistencia(diaRutinaRealizado = 2)
        )
        val resultado = ResumenClienteCalculator.conteoDiasEnRango(asistencias, dias)
        assertEquals(
            listOf(
                ConteoDiaRutina("Pierna", 3),
                ConteoDiaRutina("Pecho", 2),
                ConteoDiaRutina("Espalda", 1)
            ),
            resultado
        )
    }

    @Test
    fun `conteoDiasEnRango descarta indices fuera de la rutina actual`() {
        val dias = listOf("Pecho", "Espalda")
        val asistencias = listOf(Asistencia(diaRutinaRealizado = 0), Asistencia(diaRutinaRealizado = 7))
        assertEquals(listOf(ConteoDiaRutina("Pecho", 1)), ResumenClienteCalculator.conteoDiasEnRango(asistencias, dias))
    }

    @Test
    fun `conteoDiasEnRango agrupa y suma dias con el mismo nombre aunque esten en indices distintos`() {
        val dias = listOf("Pecho, hombro y tríceps", "Espalda y bíceps", "Pierna", "Pecho, hombro y tríceps", "Espalda y bíceps")
        val asistencias = listOf(
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 3),
            Asistencia(diaRutinaRealizado = 3),
            Asistencia(diaRutinaRealizado = 1),
            Asistencia(diaRutinaRealizado = 4)
        )
        val resultado = ResumenClienteCalculator.conteoDiasEnRango(asistencias, dias)
        assertEquals(
            listOf(
                ConteoDiaRutina("Pecho, hombro y tríceps", 4),
                ConteoDiaRutina("Espalda y bíceps", 2)
            ),
            resultado
        )
    }

    @Test
    fun `diaFavoritoEnRango sin asistencias devuelve null`() {
        assertEquals(null, ResumenClienteCalculator.diaFavoritoEnRango(emptyList(), listOf("Pecho")))
    }

    @Test
    fun `diaFavoritoEnRango con empate elige uno de los empatados`() {
        val dias = listOf("Pecho", "Espalda")
        val asistencias = listOf(
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 1)
        )
        val resultado = ResumenClienteCalculator.diaFavoritoEnRango(asistencias, dias)
        assertEquals(true, resultado == "Pecho" || resultado == "Espalda")
    }

    @Test
    fun `diaFavoritoEnRango con indice fuera de la rutina actual devuelve null`() {
        // Índice viejo que quedó de una rutina reasignada a media semana.
        val dias = listOf("Pecho", "Espalda")
        val asistencias = listOf(Asistencia(diaRutinaRealizado = 7))
        assertEquals(null, ResumenClienteCalculator.diaFavoritoEnRango(asistencias, dias))
    }

    @Test
    fun `calcularResumenCliente con asistencias pero sin dia de rutina deja diaFavorito nulo`() {
        // Este es el caso que la tarjeta de día favorito NO debe contar como "no viniste":
        // el cliente sí asistió, sólo que no hay día de rutina que reportar.
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = null),
            Asistencia(clienteId = "a", fecha = "2024-03-19", asistio = true, diaRutinaRealizado = null)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), asistencias, rango)

        assertEquals(2, resumen.diasAsistidos)
        assertEquals(null, resumen.diaFavoritoNombre)
    }

    @Test
    fun `calcularResumenCliente arma el resumen semanal completo`() {
        val cliente = Cliente(
            id = "a", nombre = "Ana", activo = true,
            rutinaAsignada = Rutina(dias = listOf(DiaRutina(nombreDia = "Pecho"), DiaRutina(nombreDia = "Espalda")))
        )
        val otro = Cliente(id = "b", nombre = "Beto", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = 0, duracionMinutos = 60),
            Asistencia(clienteId = "a", fecha = "2024-03-19", asistio = true, diaRutinaRealizado = 0, duracionMinutos = 45),
            Asistencia(clienteId = "b", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = 1, duracionMinutos = 200)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente, otro), asistencias, rango)

        assertEquals(2, resumen.diasAsistidos)
        assertEquals(105, resumen.minutosEnGym)
        assertEquals("Pecho", resumen.diaFavoritoNombre)
        assertEquals(listOf(ConteoDiaRutina("Pecho", 2)), resumen.conteoDias)
        assertEquals(1, resumen.rankingAsistencia.puesto)
        assertEquals(emptyList<String>(), resumen.rankingAsistencia.nombresPorEncima)
        assertEquals(2, resumen.rankingTiempo.puesto)
        assertEquals(listOf("Beto"), resumen.rankingTiempo.nombresPorEncima)
        assertEquals(null, resumen.rachaMasLarga)
        assertEquals(null, resumen.rankingRacha)
    }

    @Test
    fun `calcularResumenCliente mensual agrega racha mas larga y su ranking`() {
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
        val otro = Cliente(id = "b", nombre = "Beto", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 1), fin = LocalDate.of(2024, 3, 31),
            tipo = TipoResumen.MENSUAL, encabezado = "Mes de marzo"
        )
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-04", asistio = true), // lunes
            Asistencia(clienteId = "a", fecha = "2024-03-05", asistio = true), // martes -> racha de 2
            Asistencia(clienteId = "b", fecha = "2024-03-04", asistio = true)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente, otro), asistencias, rango)

        assertEquals(2, resumen.rachaMasLarga)
        assertEquals(1, resumen.rankingRacha?.puesto)
        assertEquals(emptyList<String>(), resumen.rankingRacha?.nombresPorEncima)
    }

    @Test
    fun `calcularResumenCliente sin asistencias devuelve diaFavorito nulo`() {
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), emptyList(), rango)

        assertEquals(0, resumen.diasAsistidos)
        assertEquals(null, resumen.diaFavoritoNombre)
        assertEquals(1, resumen.rankingAsistencia.puesto)
    }

    @Test
    fun `calcularDesgloseEsfuerzo con el ejemplo de Estela`() {
        val resultado = ResumenClienteCalculator.calcularDesgloseEsfuerzo(
            minutosEnGym = 87,
            segundosPorEjercicio = 40,
            minutosDescanso = 3.0
        )
        assertEquals(DesgloseEsfuerzo(minutosEntrenando = 16, minutosDescansando = 71, porcentajeEntrenando = 18), resultado)
    }

    @Test
    fun `calcularDesgloseEsfuerzo siempre suma exactamente el total, incluso con redondeo incomodo`() {
        val casos = listOf(
            Triple(87, 40, 3.0),
            Triple(60, 15, 1.0),
            Triple(1, 40, 3.0),
            Triple(100, 33, 2.5),
            Triple(45, 90, 0.5),
            Triple(200, 1, 10.0)
        )
        for ((minutosEnGym, segundosPorEjercicio, minutosDescanso) in casos) {
            val resultado = ResumenClienteCalculator.calcularDesgloseEsfuerzo(minutosEnGym, segundosPorEjercicio, minutosDescanso)
            requireNotNull(resultado)
            assertEquals(minutosEnGym, resultado.minutosEntrenando + resultado.minutosDescansando)
        }
    }

    @Test
    fun `calcularDesgloseEsfuerzo es null cuando falta segundosPorEjercicio`() {
        assertEquals(
            null,
            ResumenClienteCalculator.calcularDesgloseEsfuerzo(minutosEnGym = 87, segundosPorEjercicio = null, minutosDescanso = 3.0)
        )
    }

    @Test
    fun `calcularDesgloseEsfuerzo es null cuando falta minutosDescanso`() {
        assertEquals(
            null,
            ResumenClienteCalculator.calcularDesgloseEsfuerzo(minutosEnGym = 87, segundosPorEjercicio = 40, minutosDescanso = null)
        )
    }

    @Test
    fun `calcularDesgloseEsfuerzo es null cuando minutosEnGym es cero`() {
        assertEquals(
            null,
            ResumenClienteCalculator.calcularDesgloseEsfuerzo(minutosEnGym = 0, segundosPorEjercicio = 40, minutosDescanso = 3.0)
        )
    }

    @Test
    fun `calcularDesgloseEsfuerzo es null cuando segundosPorEjercicio no es positivo`() {
        assertEquals(
            null,
            ResumenClienteCalculator.calcularDesgloseEsfuerzo(minutosEnGym = 87, segundosPorEjercicio = 0, minutosDescanso = 3.0)
        )
        assertEquals(
            null,
            ResumenClienteCalculator.calcularDesgloseEsfuerzo(minutosEnGym = 87, segundosPorEjercicio = -5, minutosDescanso = 3.0)
        )
    }

    @Test
    fun `calcularResumenCliente con los dos campos de esfuerzo llena desgloseEsfuerzo`() {
        val cliente = Cliente(
            id = "a", nombre = "Ana", activo = true,
            segundosPorEjercicio = 40, minutosDescanso = 3.0
        )
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, duracionMinutos = 87)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), asistencias, rango)

        assertEquals(DesgloseEsfuerzo(minutosEntrenando = 16, minutosDescansando = 71, porcentajeEntrenando = 18), resumen.desgloseEsfuerzo)
    }

    @Test
    fun `calcularResumenCliente sin los campos de esfuerzo deja desgloseEsfuerzo nulo`() {
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, duracionMinutos = 87)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), asistencias, rango)

        assertEquals(null, resumen.desgloseEsfuerzo)
    }

    @Test
    fun `calcularResumenCliente calcula rankingEsfuerzo comparando porcentaje entrenando`() {
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true, segundosPorEjercicio = 40, minutosDescanso = 1.0)
        val otro = Cliente(id = "b", nombre = "Beto", activo = true, segundosPorEjercicio = 20, minutosDescanso = 1.0)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, duracionMinutos = 60),
            Asistencia(clienteId = "b", fecha = "2024-03-18", asistio = true, duracionMinutos = 60)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente, otro), asistencias, rango)

        // Ana: ciclo 40+60=100s, fracción 0.4 -> 40%. Beto: ciclo 20+60=80s, fracción 0.25 -> 25%.
        assertEquals(1, resumen.rankingEsfuerzo?.puesto)
        assertEquals(emptyList<String>(), resumen.rankingEsfuerzo?.nombresPorEncima)
    }

    @Test
    fun `calcularResumenCliente deja rankingEsfuerzo nulo sin segundosPorEjercicio configurado`() {
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val asistencias = listOf(Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, duracionMinutos = 60))
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), asistencias, rango)

        assertEquals(null, resumen.rankingEsfuerzo)
    }

    @Test
    fun `calcularResumenCliente calcula rankingConstancia por proporcion del dia mas repetido`() {
        val diasA = listOf(DiaRutina(nombreDia = "Pecho"), DiaRutina(nombreDia = "Espalda"))
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true, rutinaAsignada = Rutina(dias = diasA))
        val otro = Cliente(id = "b", nombre = "Beto", activo = true, rutinaAsignada = Rutina(dias = diasA))
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        // Ana: 3 asistencias, las 3 el mismo día -> 100% de constancia.
        // Beto: 4 asistencias, 2 en el mismo día -> 50% de constancia.
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = 0),
            Asistencia(clienteId = "a", fecha = "2024-03-19", asistio = true, diaRutinaRealizado = 0),
            Asistencia(clienteId = "a", fecha = "2024-03-20", asistio = true, diaRutinaRealizado = 0),
            Asistencia(clienteId = "b", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = 0),
            Asistencia(clienteId = "b", fecha = "2024-03-19", asistio = true, diaRutinaRealizado = 0),
            Asistencia(clienteId = "b", fecha = "2024-03-20", asistio = true, diaRutinaRealizado = 1),
            Asistencia(clienteId = "b", fecha = "2024-03-21", asistio = true, diaRutinaRealizado = 1)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente, otro), asistencias, rango)

        assertEquals(1, resumen.rankingConstancia?.puesto)
        assertEquals(emptyList<String>(), resumen.rankingConstancia?.nombresPorEncima)
    }

    @Test
    fun `calcularResumenCliente deja rankingConstancia nulo sin asistencias`() {
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), emptyList(), rango)

        assertEquals(null, resumen.rankingConstancia)
    }
}
