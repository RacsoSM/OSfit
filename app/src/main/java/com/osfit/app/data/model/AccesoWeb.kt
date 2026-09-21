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
    val creado: Timestamp = Timestamp.now(),
    /**
     * Cuántas veces se canjeó este link. Lo escribe la función `sesion`, nunca la app.
     *
     * Son canjes, no personas ni visitas: la página vuelve a canjear en cada carga donde no
     * hay sesión viva, y en el navegador que WhatsApp abre encima eso pasa siempre, porque
     * ahí no sobrevive nada guardado. Los accesos creados antes del contador llegan en 0
     * aunque la clienta lleve semanas entrando; lo pasado no se guardó en ningún lado.
     */
    val entradas: Long = 0,
    /** Cuándo fue el último canje. Sin esto, el número de arriba no se puede interpretar. */
    val ultimoAcceso: Timestamp? = null
)
