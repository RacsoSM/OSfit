package com.osfit.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.osfit.app.auth.AuthManager
import com.osfit.app.ui.OSfitApp
import com.osfit.app.ui.theme.OSfitTheme

class MainActivity : ComponentActivity() {

    private val authManager = AuthManager()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            OSfitTheme {
                OSfitApp(authManager = authManager)
            }
        }
    }
}
