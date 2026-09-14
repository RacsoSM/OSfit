package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.MedallaCatalogo

/**
 * Un archivo que debería estar en `filesDir/<carpeta>/<nombreLocal>`, y de dónde bajarlo si
 * no está. [rutaRemota] nula significa "no hay respaldo": se sabe que el archivo debería
 * existir, pero no hay de dónde recuperarlo.
 */
data class ArchivoEsperado(
    val nombreLocal: String,
    val carpeta: String,
    val rutaRemota: String?
)

/**
 * Decide qué hay que bajar al arrancar. Está separado de quien lo baja a propósito: así la
 * regla —"sólo lo que falta, y sólo si hay de dónde"— se prueba sin Firebase ni dispositivo,
 * que es donde esta clase de bug se esconde.
 */
object ArchivosQueFaltan {

    /**
     * Las rutas de insignias se arman con el id y la carpeta, igual que las construye
     * `InsigniaStorageRepository.subir` al subirlas. No se parsea `imagenUrl`: esa URL existe
     * para que la web pinte un `<img src>` sin cargar el SDK, y su forma no es asunto nuestro.
     * Que `imagenUrl` sea nula sí importa, porque es la única señal de que la imagen nunca
     * llegó a Storage.
     */
    fun esperadosDe(
        clientes: List<Cliente>,
        medallas: List<MedallaCatalogo>,
        logros: List<LogroPersonalCatalogo>
    ): List<ArchivoEsperado> {
        val deCanciones = clientes.mapNotNull { cliente ->
            cliente.cancionArchivo?.let { nombre ->
                ArchivoEsperado(nombre, "canciones", cliente.cancionRuta)
            }
        }
        val deMedallas = medallas.mapNotNull { medalla ->
            medalla.imagenArchivo?.let { nombre ->
                ArchivoEsperado(
                    nombre,
                    "medallas",
                    medalla.imagenUrl?.let { "insignias/medallas/${medalla.id}.png" }
                )
            }
        }
        val deLogros = logros.mapNotNull { logro ->
            logro.imagenArchivo?.let { nombre ->
                ArchivoEsperado(
                    nombre,
                    "logrosPersonales",
                    logro.imagenUrl?.let { "insignias/logrosPersonales/${logro.id}.png" }
                )
            }
        }
        return deCanciones + deMedallas + deLogros
    }

    /**
     * [existeEnDisco] entra como parámetro y no como acceso directo al sistema de archivos
     * para poder probar esto sin tocar disco. Si el archivo está, no se toca la red: en un
     * arranque normal esta función devuelve la lista vacía.
     */
    fun calcular(
        esperados: List<ArchivoEsperado>,
        existeEnDisco: (ArchivoEsperado) -> Boolean
    ): List<ArchivoEsperado> =
        esperados.filter { it.rutaRemota != null && !existeEnDisco(it) }
}
