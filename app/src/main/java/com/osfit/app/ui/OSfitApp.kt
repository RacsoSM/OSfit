package com.osfit.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.osfit.app.auth.AuthManager
import com.osfit.app.auth.AuthState
import com.osfit.app.ui.common.ErrorScreen
import com.osfit.app.ui.navigation.OSfitNavHost
import com.osfit.app.ui.navigation.Screen
import com.osfit.app.ui.navigation.screensConBarraInferior
import kotlinx.coroutines.launch

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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OSfitContent() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val rutaActual = backStackEntry?.destination?.route
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    BackHandler(enabled = drawerState.isOpen) {
        scope.launch { drawerState.close() }
    }

    // Se invierte la dirección para que el drawer de Material3 (que solo abre desde la
    // izquierda) abra desde la derecha, del mismo lado que el ícono que lo activa.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    ModalDrawerSheet(modifier = Modifier.fillMaxWidth(0.6f)) {
                        NavigationDrawerItem(
                            label = { Text("Top") },
                            selected = rutaActual == Screen.Top.route,
                            onClick = {
                                scope.launch { drawerState.close() }
                                navController.navigate(Screen.Top.route)
                            },
                            modifier = Modifier.padding(12.dp)
                        )
                        NavigationDrawerItem(
                            label = { Text("Medallas") },
                            selected = rutaActual == Screen.Medallas.route,
                            onClick = {
                                scope.launch { drawerState.close() }
                                navController.navigate(Screen.Medallas.route)
                            },
                            modifier = Modifier.padding(12.dp)
                        )
                        if (com.osfit.app.BuildConfig.DEBUG) {
                            NavigationDrawerItem(
                                label = { Text("Sandbox (prueba)") },
                                selected = rutaActual == Screen.Sandbox.route,
                                onClick = {
                                    scope.launch { drawerState.close() }
                                    navController.navigate(Screen.Sandbox.route)
                                },
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }
                }
            }
        ) {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Box(modifier = Modifier.fillMaxSize()) {
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
                                                popUpTo(navController.graph.startDestinationId)
                                                launchSingleTop = true
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
                    IconButton(
                        onClick = { scope.launch { drawerState.open() } },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .statusBarsPadding()
                    ) {
                        Icon(Icons.Filled.Menu, contentDescription = "Menú", tint = Color.White)
                    }
                }
            }
        }
    }
}
