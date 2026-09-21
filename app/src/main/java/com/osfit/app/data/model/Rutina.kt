package com.osfit.app.data.model

data class Rutina(
    val id: String = "",
    val nombre: String = "",
    val dias: List<DiaRutina> = emptyList(),
    /**
     * El ciclo se reinicia cada lunes en vez de rodar sin fin.
     *
     * Existe para las rutinas cuyo primer y último día trabajan la misma parte del cuerpo
     * —día 1 "Pierna (cuádriceps)", día 5 "Pierna completa"—: con el ciclo rodante, una
     * falta los deja en días consecutivos. Con esto activado, el día que toca es la
     * N-ésima asistencia de la semana y **el último día solo se hace si vino la semana
     * completa**. Ver `docs/superpowers/specs/2026-09-21-reinicio-semanal-rutina-design.md`.
     *
     * Nace en `false`: toda rutina anterior a este campo conserva el ciclo rodante.
     */
    val reinicioSemanal: Boolean = false
)
