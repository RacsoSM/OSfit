package com.osfit.app.data.model

/**
 * Un ejercicio del banco, `ejercicios/{id}`. La app solo lee lo que necesita para configurar los
 * grupos del grid de Registro; el resto (músculos, GIF) lo usa la web.
 *
 * Lo carga `functions/scripts/cargarBancoEjercicios.mjs`. Valores por defecto en todo: Firestore
 * necesita el constructor vacío. El `id` no viaja en el documento, se llena desde `doc.id`.
 */
data class EjercicioBanco(
    val id: String = "",
    val nombre: String = "",
    val tipo: String = "",
    /** Su grupo de origen (ver [com.osfit.app.domain.GruposEjercicio]). */
    val grupo: String = ""
)
