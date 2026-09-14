package com.osfit.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.osfit.app.auth.AuthManager
import com.osfit.app.data.AppContainer
import com.osfit.app.ui.OSfitApp
import com.osfit.app.ui.theme.OSfitTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val authManager = AuthManager()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // En segundo plano y sin bloquear la interfaz: restaurar no corre prisa, sólo hace
        // falta antes del próximo video. Si falla del todo, el peor caso es el de hoy.
        lifecycleScope.launch {
            runCatching { AppContainer.restauradorDeArchivos.restaurar(applicationContext) }
        }
        setContent {
            OSfitTheme {
                OSfitApp(authManager = authManager)
            }
        }
    }
}
