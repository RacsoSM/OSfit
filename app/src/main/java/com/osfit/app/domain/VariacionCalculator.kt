package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia

/**
 * Determina qué variación de un día del ciclo le toca hoy a un cliente.
 *
 * Es el espejo de [RutinaProgressCalculator.diaQueToca]: mira la **última** asistencia a ese
 * día del ciclo y avanza una posición. La variación no se guarda en el cliente ni se
 * denormaliza; se deriva del historial, igual que el día, porque guardarla traería las mismas
 * desincronizaciones que costaron el spec *Calendario-Rutina como ley*.
 *
 * **Mira la última en vez de contar las ocurrencias**, y eso es deliberado:
 *
 * 1. Contar rompe si se acota la query de asistencias (entrada 17c del backlog): cambiar la
 *    ventana cambiaría el total y le movería la variación a todo el mundo en silencio. La
 *    última siempre cae dentro de cualquier ventana razonable.
 * 2. Contar se recorre entero si se corrige una asistencia vieja; mirar la última sólo se
 *    afecta si tocas justo la última.
 * 3. Es la misma forma que `diaQueToca`: un solo modelo mental para las dos cosas.
 *
 * Ver `docs/superpowers/specs/2026-09-15-rutinas-en-la-web-design.md`.
 *
 * GEMELO: `web/src/variacion.ts`. Si cambia acá, cambia allá.
 */
object VariacionCalculator {

    /**
     * Variación que toca en [diaDelCiclo] el día [hoy], de un día que tiene [totalVariaciones].
     *
     * [asistenciasDelCliente] puede traer asistencias de cualquier fecha y de cualquier día del
     * ciclo; se filtran aquí. Las faltas guardan `diaRutinaRealizado = null`, así que quedan
     * fuera por construcción y no avanzan la variación, igual que no avanzan el día.
     */
    fun variacionQueToca(
        diaDelCiclo: Int,
        asistenciasDelCliente: List<Asistencia>,
        hoy: String,
        totalVariaciones: Int
    ): Int {
        // 0 variaciones es un día normal, y 1 no tiene a dónde rotar. En los dos casos
        // `ejerciciosDe` devuelve lo mismo pase lo que pase.
        if (totalVariaciones <= 1) return 0

        val ultima = asistenciasDelCliente
            .filter { it.asistio && it.diaRutinaRealizado == diaDelCiclo }
            .filter { it.fecha <= hoy }
            .maxByOrNull { it.fecha }
            ?: return 0

        // Todo lo anterior a esta feature llega sin el campo, y vale 0: cuando se escribió no
        // había variaciones que preservar, así que no hay migración que hacer.
        val realizada = (ultima.variacionRealizada ?: 0).coerceIn(0, totalVariaciones - 1)

        // Si ya entrenó hoy se queda en la que hizo: la clienta puede tener la página abierta
        // mientras entrena y los ejercicios no deben saltarle a otros a media jornada.
        return if (ultima.fecha == hoy) realizada else (realizada + 1) % totalVariaciones
    }
}
