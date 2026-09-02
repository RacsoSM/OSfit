package com.osfit.app.data

import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.FirestoreAsistenciaRepository
import com.osfit.app.data.repository.FirestoreClienteRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RecordPersonalRepository
import com.osfit.app.data.repository.RutinaRepository

object AppContainer {
    val rutinaRepository: RutinaRepository by lazy { RutinaRepository() }
    val clienteRepository: ClienteRepository by lazy { FirestoreClienteRepository() }
    val pagoRepository: PagoRepository by lazy { PagoRepository() }
    val asistenciaRepository: AsistenciaRepository by lazy { FirestoreAsistenciaRepository() }
    val recordPersonalRepository: RecordPersonalRepository by lazy { RecordPersonalRepository() }
}
