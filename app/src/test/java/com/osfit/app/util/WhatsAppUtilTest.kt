package com.osfit.app.util

import org.junit.Assert.assertEquals
import org.junit.Test

class WhatsAppUtilTest {

    @Test
    fun `la url de acceso web usa el dominio del proyecto y la ruta c`() {
        assertEquals(
            "https://osfit-cccfe.web.app/c/abc123",
            WhatsAppUtil.urlAccesoWeb("abc123")
        )
    }
}
