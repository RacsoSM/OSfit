package com.osfit.app.data.model

import com.google.firebase.Timestamp

/**
 * Acceso web de un cliente, en la colección `accesosWeb`. **El id del documento es el token**
 * del link, así que canjearlo es una lectura directa por id en vez de una query.
 *
 * Vive fuera de `clientes/{id}` a propósito: así el documento que el propio cliente puede
 * leer no contiene ningún secreto.
 */
data class AccesoWeb(
    val token: String = "",
    val clienteId: String = "",
    val creado: Timestamp = Timestamp.now()
)
