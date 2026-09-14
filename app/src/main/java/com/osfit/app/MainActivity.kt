package com.osfit.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import com.osfit.app.auth.AuthManager
import com.osfit.app.auth.AuthState
import com.osfit.app.data.AppContainer
import com.osfit.app.notificaciones.Notificaciones
import com.osfit.app.ui.OSfitApp
import com.osfit.app.ui.theme.OSfitTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val authManager = AuthManager()

    /**
     * Se registra como campo porque `registerForActivityResult` exige hacerlo antes de que la
     * actividad arranque; dentro de `onCreate` ya sería tarde y truena.
     *
     * No hay callback: si el entrenador dice que no, la app funciona igual —el nombre se sigue
     * pintando de amarillo en la lista, que es la fuente de verdad—, solo se pierde el aviso.
     */
    private val pedirPermisoDeNotificaciones =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        prepararNotificaciones()
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

    /**
     * Deja el teléfono listo para recibir los avisos de "hoy no voy a poder ir".
     *
     * Corre en cada arranque a propósito: las dos llamadas son idempotentes y baratas, y así
     * no hay que recordar en ningún lado si este teléfono ya estaba puesto. Es también lo que
     * hace que instalar la app en un teléfono nuevo lo suscriba solo.
     *
     * No espera a la sesión de Firebase como la restauración de archivos: nada de esto toca
     * Firestore, y el tema de FCM no depende de quién haya iniciado sesión.
     */
    private fun prepararNotificaciones() {
        Notificaciones.crearCanal(this)
        Notificaciones.suscribirAlTema()

        val faltaPermiso = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        if (faltaPermiso) {
            pedirPermisoDeNotificaciones.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
