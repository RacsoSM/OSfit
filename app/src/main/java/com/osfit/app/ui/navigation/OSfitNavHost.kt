package com.osfit.app.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument

@Composable
fun OSfitNavHost(navController: NavHostController, modifier: Modifier = Modifier) {
    NavHost(
        navController = navController,
        startDestination = Screen.Clientes.route,
        modifier = modifier
    ) {
        composable(Screen.Clientes.route) {
            com.osfit.app.ui.clientes.ClientesListScreen(
                onClienteClick = { clienteId -> navController.navigate(Screen.ClienteDetail.crearRuta(clienteId)) }
            )
        }
        composable(Screen.Calendario.route) {
            com.osfit.app.ui.calendario.CalendarioScreen(
                onAbrirAsistencia = { fecha -> navController.navigate(Screen.TomarAsistencia.crearRuta(fecha)) }
            )
        }
        composable(Screen.Rutinas.route) {
            com.osfit.app.ui.rutinas.RutinasListScreen(
                onCrearRutina = { navController.navigate(Screen.RutinaEditor.crearRuta()) },
                onEditarRutina = { rutinaId -> navController.navigate(Screen.RutinaEditor.crearRuta(rutinaId)) }
            )
        }
        composable(
            route = Screen.ClienteDetail.route,
            arguments = listOf(navArgument("clienteId") { type = NavType.StringType })
        ) { backStackEntry ->
            val clienteId = backStackEntry.arguments?.getString("clienteId") ?: return@composable
            com.osfit.app.ui.clientes.ClienteDetailScreen(
                clienteId = clienteId,
                onVerAsistencias = { id -> navController.navigate(Screen.ClienteAsistencia.crearRuta(id)) },
                onVerPagos = { id -> navController.navigate(Screen.ClientePagos.crearRuta(id)) },
                onVerEstadisticas = { id -> navController.navigate(Screen.Estadisticas.crearRuta(id)) },
                onEditarCliente = { id -> navController.navigate(Screen.ClienteEditar.crearRuta(id)) },
                onEliminado = { navController.popBackStack() }
            )
        }
        composable(
            route = Screen.ClienteAsistencia.route,
            arguments = listOf(navArgument("clienteId") { type = NavType.StringType })
        ) { backStackEntry ->
            val clienteId = backStackEntry.arguments?.getString("clienteId") ?: return@composable
            com.osfit.app.ui.clientes.ClienteAsistenciaScreen(clienteId = clienteId)
        }
        composable(
            route = Screen.ClienteEditar.route,
            arguments = listOf(navArgument("clienteId") { type = NavType.StringType })
        ) { backStackEntry ->
            val clienteId = backStackEntry.arguments?.getString("clienteId") ?: return@composable
            com.osfit.app.ui.clientes.ClienteEditarScreen(
                clienteId = clienteId,
                onGuardado = { navController.popBackStack() }
            )
        }
        composable(
            route = Screen.ClientePagos.route,
            arguments = listOf(navArgument("clienteId") { type = NavType.StringType })
        ) { backStackEntry ->
            val clienteId = backStackEntry.arguments?.getString("clienteId") ?: return@composable
            com.osfit.app.ui.clientes.ClientePagosScreen(clienteId = clienteId)
        }
        composable(
            route = Screen.Estadisticas.route,
            arguments = listOf(navArgument("clienteId") { type = NavType.StringType })
        ) { backStackEntry ->
            val clienteId = backStackEntry.arguments?.getString("clienteId") ?: return@composable
            com.osfit.app.ui.clientes.EstadisticasScreen(clienteId = clienteId)
        }
        composable(Screen.Top.route) {
            com.osfit.app.ui.top.TopScreen()
        }
        composable(
            route = Screen.TomarAsistencia.route,
            arguments = listOf(navArgument("fecha") { type = NavType.StringType })
        ) { backStackEntry ->
            val fecha = backStackEntry.arguments?.getString("fecha") ?: return@composable
            com.osfit.app.ui.calendario.TomarAsistenciaScreen(
                fecha = fecha,
                onGuardado = { navController.popBackStack() }
            )
        }
        composable(
            route = Screen.RutinaEditor.route,
            arguments = listOf(navArgument("rutinaId") { type = NavType.StringType; defaultValue = Screen.RutinaEditor.ARG_RUTINA_NUEVA })
        ) { backStackEntry ->
            val rutinaIdArg = backStackEntry.arguments?.getString("rutinaId")
            val rutinaId = if (rutinaIdArg == Screen.RutinaEditor.ARG_RUTINA_NUEVA) null else rutinaIdArg
            com.osfit.app.ui.rutinas.RutinaEditorScreen(
                rutinaId = rutinaId,
                onGuardado = { navController.popBackStack() }
            )
        }
    }
}
