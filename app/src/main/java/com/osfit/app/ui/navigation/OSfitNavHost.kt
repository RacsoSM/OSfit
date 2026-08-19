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
            Text("Calendario", modifier = Modifier.padding(16.dp))
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
            com.osfit.app.ui.clientes.ClienteDetailScreen(clienteId = clienteId)
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
