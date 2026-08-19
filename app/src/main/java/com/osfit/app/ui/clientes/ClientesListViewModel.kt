package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.ClienteRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ClientesListViewModel(
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository
) : ViewModel() {

    val clientes: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _errorValidacion = MutableStateFlow<String?>(null)
    val errorValidacion: StateFlow<String?> = _errorValidacion.asStateFlow()

    fun crearCliente(nombre: String, telefono: String) {
        if (nombre.isBlank()) {
            _errorValidacion.value = "El nombre es obligatorio"
            return
        }
        _errorValidacion.value = null
        viewModelScope.launch {
            clienteRepository.crearCliente(nombre.trim(), telefono.trim())
        }
    }

    fun limpiarError() {
        _errorValidacion.value = null
    }
}
