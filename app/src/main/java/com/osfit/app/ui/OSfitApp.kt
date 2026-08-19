package com.osfit.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.osfit.app.auth.AuthManager
import com.osfit.app.auth.AuthState
import com.osfit.app.ui.common.ErrorScreen
import com.osfit.app.ui.navigation.OSfitNavHost
import com.osfit.app.ui.navigation.Screen
import com.osfit.app.ui.navigation.screensConBarraInferior

@Composable
fun OSfitApp(authManager: AuthManager) {
    val authState by authManager.state.collectAsState()

    LaunchedEffect(Unit) {
        authManager.iniciarSesionSilenciosa()
    }

    when (val estado = authState) {
        is AuthState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        is AuthState.Error -> {
            ErrorScreen(mensaje = estado.message, onReintentar = { authManager.iniciarSesionSilenciosa() })
        }
        is AuthState.Success -> {
            OSfitContent()
        }
    }
}

@Composable
private fun OSfitContent() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val rutaActual = backStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar {
                screensConBarraInferior.forEach { pantalla ->
                    val (icono, etiqueta) = when (pantalla) {
                        Screen.Clientes -> Icons.Filled.People to "Clientes"
                        Screen.Calendario -> Icons.Filled.CalendarMonth to "Calendario"
                        Screen.Rutinas -> Icons.Filled.FitnessCenter to "Rutinas"
                        else -> Icons.Filled.People to ""
                    }
                    NavigationBarItem(
                        selected = rutaActual == pantalla.route,
                        onClick = {
                            navController.navigate(pantalla.route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(icono, contentDescription = etiqueta) },
                        label = { Text(etiqueta) }
                    )
                }
            }
        }
    ) { paddingValues ->
        OSfitNavHost(navController = navController, modifier = Modifier.padding(paddingValues))
    }
}
