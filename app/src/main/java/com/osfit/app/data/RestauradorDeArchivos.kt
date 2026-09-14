package com.osfit.app.data

import android.content.Context
import android.util.Log
import com.osfit.app.data.repository.CancionStorageRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.InsigniaStorageRepository
import com.osfit.app.data.repository.LogroPersonalRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.domain.ArchivoEsperado
import com.osfit.app.domain.ArchivosQueFaltan
import java.io.File
import kotlinx.coroutines.CancellationException
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
        // Cada fuente se lee por separado: un listener denegado o un flujo cerrado cuesta
        // sólo su grupo. Juntas en una sola expresión, una lista que no se pudo leer dejaba
        // sin restaurar también las otras dos.
        val esperados = ArchivosQueFaltan.esperadosDe(
            clientes = leerOVacio { clienteRepository.observarClientes().first() },
            medallas = leerOVacio { medallaRepository.observarCatalogo().first() },
            logros = leerOVacio { logroPersonalRepository.observarCatalogo().first() }
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

    /** Una fuente que no se pudo leer se trata como "nada que esperar de este grupo". */
    private suspend fun <T> leerOVacio(leer: suspend () -> List<T>): List<T> =
        try {
            leer()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            Log.w(TAG, "No se pudo leer una de las fuentes a restaurar", e)
            emptyList()
        }

    private fun archivoDe(context: Context, esperado: ArchivoEsperado): File =
        File(File(context.filesDir, esperado.carpeta), esperado.nombreLocal)

    private companion object {
        const val CARPETA_CANCIONES = "canciones"
        const val TAG = "RestauradorDeArchivos"
    }
}
