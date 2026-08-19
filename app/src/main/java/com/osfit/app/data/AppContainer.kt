package com.osfit.app.data

import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RutinaRepository

object AppContainer {
    val rutinaRepository: RutinaRepository by lazy { RutinaRepository() }
    val clienteRepository: ClienteRepository by lazy { ClienteRepository() }
    val pagoRepository: PagoRepository by lazy { PagoRepository() }
    val asistenciaRepository: AsistenciaRepository by lazy { AsistenciaRepository() }
}
