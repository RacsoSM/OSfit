package com.osfit.app.paletas

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PaletaWebFirestoreTest {

    @Test
    fun `un color ARGB se escribe como hex de seis digitos con almohadilla`() {
        assertEquals("#B388FF", aHexWeb(0xFFB388FF.toInt()))
    }

    /** Los ceros a la izquierda se pierden si se formatea sin ancho fijo, y un "#4162B" no es
     *  un color válido en CSS: la página se quedaría sin ese token, en silencio. */
    @Test
    fun `un color con ceros a la izquierda conserva sus seis digitos`() {
        assertEquals("#04162B", aHexWeb(0xFF04162B.toInt()))
        assertEquals("#000000", aHexWeb(0xFF000000.toInt()))
    }

    /** El alfa no viaja: la web pinta estos colores sobre superficies opacas. */
    @Test
    fun `el alfa se descarta`() {
        assertEquals("#B388FF", aHexWeb(0x00B388FF))
    }

    @Test
    fun `los campos guardados son el id y los cuatro colores de web`() {
        val campos = camposFirestore(Paletas.porIdWeb("oceano"))
        assertEquals(
            mapOf(
                "id" to "oceano",
                "primario" to "#6BB6FF",
                "primarioOscuro" to "#123A75",
                "primarioClaro" to "#D2E8FF",
                "sobrePrimario" to "#04162B"
            ),
            campos
        )
    }

    /** Todo lo que se guarda tiene que ser legible por la web, que valida #RRGGBB y descarta
     *  lo que no pase. Una paleta que escribiera un hex mal formado se vería morada sin avisar. */
    @Test
    fun `toda paleta produce cuatro colores con formato valido`() {
        val formato = Regex("^#[0-9A-F]{6}$")
        Paletas.disponibles.forEach { paleta ->
            val campos = camposFirestore(paleta)
            listOf("primario", "primarioOscuro", "primarioClaro", "sobrePrimario").forEach { clave ->
                val valor = campos[clave] as String
                // assertTrue y no el `assert` de Kotlin: ese se compila a nada sin -ea, así
                // que la prueba pasaría siempre sin comprobar nada.
                assertTrue("${paleta.id}.$clave = $valor", formato.matches(valor))
            }
        }
    }
}
