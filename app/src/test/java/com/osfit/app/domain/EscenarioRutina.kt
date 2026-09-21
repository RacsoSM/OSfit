package com.osfit.app.domain

import com.osfit.app.data.fake.FakeAsistenciaRepository
import com.osfit.app.data.fake.FakeClienteRepository
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import kotlinx.coroutines.flow.first

/**
 * Escenario compartido por los tests del día de rutina. Cada método imita la misma
 * secuencia de llamadas que hacen las pantallas reales, para que los tests ejerciten el
 * camino de verdad y no una versión simplificada.
 *
 * Clientes sembrados (ver [FakeClienteRepository]):
 *  - "1" Ana   — 4 días, ancla día 1 en FECHA_CORTE
 *  - "2" Beto  — 3 días, ancla día 2 (último del ciclo)
 *  - "3" Carla — cliente anterior al cambio: sin ancla, con pendiente viejo ya vencido
 *  - "4" Diego — sin rutina asignada
 *  - "5" Elena — 5 días con reinicioSemanal, ancla día 1 en FECHA_CORTE
 */
class EscenarioRutina {
    val clientes = FakeClienteRepository()
    val asistencias = FakeAsistenciaRepository()

    companion object {
        const val ANA = "1"
        const val BETO = "2"
        const val CARLA = "3"
        const val DIEGO = "4"
        const val ELENA = "5"

        // Todas posteriores a RutinaProgressCalculator.FECHA_CORTE (2026-09-01).
        const val DIA1 = "2026-09-02"
        const val DIA2 = "2026-09-03"
        const val DIA3 = "2026-09-04"
        const val DIA4 = "2026-09-05"

        // Una semana real posterior a FECHA_CORTE: 2026-09-07 es lunes.
        const val LUNES = "2026-09-07"
        const val MARTES = "2026-09-08"
        const val MIERCOLES = "2026-09-09"
        const val JUEVES = "2026-09-10"
        const val VIERNES = "2026-09-11"
        const val SABADO = "2026-09-12"
        const val LUNES_SIGUIENTE = "2026-09-14"
    }

    suspend fun cliente(id: String): Cliente =
        clientes.observarClientes().first().first { it.id == id }

    suspend fun asistenciasDe(id: String): List<Asistencia> =
        asistencias.observarAsistenciasPorCliente(id).first()

    suspend fun registro(id: String, fecha: String): Asistencia? =
        asistenciasDe(id).firstOrNull { it.fecha == fecha }

    /** Estado completo del día, incluido el descanso del reinicio semanal. */
    suspend fun estado(id: String, hoy: String): DiaQueToca =
        RutinaProgressCalculator.diaQueToca(cliente(id), asistenciasDe(id), hoy)

    /**
     * Índice del día, como lo veían los tests antes de que el cálculo tuviera tres estados.
     * `SinRutina` sigue valiendo 0, igual que antes. `Descanso` revienta a propósito: un test
     * que lo encuentre por accidente tiene que enterarse, no recibir un número inventado.
     */
    suspend fun diaQueToca(id: String, hoy: String): Int = when (val d = estado(id, hoy)) {
        is DiaQueToca.Dia -> d.indice
        DiaQueToca.SinRutina -> 0
        DiaQueToca.Descanso -> error("le toca descansar en $hoy; usa estado() para afirmarlo")
    }

    /** Marcar Asistió/Faltó y guardar (TomarAsistenciaViewModel.guardarTodo). */
    suspend fun marcar(id: String, fecha: String, asistio: Boolean) {
        // El mismo mapeo que `TomarAsistenciaViewModel.indiceQueToca`, y tiene que seguir
        // siéndolo: sin rutina se registra el día 0 como siempre, y sólo el descanso se
        // queda sin día. Si los dos se separan, este escenario deja de imitar la pantalla
        // real y los tests validan contra algo que no existe.
        val dia = if (asistio) {
            when (val d = estado(id, fecha)) {
                is DiaQueToca.Dia -> d.indice
                DiaQueToca.SinRutina -> 0
                DiaQueToca.Descanso -> null
            }
        } else {
            null
        }
        asistencias.registrarAsistencia(
            clienteId = id,
            fecha = fecha,
            asistio = asistio,
            diaRutinaRealizado = dia,
            nota = ""
        )
    }

    /** Botón "Iniciar tiempo". Sin día que hacer no hay nada que cronometrar. */
    suspend fun iniciarTiempo(id: String, fecha: String) {
        val dia = when (val d = estado(id, fecha)) {
            is DiaQueToca.Dia -> d.indice
            DiaQueToca.SinRutina -> 0
            DiaQueToca.Descanso -> return
        }
        asistencias.iniciarTiempo(clienteId = id, fecha = fecha, diaRutinaRealizado = dia)
    }

    /** Botón "Asignar día": ancla el día y alinea el registro de esa fecha si ya existe. */
    suspend fun asignarDia(id: String, dia: Int, fecha: String) =
        AsignarDiaManual.ejecutar(
            clienteRepository = clientes,
            asistenciaRepository = asistencias,
            clienteId = id,
            diaIndex = dia,
            hoy = fecha
        )

    /** Corregir el día desde la pestaña Rutina de Calendario. */
    suspend fun corregirDiaEnCalendario(id: String, fecha: String, dia: Int) =
        asistencias.actualizarDiaRealizado(id, fecha, dia)

    /** Botón "Reiniciar día". */
    suspend fun reiniciarDia(fecha: String) = asistencias.reiniciarDia(fecha)

    suspend fun totalDias(id: String): Int = cliente(id).rutinaAsignada?.dias?.size ?: 1
}
