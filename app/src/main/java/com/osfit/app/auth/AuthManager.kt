package com.osfit.app.auth

import com.google.firebase.auth.FirebaseAuth
import com.osfit.app.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface AuthState {
    data object Loading : AuthState
    data object Success : AuthState
    data class Error(val message: String) : AuthState
}

class AuthManager(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
) {
    private val _state = MutableStateFlow<AuthState>(AuthState.Loading)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    fun iniciarSesionSilenciosa() {
        _state.value = AuthState.Loading

        if (auth.currentUser != null) {
            _state.value = AuthState.Success
            return
        }

        // Las credenciales entran por BuildConfig desde local.properties, que no se versiona:
        // en una máquina recién configurada llegan vacías y Firebase revienta con un
        // IllegalArgumentException que no dice qué falta. Mejor decirlo aquí.
        if (BuildConfig.AUTH_EMAIL.isBlank() || BuildConfig.AUTH_PASSWORD.isBlank()) {
            _state.value = AuthState.Error(
                "Faltan las credenciales de acceso. Agrega osfit.auth.email y " +
                    "osfit.auth.password a local.properties (ver local.properties.example) " +
                    "y vuelve a compilar."
            )
            return
        }

        auth.signInWithEmailAndPassword(BuildConfig.AUTH_EMAIL, BuildConfig.AUTH_PASSWORD)
            .addOnSuccessListener {
                _state.value = AuthState.Success
            }
            .addOnFailureListener { e ->
                _state.value = AuthState.Error(e.message ?: "No se pudo conectar")
            }
    }
}
