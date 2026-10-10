package com.osfit.app.ui.grupos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.EjercicioBanco
import com.osfit.app.data.repository.BancoEjerciciosRepository
import com.osfit.app.domain.GrupoEjercicio
import com.osfit.app.domain.GruposEjercicio
import com.osfit.app.domain.NombresBanco
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Un grupo ya resuelto: el Composable no hace cuentas. */
data class FilaGrupo(
    val grupo: GrupoEjercicio,
    val ejercicios: List<EjercicioBanco>,
    /** El entrenador ya editó este grupo; si no, salen los del banco. */
    val configurado: Boolean
)

data class EstadoGrupos(
    val cargando: Boolean = true,
    val grupos: List<FilaGrupo> = emptyList(),
    /** Todo el banco por nombre, para el selector de "Agregar". */
    val banco: List<EjercicioBanco> = emptyList(),
    val error: Boolean = false
)

class GruposEjerciciosViewModel(
    private val repositorio: BancoEjerciciosRepository = AppContainer.bancoEjerciciosRepository
) : ViewModel() {

    private var ultimoBanco: List<EjercicioBanco> = emptyList()
    private var ultimaConfig: Map<String, List<String>>? = null

    val estado: StateFlow<EstadoGrupos> = combine(
        repositorio.observarBanco(),
        repositorio.observarConfig().onStart { emit(null) }
    ) { banco, config ->
        ultimoBanco = banco
        ultimaConfig = config
        EstadoGrupos(
            cargando = false,
            grupos = GruposEjercicio.TODOS.map { g ->
                FilaGrupo(
                    grupo = g,
                    ejercicios = GruposEjercicio.listaDeGrupo(g.id, config, banco),
                    configurado = config?.containsKey(g.id) == true
                )
            },
            banco = GruposEjercicio.ordenados(banco)
        )
    }
        .catch { emit(EstadoGrupos(cargando = false, error = true)) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), EstadoGrupos())

    /** Los ids de hoy del grupo, contando el respaldo del banco si todavía no se configuró. */
    private fun idsDe(grupo: String): List<String> =
        GruposEjercicio.ids(GruposEjercicio.listaDeGrupo(grupo, ultimaConfig, ultimoBanco))

    private fun guardar(grupo: String, ids: List<String>) {
        viewModelScope.launch { runCatching { repositorio.guardarGrupo(grupo, ids) } }
    }

    fun mover(grupo: String, desde: Int, hacia: Int) =
        guardar(grupo, GruposEjercicio.mover(idsDe(grupo), desde, hacia))

    fun quitar(grupo: String, id: String) = guardar(grupo, GruposEjercicio.quitar(idsDe(grupo), id))

    fun agregar(grupo: String, id: String) = guardar(grupo, GruposEjercicio.agregar(idsDe(grupo), id))

    /**
     * Cambia el nombre si se puede. Devuelve por qué no (nombre vacío, ya usado por otro) o
     * null si lo mandó a guardar. El nombre viejo se queda como alias: ver [NombresBanco].
     */
    fun renombrar(id: String, nuevo: String): String? {
        val actual = ultimoBanco.firstOrNull { it.id == id } ?: return "Ese ejercicio ya no existe."
        NombresBanco.problemaCon(nuevo, id, ultimoBanco)?.let { return it }
        val limpio = nuevo.trim()
        if (limpio == actual.nombre) return null
        val alias = NombresBanco.aliasTrasRenombrar(actual.alias, actual.nombre, limpio)
        viewModelScope.launch { runCatching { repositorio.renombrar(id, limpio, alias) } }
        return null
    }

    fun restablecer(grupo: String) {
        viewModelScope.launch { runCatching { repositorio.restablecerGrupo(grupo) } }
    }
}
