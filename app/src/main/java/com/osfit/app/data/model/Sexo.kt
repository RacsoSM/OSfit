package com.osfit.app.data.model

/**
 * Los valores de [Cliente.sexo]. Se guardan como letra y no como enum para que Firestore los
 * lea sin convertidor y la web los compare tal cual (gemelo: `Sexo` en `web/src/datos.ts`).
 */
object Sexo {
    const val HOMBRE = "H"
    const val MUJER = "M"
}
