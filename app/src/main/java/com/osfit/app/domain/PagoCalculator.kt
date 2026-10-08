package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * GEMELO: `diasParaPago` / `recordatorioPago` en `web/src/pago.ts`. Si cambia acá, cambia allá.
 */
object PagoCalculator {
    fun diasParaProximoPago(cliente: Cliente): Long? =
        cliente.fechaProximoPago
            ?.toDate()?.toInstant()?.atZone(ZoneId.systemDefault())?.toLocalDate()
            ?.let { ChronoUnit.DAYS.between(LocalDate.now(), it) }
}
