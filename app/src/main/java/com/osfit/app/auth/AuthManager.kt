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

        auth.signInWithEmailAndPassword(BuildConfig.AUTH_EMAIL, BuildConfig.AUTH_PASSWORD)
            .addOnSuccessListener {
                _state.value = AuthState.Success
            }
            .addOnFailureListener { e ->
                _state.value = AuthState.Error(e.message ?: "No se pudo conectar")
            }
    }
}
