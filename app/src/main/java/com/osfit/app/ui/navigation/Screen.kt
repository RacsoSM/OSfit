package com.osfit.app.ui.navigation

sealed class Screen(val route: String) {
    data object Clientes : Screen("clientes")
    data object Calendario : Screen("calendario")
    data object Rutinas : Screen("rutinas")

    data object ClienteDetail : Screen("cliente_detail/{clienteId}") {
        fun crearRuta(clienteId: String) = "cliente_detail/$clienteId"
    }

    data object ClienteAsistencia : Screen("cliente_asistencia/{clienteId}") {
        fun crearRuta(clienteId: String) = "cliente_asistencia/$clienteId"
    }

    data object ClienteEditar : Screen("cliente_editar/{clienteId}") {
        fun crearRuta(clienteId: String) = "cliente_editar/$clienteId"
    }

    data object ClientePagos : Screen("cliente_pagos/{clienteId}") {
        fun crearRuta(clienteId: String) = "cliente_pagos/$clienteId"
    }

    data object Estadisticas : Screen("estadisticas/{clienteId}") {
        fun crearRuta(clienteId: String) = "estadisticas/$clienteId"
    }

    data object MedallasCliente : Screen("medallas_cliente/{clienteId}") {
        fun crearRuta(clienteId: String) = "medallas_cliente/$clienteId"
    }

    data object Top : Screen("top")

    data object TomarAsistencia : Screen("tomar_asistencia/{fecha}") {
        fun crearRuta(fecha: String) = "tomar_asistencia/$fecha"
    }

    data object RutinaEditor : Screen("rutina_editor?rutinaId={rutinaId}") {
        const val ARG_RUTINA_NUEVA = "nueva"
        fun crearRuta(rutinaId: String? = null) = "rutina_editor?rutinaId=${rutinaId ?: ARG_RUTINA_NUEVA}"
    }

    // Solo accesible en builds debug (ver OSfitApp.kt): pantalla de prueba para el avance
    // de día de rutina con datos 100% en memoria, nunca conectada a Firebase.
    data object Sandbox : Screen("sandbox")

    data object Medallas : Screen("medallas")
}

val screensConBarraInferior = listOf(Screen.Clientes, Screen.Calendario, Screen.Rutinas)
