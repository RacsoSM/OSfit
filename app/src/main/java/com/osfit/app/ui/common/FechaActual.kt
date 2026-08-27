package com.osfit.app.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Día calendario actual, que se refresca solo al cruzar la medianoche y cada vez que la
 * app vuelve a primer plano. Sin esto, pantallas como la lista de Clientes solo recalculan
 * el día de rutina (RutinaProgressCalculator.diaEfectivo) cuando llega un cambio de Firestore,
 * por lo que el avance de rutina podía quedarse "atorado" hasta que algo más tocara la app.
 */
@Composable
fun rememberFechaActual(): State<LocalDate> {
    val lifecycleOwner = LocalLifecycleOwner.current
    return produceState(initialValue = LocalDate.now(), lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                value = LocalDate.now()
                val msHastaMedianoche = Duration.between(
                    LocalDateTime.now(),
                    LocalDate.now().plusDays(1).atStartOfDay()
                ).toMillis().coerceAtLeast(1_000L)
                delay(msHastaMedianoche)
            }
        }
    }
}
