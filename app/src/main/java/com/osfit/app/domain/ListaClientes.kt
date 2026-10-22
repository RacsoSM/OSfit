package com.osfit.app.domain

import com.osfit.app.data.model.Cliente

/**
 * Cómo se reparte la lista de la pestaña Clientes. Los que entrenan a distancia van juntos en
 * un grupo plegable (entrenador, 2026-10-21): no vienen al gimnasio y, sueltos entre los demás,
 * estorbaban en la lista que se usa a diario. Uno inactivo va con los inactivos aunque sea a
 * distancia: lo que importa de él es que ya no entrena.
 *
 * Cada grupo conserva el orden en que llegan.
 */
object ListaClientes {

    data class Grupos(
        val presenciales: List<Cliente>,
        val aDistancia: List<Cliente>,
        val inactivos: List<Cliente>
    )

    fun agrupar(clientes: List<Cliente>): Grupos {
        val (activos, inactivos) = clientes.partition { it.activo }
        val (aDistancia, presenciales) = activos.partition { it.entrenaADistancia }
        return Grupos(presenciales, aDistancia, inactivos)
    }
}
