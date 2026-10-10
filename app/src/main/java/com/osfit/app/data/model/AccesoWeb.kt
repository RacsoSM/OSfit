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
     * Cuántas veces abrió su página. Lo escribe la función `registrarEntrada`, nunca la app.
     *
     * Hasta el 2026-10-10 contaba canjes del link (lo hacía `sesion`), y la página instalada,
     * que entra sin canjear, no sumaba. Ahora la página avisa en cada apertura, así que una
     * recarga también suma. Los accesos creados antes del contador llegan en 0 aunque la
     * clienta lleve semanas entrando; lo pasado no se guardó en ningún lado.
     */
    val entradas: Long = 0,
    /** Cuándo fue la última apertura. Sin esto, el número de arriba no se puede interpretar. */
    val ultimoAcceso: Timestamp? = null,
    /**
     * Las últimas 5 aperturas, la más reciente primero. Lo escribe `registrarEntrada`. Vacía
     * en los accesos anteriores al 2026-10-10.
     */
    val ultimasEntradas: List<EntradaWeb> = emptyList()
)

/** Una apertura de la página: cuándo (hora del servidor) y desde qué teléfono. */
data class EntradaWeb(
    val cuando: Timestamp? = null,
    /** "ios", "android" u "otro". */
    val plataforma: String = "otro"
)
