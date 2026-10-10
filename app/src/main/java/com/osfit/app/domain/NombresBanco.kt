package com.osfit.app.domain

import com.osfit.app.data.model.EjercicioBanco
import java.net.URLEncoder
import java.text.Normalizer

/**
 * Cambiarle el nombre a un ejercicio del banco desde la app, y armar la URL de su GIF.
 *
 * La web liga los ejercicios de las rutinas con el banco por nombre o alias, así que el nombre
 * viejo **se queda como alias**: una rutina que dice "Press banca" sigue ligada aunque el
 * ejercicio ahora se llame "Press plano con barra". Las sesiones ya guardadas conservan el
 * nombre con el que se registraron (es una copia, a propósito).
 */
object NombresBanco {

    const val LARGO_MAXIMO = 60

    /**
     * Sin acentos, sin mayúsculas y sin espacios de sobra.
     *
     * GEMELO: `claveBanco` en `web/src/banco.ts` y en `functions/scripts/bancoEjercicios.mjs`.
     */
    fun clave(nombre: String): String =
        Normalizer.normalize(nombre, Normalizer.Form.NFD)
            .replace(Regex("\\p{M}"), "")
            .trim()
            .lowercase()
            .replace(Regex("\\s+"), " ")

    /**
     * Por qué no se puede usar ese nombre, o null si se puede. Choca si otro ejercicio ya se
     * llama así o lo tiene de alias: la web no sabría a cuál ligar.
     */
    fun problemaCon(nuevo: String, id: String, banco: List<EjercicioBanco>): String? {
        val limpio = nuevo.trim()
        if (limpio.isEmpty()) return "Escribe un nombre."
        if (limpio.length > LARGO_MAXIMO) return "Máximo $LARGO_MAXIMO letras."
        val c = clave(limpio)
        val otro = banco.firstOrNull { e ->
            e.id != id && (clave(e.nombre) == c || e.alias.any { clave(it) == c })
        }
        return otro?.let { "Ya existe: «${it.nombre}»." }
    }

    /** Los alias después de renombrar: suma el nombre viejo y quita el nuevo si estaba. */
    fun aliasTrasRenombrar(alias: List<String>, viejo: String, nuevo: String): List<String> {
        val cNuevo = clave(nuevo)
        val sinNuevo = alias.filter { clave(it) != cNuevo }
        val cViejo = clave(viejo)
        return if (cViejo == cNuevo || sinNuevo.any { clave(it) == cViejo }) sinNuevo
        else sinNuevo + viejo.trim()
    }

    /**
     * La URL pública del GIF. Los GIF del banco se leen sin sesión (`storage.rules`), igual que
     * en la web: así no hace falta pedirle a Storage una URL por cada fila de la lista.
     *
     * GEMELO: `urlGif` en `web/src/banco.ts`. El bucket es el de `google-services.json`.
     */
    private const val BUCKET = "osfit-cccfe.firebasestorage.app"

    fun urlGif(ruta: String?): String? {
        if (ruta.isNullOrBlank()) return null
        val codificada = URLEncoder.encode(ruta, "UTF-8").replace("+", "%20")
        return "https://firebasestorage.googleapis.com/v0/b/$BUCKET/o/$codificada?alt=media"
    }
}
