package com.osfit.app.data

import com.osfit.app.data.repository.AccesoWebRepository
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.AvisoFaltaWebRepository
import com.osfit.app.data.repository.CambioDiaWebRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.ConfigVideoRepository
import com.osfit.app.data.repository.FirestoreAsistenciaRepository
import com.osfit.app.data.repository.FirestoreClienteRepository
import com.osfit.app.data.repository.InsigniaStorageRepository
import com.osfit.app.data.repository.LogroPersonalRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RecordPersonalRepository
import com.osfit.app.data.repository.ResumenStorageRepository
import com.osfit.app.data.repository.RutinaRepository
import com.osfit.app.data.repository.VideoPublicadoRepository

object AppContainer {
    val rutinaRepository: RutinaRepository by lazy { RutinaRepository() }
    val clienteRepository: ClienteRepository by lazy { FirestoreClienteRepository() }
    val pagoRepository: PagoRepository by lazy { PagoRepository() }
    val asistenciaRepository: AsistenciaRepository by lazy { FirestoreAsistenciaRepository() }
    val recordPersonalRepository: RecordPersonalRepository by lazy { RecordPersonalRepository() }
    val medallaRepository: MedallaRepository by lazy { MedallaRepository() }
    val logroPersonalRepository: LogroPersonalRepository by lazy { LogroPersonalRepository() }
    val insigniaStorageRepository: InsigniaStorageRepository by lazy { InsigniaStorageRepository() }
    val configVideoRepository: ConfigVideoRepository by lazy { ConfigVideoRepository() }
    val accesoWebRepository: AccesoWebRepository by lazy { AccesoWebRepository() }
    val cambioDiaWebRepository: CambioDiaWebRepository by lazy { CambioDiaWebRepository() }

    val avisoFaltaWebRepository: AvisoFaltaWebRepository by lazy { AvisoFaltaWebRepository() }
    val videoPublicadoRepository: VideoPublicadoRepository by lazy { VideoPublicadoRepository() }
    val resumenStorageRepository: ResumenStorageRepository by lazy { ResumenStorageRepository() }
    val sincronizadorDiaWeb: SincronizadorDiaWeb by lazy {
        SincronizadorDiaWeb(clienteRepository, asistenciaRepository)
    }
}
