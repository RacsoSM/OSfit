package com.osfit.app.data.model

/**
 * Un ejercicio del banco, `ejercicios/{id}`. La app lo usa para configurar los grupos del grid de
 * Registro, ver su GIF y cambiarle el nombre; los músculos los usa solo la web.
 *
 * Lo carga `functions/scripts/cargarBancoEjercicios.mjs`. Valores por defecto en todo: Firestore
 * necesita el constructor vacío. El `id` no viaja en el documento, se llena desde `doc.id`.
 */
data class EjercicioBanco(
    val id: String = "",
    val nombre: String = "",
    val tipo: String = "",
    /** Su grupo de origen (ver [com.osfit.app.domain.GruposEjercicio]). */
    val grupo: String = "",
    /** Otras formas de escribirlo; con ellas la web liga los ejercicios de las rutinas. */
    val alias: List<String> = emptyList(),
    /** Ruta del GIF en Storage (`ejercicios/<id>.webp`); null si no tiene. */
    val gifRuta: String? = null,
    /** Video corto en bucle (`ejercicios/<id>.mp4`), de mejor calidad; null si no tiene. */
    val videoRuta: String? = null,
    /** El entrenador le cambió el nombre desde la app: la carga del banco ya no lo pisa. */
    val editadoEnApp: Boolean = false
)
