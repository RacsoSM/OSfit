package com.osfit.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.osfit.app.auth.AuthManager
import com.osfit.app.auth.AuthState
import com.osfit.app.data.AppContainer
import com.osfit.app.ui.OSfitApp
import com.osfit.app.ui.theme.OSfitTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val authManager = AuthManager()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // En segundo plano y sin bloquear la interfaz: restaurar no corre prisa, sólo hace
        // falta antes del próximo video. Si falla del todo, el peor caso es el de hoy.
        //
        // Espera a que la sesión esté iniciada antes de tocar Firestore, igual que el resto de
        // la app, que sólo consulta dentro de la rama `AuthState.Success` de OSfitApp. Sin
        // esta espera, el arranque de después de reinstalar —el único que de verdad tiene algo
        // que restaurar— pillaba los listeners denegados y se perdía la restauración entera.
        lifecycleScope.launch {
            runCatching {
                authManager.state.first { it is AuthState.Success }
                AppContainer.restauradorDeArchivos.restaurar(applicationContext)
            }
        }
        setContent {
            OSfitTheme {
                OSfitApp(authManager = authManager)
            }
        }
    }
}
