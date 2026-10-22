package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import org.junit.Assert.assertEquals
import org.junit.Test

class ListaClientesTest {

    private fun ids(lista: List<Cliente>) = lista.map { it.id }

    @Test
    fun `los que entrenan a distancia van aparte, y los inactivos al final`() {
        val g = ListaClientes.agrupar(
            listOf(
                Cliente(id = "ana"),
                Cliente(id = "lejos", entrenaADistancia = true),
                Cliente(id = "bea"),
                Cliente(id = "se fue", activo = false),
                Cliente(id = "lejos y se fue", activo = false, entrenaADistancia = true)
            )
        )
        assertEquals(listOf("ana", "bea"), ids(g.presenciales))
        assertEquals(listOf("lejos"), ids(g.aDistancia))
        assertEquals(listOf("se fue", "lejos y se fue"), ids(g.inactivos))
    }

    @Test
    fun `sin nadie a distancia el grupo queda vacio`() {
        assertEquals(emptyList<String>(), ids(ListaClientes.agrupar(listOf(Cliente(id = "ana"))).aDistancia))
    }
}
