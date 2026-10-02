package com.osfit.app.video

enum class EstiloViajeMancu { CORRER, SALTO }

enum class TipoTransicionMancu(val viaje: EstiloViajeMancu) {
    NUBE(EstiloViajeMancu.CORRER), TELON(EstiloViajeMancu.CORRER),
    IRIS(EstiloViajeMancu.SALTO), BROCHA(EstiloViajeMancu.SALTO);

    companion object {
        fun paraIndice(i: Int): TipoTransicionMancu = entries[i % 4]
    }
}
