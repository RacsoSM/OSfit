package com.osfit.app.domain

import com.osfit.app.data.model.EjercicioBanco
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Unidad: renombrar ejercicios del banco y la URL de su GIF. */
class NombresBancoTest {

    private val banco = listOf(
        EjercicioBanco(id = "press-banca", nombre = "Press de banca", alias = listOf("press banca")),
        EjercicioBanco(id = "sentadilla", nombre = "Sentadilla con barra", alias = listOf("sentadilla"))
    )

    @Test
    fun `la clave ignora acentos mayusculas y espacios`() {
        assertEquals("sentadilla bulgara", NombresBanco.clave("  Sentadilla   BÚLGARA "))
    }

    @Test
    fun `un nombre libre se puede usar`() {
        assertNull(NombresBanco.problemaCon("Press plano con barra", "press-banca", banco))
    }

    @Test
    fun `no deja un nombre vacio ni demasiado largo`() {
        assertEquals("Escribe un nombre.", NombresBanco.problemaCon("   ", "press-banca", banco))
        assertEquals("Máximo 60 letras.", NombresBanco.problemaCon("a".repeat(61), "press-banca", banco))
    }

    @Test
    fun `no deja usar el nombre o alias de otro ejercicio aunque cambie el acento`() {
        assertEquals("Ya existe: «Sentadilla con barra».", NombresBanco.problemaCon("Sentádilla", "press-banca", banco))
    }

    @Test
    fun `su propio alias si lo puede tomar como nombre`() {
        assertNull(NombresBanco.problemaCon("Press banca", "press-banca", banco))
    }

    @Test
    fun `el nombre viejo queda como alias y el nuevo sale de los alias`() {
        assertEquals(
            listOf("banca", "Press de banca"),
            NombresBanco.aliasTrasRenombrar(listOf("press banca", "banca"), "Press de banca", "Press banca")
        )
    }

    @Test
    fun `cambiar solo acentos o mayusculas no agrega alias`() {
        assertEquals(listOf("banca"), NombresBanco.aliasTrasRenombrar(listOf("banca"), "Press de banca", "PRESS DE BANCA"))
    }

    @Test
    fun `la URL del GIF es la misma que arma la web`() {
        assertEquals(
            "https://firebasestorage.googleapis.com/v0/b/osfit-cccfe.firebasestorage.app/o/ejercicios%2Fpress-banca.webp?alt=media",
            NombresBanco.urlGif("ejercicios/press-banca.webp")
        )
        assertNull(NombresBanco.urlGif(null))
    }
}
