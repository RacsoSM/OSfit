package com.osfit.app.data

import android.content.Context
import com.osfit.app.data.repository.CancionStorageRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.InsigniaStorageRepository
import com.osfit.app.data.repository.LogroPersonalRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.domain.ArchivoEsperado
import com.osfit.app.domain.ArchivosQueFaltan
import java.io.File
import kotlinx.coroutines.flow.first

/**
 * Único lugar que vuelve a bajar a `filesDir` lo que se subió a Storage.
 *
 * Existe como clase aparte por el mismo motivo que [SincronizadorDiaWeb]: el riesgo de este
 * diseño es "un camino que olvidó restaurar", y concentrarlo hace que la pregunta "¿quién
 * restaura?" se responda leyendo un solo archivo.
 *
 * Es idempotente y barato: si los archivos están, no toca la red. En un arranque normal no
 * baja nada.
 */
class RestauradorDeArchivos(
    private val clienteRepository: ClienteRepository,
    private val medallaRepository: MedallaRepository,
    private val logroPersonalRepository: LogroPersonalRepository,
    private val cancionStorageRepository: CancionStorageRepository,
    private val insigniaStorageRepository: InsigniaStorageRepository
) {
    suspend fun restaurar(context: Context) {
        val esperados = ArchivosQueFaltan.esperadosDe(
            clientes = clienteRepository.observarClientes().first(),
            medallas = medallaRepository.observarCatalogo().first(),
            logros = logroPersonalRepository.observarCatalogo().first()
        )
        val faltantes = ArchivosQueFaltan.calcular(esperados) { archivoDe(context, it).exists() }

        // Archivo por archivo: una descarga caída no debe llevarse las demás. La que falle se
        // reintenta sola en el siguiente arranque, porque el criterio es "falta en disco" y
        // seguirá faltando. Por eso no hace falta ni estado ni reintentos propios.
        faltantes.forEach { esperado ->
            val ruta = esperado.rutaRemota ?: return@forEach
            runCatching {
                val destino = archivoDe(context, esperado)
                if (esperado.carpeta == CARPETA_CANCIONES) {
                    cancionStorageRepository.bajar(ruta, destino)
                } else {
                    insigniaStorageRepository.bajar(ruta, destino)
                }
            }
        }
    }

    private fun archivoDe(context: Context, esperado: ArchivoEsperado): File =
        File(File(context.filesDir, esperado.carpeta), esperado.nombreLocal)

    private companion object {
        const val CARPETA_CANCIONES = "canciones"
    }
}
