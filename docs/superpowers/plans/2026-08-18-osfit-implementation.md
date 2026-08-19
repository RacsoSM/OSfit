# OSfit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build OSfit, an Android-native (Kotlin + Jetpack Compose, MVVM) personal app for a personal trainer and their father to manage gym clients: client list with payment status, monthly attendance calendar with automatic routine-day progression, reusable routine templates, and payment history — backed by Firebase Auth (silent sign-in) + Cloud Firestore, no client-facing access.

**Architecture:** Single-module Android app. `data/model` holds plain Kotlin data classes mirroring Firestore documents. `data/repository` wraps Firestore CRUD + realtime `Flow` listeners behind small repository classes, constructed once in `AppContainer`. `domain/RutinaProgressCalculator` is a pure, dependency-free function holding the one piece of business logic with real bug risk (routine-day advancement) — it is unit tested in isolation. `ui/<feature>` holds one `ViewModel` + one or more `@Composable` screens per feature (clientes, calendario, rutinas), wired through a single `NavHost` with a persistent bottom navigation bar. Firebase Auth is silent: a fixed email/password pair baked into `BuildConfig` at build time signs in automatically on launch; there is no login screen, only a retry screen for the rare auth failure.

**Tech Stack:** Kotlin 2.0.21, Jetpack Compose (BOM 2024.10.00), Material 3, AGP 8.6.1, Gradle 8.9, Firebase BOM 33.5.1 (Auth + Firestore, `-ktx`), `kotlinx-coroutines-play-services` (for `Task.await()`), Navigation Compose 2.8.3, JUnit 4 for unit tests.

**Spec:** [docs/superpowers/specs/2026-08-18-osfit-gym-manager-design.md](../specs/2026-08-18-osfit-gym-manager-design.md)

## Global Constraints

- Android nativo únicamente (sin iOS), Kotlin + Jetpack Compose, arquitectura MVVM.
- Sin backend propio: solo Firebase Auth + Cloud Firestore (plan gratuito Spark).
- Sin pantalla de login visible: autenticación silenciosa con credenciales fijas en configuración de build, no tecleadas por el usuario.
- Sin notificaciones push en v1.
- Sin acceso ni cuenta para clientes.
- Escala: 1–15 clientes activos — no diseñar para escala mayor (sin paginación, sin caché manual adicional a la de Firestore).
- `asistencias` es colección de nivel superior (no subcolección de cliente) para poder consultar todos los clientes de una fecha con una sola query.
- `rutinaAsignada` dentro de un cliente es una copia independiente — editarla no debe afectar la plantilla origen ni otros clientes.
- Validaciones mínimas: nombre de cliente obligatorio; monto de pago no vacío ni negativo.
- Sin conexión: debe seguir funcionando vía caché local de Firestore, sin pantallas de error intrusivas. Solo la falla de autenticación silenciosa muestra una pantalla de error con reintento.
- Pruebas unitarias solo para la función de avance de `diaActualIndex`; el resto se valida manualmente en los dos dispositivos.

---

## Decisiones de diseño no explícitas en el spec (asunciones tomadas)

Estas decisiones rellenan huecos que el spec no cubre literalmente. Están aquí para que quien ejecute el plan no las re-derive ni las cambie sin avisar al usuario:

1. **`fechaProximoPago` al registrar un pago:** el spec no dice cómo se calcula. Se asume que el entrenador la **introduce manualmente** en el formulario de "Registrar pago", con un valor por defecto de `fecha del pago + 30 días` que puede editar libremente antes de guardar (cubre ciclos semanales, quincenales o mensuales sin código adicional).
2. **Anidar `Rutina` dentro de `Cliente.rutinaAsignada`:** el Firestore Android SDK no permite `@DocumentId` en un objeto que también se usa anidado (lanza excepción en tiempo de ejecución). Por eso ningún modelo usa `@DocumentId`; el campo `id` es un `String` plano que se asigna manualmente con `documento.id` al leer, y se limpia (`copy(id = "")`) antes de escribir para no duplicar el id dentro del propio documento.
3. **Marcar "Asistió" sin rutina asignada:** no tiene sentido pedir un día del ciclo si el cliente no tiene `rutinaAsignada`. La UI de Calendario deshabilita el control "Asistió" (deja solo "Faltó") mientras `rutinaAsignada == null`, con un texto indicándolo.
4. **Re-marcar la asistencia de un cliente en la misma fecha:** para evitar registros duplicados si el entrenador corrige un toque accidental, `AsistenciaRepository.registrarAsistencia` busca primero si ya existe un documento con ese `clienteId` + `fecha` y lo sobrescribe en vez de crear uno nuevo. **Limitación conocida y aceptada:** si se corrige una asistencia antigua después de que `diaActualIndex` ya avanzó por sesiones posteriores, el recálculo no retrocede esas sesiones futuras — igual que el spec acepta "gana la última escritura" para conflictos multi-dispositivo, aquí se acepta que corregir el pasado no reconstruye el futuro. No se construye undo/redo para esto.
5. **Versiones de Gradle/AGP/Compose/Firebase:** fijadas explícitamente (ver Tech Stack) en vez de usar un Version Catalog generado por el wizard de Android Studio, para que este plan sea determinista sin depender de qué versión exacta del wizard generó el proyecto.

---

### Task 0: Prerrequisito manual — Proyecto Firebase (Auth + Firestore)

Esta tarea la ejecuta una persona (no un agente): requiere navegador y una cuenta Google. Es bloqueante para todas las tareas siguientes que tocan Firebase.

**Files:** ninguno (configuración fuera del repositorio).

- [ ] **Paso 1: Crear el proyecto en Firebase Console**

  Ir a https://console.firebase.google.com/, crear un proyecto nuevo llamado `OSfit` (Google Analytics: desactivado, no se necesita).

- [ ] **Paso 2: Registrar la app Android**

  Dentro del proyecto, "Agregar app" → Android. Nombre de paquete: `com.osfit.app`. Apodo: `OSfit`. Descargar el archivo `google-services.json` generado y guardarlo temporalmente fuera del repo (se usará en Task 2). No hace falta configurar el SDK de Firebase manualmente en esta pantalla — eso lo hace el proyecto Gradle en tareas siguientes.

- [ ] **Paso 3: Habilitar Authentication con Email/Password**

  En el menú lateral → Build → Authentication → "Comenzar" → pestaña "Sign-in method" → habilitar el proveedor **Correo electrónico/contraseña**.

- [ ] **Paso 4: Crear el usuario fijo de la app**

  En Authentication → pestaña "Users" → "Add user". Crear un único usuario con un correo y contraseña elegidos por ti (por ejemplo `app@osfit.internal` con una contraseña fuerte generada). **Anota este correo y contraseña** — se necesitan en Task 3 para `local.properties`. Este es el único usuario que existirá; ambos dispositivos (tuyo y el de tu papá) inician sesión con las mismas credenciales.

- [ ] **Paso 5: Crear la base de datos Firestore**

  Menú lateral → Build → Firestore Database → "Crear base de datos". Elegir modo de producción (las reglas de seguridad se configuran en Task 4) y la región más cercana. No crear ninguna colección manualmente todavía — las colecciones (`clientes`, `rutinas`, `asistencias`, subcolección `pagos`) se crean solas la primera vez que la app escribe en ellas.

- [ ] **Checklist de salida de esta tarea**

  Al terminar deberías tener: (a) `google-services.json` descargado y guardado en un lugar accesible, (b) un correo/contraseña de usuario fijo anotado, (c) Firestore en modo producción y vacío, listo para reglas de seguridad.

---

### Task 1: Prerrequisito manual — Crear el proyecto Android Studio

También es una tarea manual (requiere la GUI de Android Studio para generar correctamente el Gradle Wrapper). Las tareas siguientes sobrescriben la mayoría de los archivos generados con contenido exacto, así que la configuración del wizard solo necesita ser aproximada.

**Files:** genera `app/`, `gradle/wrapper/`, `gradlew`, `gradlew.bat`, `settings.gradle.kts`, `build.gradle.kts` (raíz), `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`, código Kotlin de plantilla.

- [ ] **Paso 1: Nuevo proyecto**

  Abrir Android Studio → "New Project" → plantilla **Empty Activity** (la que usa Jetpack Compose, no la "Empty Views Activity"). Configurar:
  - Name: `OSfit`
  - Package name: `com.osfit.app`
  - Save location: `C:\Users\SISTEMAS-03\Desktop\OSfit` (la raíz del repo que ya existe con `docs/`; Android Studio debe crear `app/`, `gradle/`, etc. directamente ahí, sin crear una subcarpeta `OSfit/OSfit`)
  - Language: Kotlin
  - Minimum SDK: API 26 ("Android 8.0 Oreo")
  - Build configuration language: Kotlin DSL (`build.gradle.kts`)

- [ ] **Paso 2: Verificar que compila antes de tocar nada**

  Ejecutar en una terminal, desde la raíz del repo:

  ```
  ./gradlew assembleDebug
  ```

  Expected: `BUILD SUCCESSFUL`. Si falla aquí, es un problema del entorno (SDK/JDK) que debe resolverse antes de seguir — no continuar con Task 2 hasta que este build pase.

- [ ] **Paso 3: Confirmar la ubicación de `google-services.json`**

  Copiar el `google-services.json` descargado en Task 0 a `app/google-services.json` (aún no se usará hasta Task 2, pero déjalo listo).

- [ ] **No hacer commit todavía** — Task 2 añade `.gitignore` antes del primer commit para no versionar `google-services.json`, `local.properties` ni las carpetas de build.

---

### Task 2: Gradle — dependencias de Firebase, Compose y navegación

A partir de aquí, todas las tareas son ejecutables por un agente vía edición de archivos + `./gradlew` en terminal.

**Files:**
- Modify: `settings.gradle.kts`
- Modify: `build.gradle.kts` (raíz)
- Modify: `app/build.gradle.kts`
- Create: `.gitignore`

**Interfaces:**
- Produces: dependencias disponibles para todas las tareas siguientes (`com.google.firebase:firebase-auth-ktx`, `com.google.firebase:firebase-firestore-ktx`, `androidx.navigation:navigation-compose`, `org.jetbrains.kotlinx:kotlinx-coroutines-play-services`).

- [ ] **Paso 1: Reescribir `settings.gradle.kts`**

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "OSfit"
include(":app")
```

- [ ] **Paso 2: Reescribir `build.gradle.kts` (raíz)**

```kotlin
plugins {
    id("com.android.application") version "8.6.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
}
```

- [ ] **Paso 3: Reescribir `app/build.gradle.kts`**

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.osfit.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.osfit.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.10.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.3")

    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    testImplementation("junit:junit:4.13.2")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
```

- [ ] **Paso 4: Crear `.gitignore`**

```
*.iml
.gradle/
/local.properties
/app/google-services.json
.idea/
.DS_Store
/build/
/app/build/
/captures/
.externalNativeBuild/
.cxx/
```

- [ ] **Paso 5: Sincronizar y compilar**

```
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. El plugin `google-services` fallará aquí si `app/google-services.json` no existe todavía (colocado en Task 1, paso 3) — verificar que el archivo está en su sitio si falla con "File google-services.json is missing".

- [ ] **Paso 6: Commit**

```bash
git add settings.gradle.kts build.gradle.kts app/build.gradle.kts .gitignore app/src gradle gradlew gradlew.bat app/proguard-rules.pro
git commit -m "chore: scaffold Android project with Firebase, Compose and Navigation dependencies"
```

---

### Task 3: Credenciales de autenticación silenciosa (`local.properties` → `BuildConfig`)

**Files:**
- Modify: `app/build.gradle.kts`
- Create: `local.properties.example`

**Interfaces:**
- Produces: `BuildConfig.AUTH_EMAIL: String`, `BuildConfig.AUTH_PASSWORD: String`, consumidos por `AuthManager` (Task 7).

- [ ] **Paso 1: Añadir lectura de `local.properties` en `app/build.gradle.kts`**

Añadir al principio del archivo (antes de `plugins { ... }` no es necesario, pero antes del bloque `android { ... }` sí):

```kotlin
import java.util.Properties
import java.io.FileInputStream

val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        load(FileInputStream(localPropertiesFile))
    }
}
```

Y dentro de `defaultConfig { ... }`, agregar:

```kotlin
        buildConfigField(
            "String",
            "AUTH_EMAIL",
            "\"${localProperties.getProperty("osfit.auth.email", "")}\""
        )
        buildConfigField(
            "String",
            "AUTH_PASSWORD",
            "\"${localProperties.getProperty("osfit.auth.password", "")}\""
        )
```

- [ ] **Paso 2: Crear `local.properties.example` (plantilla versionada, sin secretos reales)**

```properties
sdk.dir=C\:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk
osfit.auth.email=app@osfit.internal
osfit.auth.password=CAMBIA_ESTA_CONTRASENA
```

- [ ] **Paso 3: Rellenar el `local.properties` real (no versionado) con las credenciales de Task 0**

Editar (o crear si no existe) `local.properties` en la raíz del repo, añadiendo las dos líneas `osfit.auth.email` y `osfit.auth.password` con el correo/contraseña creados en Task 0, paso 4. `local.properties` ya está en `.gitignore` desde Task 2.

- [ ] **Paso 4: Verificar que `BuildConfig` se genera correctamente**

```
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. Confirmar que el archivo generado existe y contiene los campos:

```
Get-ChildItem -Recurse -Filter BuildConfig.java app\build\generated | Select-Object -First 1 | Get-Content | Select-String "AUTH_"
```

Expected: dos líneas `public static final String AUTH_EMAIL = "..."` y `AUTH_PASSWORD = "..."`.

- [ ] **Paso 5: Commit**

```bash
git add app/build.gradle.kts local.properties.example
git commit -m "feat: read auth credentials from local.properties into BuildConfig"
```

---

### Task 4: Reglas de seguridad de Firestore

**Files:**
- Create: `firestore.rules`

- [ ] **Paso 1: Escribir las reglas**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Con un único usuario fijo (Task 0), "cualquier usuario autenticado" equivale a "solo el entrenador y su papá", que es la garantía que pide el spec (silencioso mientras protege los datos).

- [ ] **Paso 2: Publicar las reglas manualmente (acción humana, fuera del repo)**

En Firebase Console → Firestore Database → pestaña "Rules" → pegar el contenido de `firestore.rules` → "Publish". (Opcional para quien tenga Firebase CLI instalado: `firebase deploy --only firestore:rules`, pero no es requisito de este plan instalar la CLI.)

- [ ] **Paso 3: Commit**

```bash
git add firestore.rules
git commit -m "docs: add Firestore security rules restricting access to authenticated users"
```

---

### Task 5: `RutinaProgressCalculator` — lógica de avance de rutina (TDD)

La pieza de lógica de negocio más delicada del proyecto. Función pura, sin dependencias de Android ni Firebase — se puede testear con `./gradlew test` sin emulador.

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt`
- Test: `app/src/test/java/com/osfit/app/domain/RutinaProgressCalculatorTest.kt`

**Interfaces:**
- Produces: `RutinaProgressCalculator.calcularSiguienteDiaActualIndex(asistio: Boolean, diaActualIndexPrevio: Int, diaRutinaRealizado: Int?, totalDias: Int): Int` — consumido por `AsistenciaRepository` (Task 9).

- [ ] **Paso 1: Escribir los tests (fallarán, la función no existe todavía)**

```kotlin
package com.osfit.app.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RutinaProgressCalculatorTest {

    @Test
    fun `falta no cambia el diaActualIndex`() {
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = false,
            diaActualIndexPrevio = 2,
            diaRutinaRealizado = null,
            totalDias = 5
        )
        assertEquals(2, resultado)
    }

    @Test
    fun `asiste al dia que tocaba y avanza al siguiente`() {
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = 1,
            diaRutinaRealizado = 1,
            totalDias = 5
        )
        assertEquals(2, resultado)
    }

    @Test
    fun `asiste al ultimo dia del ciclo y vuelve al dia 1`() {
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = 4,
            diaRutinaRealizado = 4,
            totalDias = 5
        )
        assertEquals(0, resultado)
    }

    @Test
    fun `entrenador anula el dia sugerido y avanza segun el dia realizado, no el que tocaba`() {
        // Tocaba el día 1 (index 1), pero el cliente en realidad hizo el día 3 (index 3, pierna glúteo)
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = 1,
            diaRutinaRealizado = 3,
            totalDias = 5
        )
        assertEquals(4, resultado)
    }

    @Test
    fun `falto el dia 3, la siguiente vez que asista sigue tocando el dia 3`() {
        // Simula la secuencia completa del ejemplo del spec:
        // faltó cuando tocaba día 3 (index 2) -> index no cambia
        val trasFalta = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = false,
            diaActualIndexPrevio = 2,
            diaRutinaRealizado = null,
            totalDias = 5
        )
        assertEquals(2, trasFalta)
        // en su siguiente sesión asiste e hizo el día pendiente (index 2) -> avanza al 3
        val trasAsistir = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = trasFalta,
            diaRutinaRealizado = 2,
            totalDias = 5
        )
        assertEquals(3, trasAsistir)
    }

    @Test
    fun `ciclo de un solo dia siempre vuelve al dia 1`() {
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = 0,
            diaRutinaRealizado = 0,
            totalDias = 1
        )
        assertEquals(0, resultado)
    }

    @Test
    fun `lanza excepcion si asistio es true sin diaRutinaRealizado`() {
        assertThrows(IllegalArgumentException::class.java) {
            RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
                asistio = true,
                diaActualIndexPrevio = 0,
                diaRutinaRealizado = null,
                totalDias = 5
            )
        }
    }

    @Test
    fun `lanza excepcion si totalDias es cero o negativo`() {
        assertThrows(IllegalArgumentException::class.java) {
            RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
                asistio = false,
                diaActualIndexPrevio = 0,
                diaRutinaRealizado = null,
                totalDias = 0
            )
        }
    }

    @Test
    fun `lanza excepcion si diaRutinaRealizado esta fuera de rango`() {
        assertThrows(IllegalArgumentException::class.java) {
            RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
                asistio = true,
                diaActualIndexPrevio = 0,
                diaRutinaRealizado = 5,
                totalDias = 5
            )
        }
    }
}
```

- [ ] **Paso 2: Ejecutar los tests y verificar que fallan (la función no existe)**

```
./gradlew test --tests "com.osfit.app.domain.RutinaProgressCalculatorTest"
```

Expected: FAIL con error de compilación "unresolved reference: RutinaProgressCalculator".

- [ ] **Paso 3: Implementar la función**

```kotlin
package com.osfit.app.domain

/**
 * Calcula el próximo día del ciclo de rutina que le toca a un cliente
 * después de marcar su asistencia en una fecha.
 */
object RutinaProgressCalculator {

    fun calcularSiguienteDiaActualIndex(
        asistio: Boolean,
        diaActualIndexPrevio: Int,
        diaRutinaRealizado: Int?,
        totalDias: Int
    ): Int {
        require(totalDias > 0) { "totalDias debe ser mayor a 0, fue $totalDias" }

        if (!asistio) {
            return diaActualIndexPrevio
        }

        val realizado = requireNotNull(diaRutinaRealizado) {
            "diaRutinaRealizado es obligatorio cuando asistio = true"
        }
        require(realizado in 0 until totalDias) {
            "diaRutinaRealizado ($realizado) fuera de rango [0, $totalDias)"
        }

        val siguiente = realizado + 1
        return if (siguiente >= totalDias) 0 else siguiente
    }
}
```

- [ ] **Paso 4: Ejecutar los tests y verificar que pasan**

```
./gradlew test --tests "com.osfit.app.domain.RutinaProgressCalculatorTest"
```

Expected: `BUILD SUCCESSFUL`, 9 tests OK.

- [ ] **Paso 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt app/src/test/java/com/osfit/app/domain/RutinaProgressCalculatorTest.kt
git commit -m "feat: add RutinaProgressCalculator with unit tests for routine-day advancement"
```

---

### Task 6: Modelos de datos Firestore

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/Ejercicio.kt`
- Create: `app/src/main/java/com/osfit/app/data/model/DiaRutina.kt`
- Create: `app/src/main/java/com/osfit/app/data/model/Rutina.kt`
- Create: `app/src/main/java/com/osfit/app/data/model/Cliente.kt`
- Create: `app/src/main/java/com/osfit/app/data/model/Pago.kt`
- Create: `app/src/main/java/com/osfit/app/data/model/Asistencia.kt`

**Interfaces:**
- Produces: todos los data classes consumidos por los repositorios (Tasks 8–11) y por las pantallas (Tasks 13–17). Todos usan `id: String = ""` como campo plano (nunca `@DocumentId`, ver decisión de diseño #2) y valores por defecto en cada propiedad (requisito de Firestore para deserializar con `toObject()`).

- [ ] **Paso 1: `Ejercicio.kt`**

```kotlin
package com.osfit.app.data.model

data class Ejercicio(
    val nombre: String = "",
    val series: Int = 0,
    val repeticiones: String = "",
    val pesoONota: String = ""
)
```

- [ ] **Paso 2: `DiaRutina.kt`**

```kotlin
package com.osfit.app.data.model

data class DiaRutina(
    val nombreDia: String = "",
    val ejercicios: List<Ejercicio> = emptyList()
)
```

- [ ] **Paso 3: `Rutina.kt`**

```kotlin
package com.osfit.app.data.model

data class Rutina(
    val id: String = "",
    val nombre: String = "",
    val dias: List<DiaRutina> = emptyList()
)
```

- [ ] **Paso 4: `Cliente.kt`**

```kotlin
package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class Cliente(
    val id: String = "",
    val nombre: String = "",
    val telefono: String = "",
    val activo: Boolean = true,
    val rutinaAsignada: Rutina? = null,
    val plantillaOrigenId: String = "",
    val diaActualIndex: Int = 0,
    val fechaProximoPago: Timestamp? = null
)
```

- [ ] **Paso 5: `Pago.kt`**

```kotlin
package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class Pago(
    val id: String = "",
    val monto: Double = 0.0,
    val fecha: Timestamp = Timestamp.now(),
    val fechaProximoPagoGenerada: Timestamp = Timestamp.now(),
    val nota: String = ""
)
```

- [ ] **Paso 6: `Asistencia.kt`**

```kotlin
package com.osfit.app.data.model

data class Asistencia(
    val id: String = "",
    val clienteId: String = "",
    val fecha: String = "",
    val asistio: Boolean = false,
    val diaRutinaRealizado: Int? = null,
    val nota: String = ""
)
```

- [ ] **Paso 7: Compilar**

```
./gradlew compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Paso 8: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model
git commit -m "feat: add Firestore data models for cliente, rutina, pago and asistencia"
```

---

### Task 7: `AuthManager` — autenticación silenciosa

**Files:**
- Create: `app/src/main/java/com/osfit/app/auth/AuthManager.kt`

**Interfaces:**
- Consumes: `BuildConfig.AUTH_EMAIL`, `BuildConfig.AUTH_PASSWORD` (Task 3).
- Produces: `AuthState` (`Loading`, `Success`, `Error(message: String)`), `AuthManager.state: StateFlow<AuthState>`, `AuthManager.iniciarSesionSilenciosa()` — consumidos por `MainActivity`/`OSfitApp` (Task 12).

- [ ] **Paso 1: Implementar `AuthManager.kt`**

```kotlin
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
```

- [ ] **Paso 2: Compilar**

```
./gradlew compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Paso 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/auth
git commit -m "feat: add silent Firebase Auth manager with retry-capable state"
```

---

### Task 8: `AppContainer` + `RutinaRepository`

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/AppContainer.kt`
- Create: `app/src/main/java/com/osfit/app/data/repository/RutinaRepository.kt`

**Interfaces:**
- Consumes: `Rutina` (Task 6).
- Produces: `RutinaRepository.observarRutinas(): Flow<List<Rutina>>`, `suspend fun guardarRutina(rutina: Rutina): String`, `suspend fun eliminarRutina(rutinaId: String)`, `suspend fun obtenerRutina(rutinaId: String): Rutina?` — consumidos por Tasks 9, 14, 17. `AppContainer.rutinaRepository` — patrón repetido por Tasks 9–11.

- [ ] **Paso 1: `AppContainer.kt`**

```kotlin
package com.osfit.app.data

import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RutinaRepository

object AppContainer {
    val rutinaRepository: RutinaRepository by lazy { RutinaRepository() }
    val clienteRepository: ClienteRepository by lazy { ClienteRepository() }
    val pagoRepository: PagoRepository by lazy { PagoRepository() }
    val asistenciaRepository: AsistenciaRepository by lazy { AsistenciaRepository() }
}
```

(Este archivo referenciará clases que aún no existen hasta que termine Task 11 — está bien, la compilación completa del módulo se verifica al final de Task 11. En este paso solo confirma que el propio `RutinaRepository` compila de forma aislada con `compileDebugKotlin`, que reporta todos los errores del módulo a la vez; ignora errores sobre `ClienteRepository`, `PagoRepository`, `AsistenciaRepository` "unresolved reference" en este paso — se resuelven en las tareas siguientes.)

- [ ] **Paso 2: `RutinaRepository.kt`**

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.Rutina
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class RutinaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("rutinas")

    fun observarRutinas(): Flow<List<Rutina>> = callbackFlow {
        val registro = coleccion.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val rutinas = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(Rutina::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(rutinas)
        }
        awaitClose { registro.remove() }
    }

    suspend fun obtenerRutina(rutinaId: String): Rutina? {
        val doc = coleccion.document(rutinaId).get().await()
        return doc.toObject(Rutina::class.java)?.copy(id = doc.id)
    }

    suspend fun guardarRutina(rutina: Rutina): String {
        return if (rutina.id.isBlank()) {
            val ref = coleccion.add(rutina.copy(id = "")).await()
            ref.id
        } else {
            coleccion.document(rutina.id).set(rutina.copy(id = "")).await()
            rutina.id
        }
    }

    suspend fun eliminarRutina(rutinaId: String) {
        coleccion.document(rutinaId).delete().await()
    }
}
```

- [ ] **Paso 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/AppContainer.kt app/src/main/java/com/osfit/app/data/repository/RutinaRepository.kt
git commit -m "feat: add AppContainer and RutinaRepository for routine templates"
```

---

### Task 9: `ClienteRepository`

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/repository/ClienteRepository.kt`

**Interfaces:**
- Consumes: `Cliente`, `Rutina` (Task 6).
- Produces: `observarClientes(): Flow<List<Cliente>>`, `observarCliente(clienteId: String): Flow<Cliente?>`, `suspend fun crearCliente(nombre: String, telefono: String): String`, `suspend fun asignarRutina(clienteId: String, rutina: Rutina)` — consumidos por Tasks 14, 15, 16, 17.

- [ ] **Paso 1: Implementar**

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Rutina
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class ClienteRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("clientes")

    fun observarClientes(): Flow<List<Cliente>> = callbackFlow {
        val registro = coleccion.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val clientes = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(Cliente::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(clientes)
        }
        awaitClose { registro.remove() }
    }

    fun observarCliente(clienteId: String): Flow<Cliente?> = callbackFlow {
        val registro = coleccion.document(clienteId).addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            trySend(snapshot?.toObject(Cliente::class.java)?.copy(id = snapshot.id))
        }
        awaitClose { registro.remove() }
    }

    suspend fun crearCliente(nombre: String, telefono: String): String {
        val cliente = Cliente(nombre = nombre, telefono = telefono, activo = true, diaActualIndex = 0)
        val ref = coleccion.add(cliente).await()
        return ref.id
    }

    suspend fun asignarRutina(clienteId: String, rutina: Rutina) {
        coleccion.document(clienteId).update(
            mapOf(
                "rutinaAsignada" to rutina,
                "plantillaOrigenId" to rutina.id,
                "diaActualIndex" to 0
            )
        ).await()
    }
}
```

- [ ] **Paso 2: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/repository/ClienteRepository.kt
git commit -m "feat: add ClienteRepository with create and assign-routine operations"
```

---

### Task 10: `PagoRepository`

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/repository/PagoRepository.kt`

**Interfaces:**
- Consumes: `Pago` (Task 6).
- Produces: `observarPagos(clienteId: String): Flow<List<Pago>>`, `suspend fun registrarPago(clienteId: String, monto: Double, fecha: Timestamp, fechaProximoPago: Timestamp, nota: String)` — consumido por Task 15.

- [ ] **Paso 1: Implementar**

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.Pago
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class PagoRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private fun pagosCollection(clienteId: String) =
        db.collection("clientes").document(clienteId).collection("pagos")

    fun observarPagos(clienteId: String): Flow<List<Pago>> = callbackFlow {
        val registro = pagosCollection(clienteId)
            .orderBy("fecha", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val pagos = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Pago::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(pagos)
            }
        awaitClose { registro.remove() }
    }

    suspend fun registrarPago(
        clienteId: String,
        monto: Double,
        fecha: Timestamp,
        fechaProximoPago: Timestamp,
        nota: String
    ) {
        val batch = db.batch()
        val nuevoPagoRef = pagosCollection(clienteId).document()
        val pago = Pago(
            monto = monto,
            fecha = fecha,
            fechaProximoPagoGenerada = fechaProximoPago,
            nota = nota
        )
        batch.set(nuevoPagoRef, pago.copy(id = ""))

        val clienteRef = db.collection("clientes").document(clienteId)
        batch.update(clienteRef, "fechaProximoPago", fechaProximoPago)

        batch.commit().await()
    }
}
```

- [ ] **Paso 2: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/repository/PagoRepository.kt
git commit -m "feat: add PagoRepository, registering a payment updates fechaProximoPago"
```

---

### Task 11: `AsistenciaRepository` (usa `RutinaProgressCalculator`)

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/repository/AsistenciaRepository.kt`

**Interfaces:**
- Consumes: `Asistencia` (Task 6), `RutinaProgressCalculator.calcularSiguienteDiaActualIndex` (Task 5).
- Produces: `observarAsistenciasPorFecha(fecha: String): Flow<List<Asistencia>>`, `suspend fun registrarAsistencia(clienteId: String, fecha: String, asistio: Boolean, diaActualIndexPrevio: Int, diaRutinaRealizado: Int?, totalDiasRutina: Int, nota: String = "")` — consumido por Task 16.

- [ ] **Paso 1: Implementar**

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.Asistencia
import com.osfit.app.domain.RutinaProgressCalculator
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class AsistenciaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("asistencias")
    private val clientesCollection = db.collection("clientes")

    fun observarAsistenciasPorFecha(fecha: String): Flow<List<Asistencia>> = callbackFlow {
        val registro = coleccion.whereEqualTo("fecha", fecha)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val asistencias = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Asistencia::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(asistencias)
            }
        awaitClose { registro.remove() }
    }

    suspend fun registrarAsistencia(
        clienteId: String,
        fecha: String,
        asistio: Boolean,
        diaActualIndexPrevio: Int,
        diaRutinaRealizado: Int?,
        totalDiasRutina: Int,
        nota: String = ""
    ) {
        val siguienteDiaActualIndex = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = asistio,
            diaActualIndexPrevio = diaActualIndexPrevio,
            diaRutinaRealizado = diaRutinaRealizado,
            totalDias = totalDiasRutina
        )

        val asistenciaExistente = coleccion
            .whereEqualTo("clienteId", clienteId)
            .whereEqualTo("fecha", fecha)
            .limit(1)
            .get()
            .await()

        val asistenciaRef = if (!asistenciaExistente.isEmpty) {
            asistenciaExistente.documents.first().reference
        } else {
            coleccion.document()
        }

        val asistencia = Asistencia(
            clienteId = clienteId,
            fecha = fecha,
            asistio = asistio,
            diaRutinaRealizado = if (asistio) diaRutinaRealizado else null,
            nota = nota
        )

        val batch = db.batch()
        batch.set(asistenciaRef, asistencia.copy(id = ""))
        if (asistio) {
            batch.update(clientesCollection.document(clienteId), "diaActualIndex", siguienteDiaActualIndex)
        }
        batch.commit().await()
    }
}
```

- [ ] **Paso 2: Compilar el módulo completo (ahora `AppContainer` referencia las 4 clases ya existentes)**

```
./gradlew compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Paso 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/repository/AsistenciaRepository.kt
git commit -m "feat: add AsistenciaRepository wiring RutinaProgressCalculator into attendance writes"
```

---

### Task 12: Shell de la app — tema, navegación, gate de autenticación

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/theme/Theme.kt`
- Create: `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt`
- Create: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`
- Create: `app/src/main/java/com/osfit/app/ui/common/ErrorScreen.kt`
- Create: `app/src/main/java/com/osfit/app/ui/OSfitApp.kt`
- Modify: `app/src/main/java/com/osfit/app/MainActivity.kt`
- Modify: `app/src/main/AndroidManifest.xml`
- Delete: cualquier archivo de plantilla sobrante del wizard (p. ej. `ui/theme/Color.kt`, `Type.kt` si el wizard los generó por separado — se consolidan en `Theme.kt`)

**Interfaces:**
- Consumes: `AuthManager`, `AuthState` (Task 7).
- Produces: `Screen` (rutas `Clientes`, `Calendario`, `Rutinas`, `ClienteDetail`, `RutinaEditor`), `OSfitApp()` — punto de entrada consumido por Tasks 13–17 (cada una añade su `composable(...)` dentro de `OSfitNavHost`).

- [ ] **Paso 1: `ui/theme/Theme.kt`**

```kotlin
package com.osfit.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val AzulOscuro = Color(0xFF1B5E20)
private val AzulClaro = Color(0xFF4CAF50)

private val EsquemaOscuro = darkColorScheme(primary = AzulClaro)
private val EsquemaClaro = lightColorScheme(primary = AzulOscuro)

@Composable
fun OSfitTheme(content: @Composable () -> Unit) {
    val colorScheme = if (isSystemInDarkTheme()) EsquemaOscuro else EsquemaClaro
    MaterialTheme(colorScheme = colorScheme, content = content)
}
```

- [ ] **Paso 2: `ui/navigation/Screen.kt`**

```kotlin
package com.osfit.app.ui.navigation

sealed class Screen(val route: String) {
    data object Clientes : Screen("clientes")
    data object Calendario : Screen("calendario")
    data object Rutinas : Screen("rutinas")

    data object ClienteDetail : Screen("cliente_detail/{clienteId}") {
        fun crearRuta(clienteId: String) = "cliente_detail/$clienteId"
    }

    data object RutinaEditor : Screen("rutina_editor?rutinaId={rutinaId}") {
        const val ARG_RUTINA_NUEVA = "nueva"
        fun crearRuta(rutinaId: String? = null) = "rutina_editor?rutinaId=${rutinaId ?: ARG_RUTINA_NUEVA}"
    }
}

val screensConBarraInferior = listOf(Screen.Clientes, Screen.Calendario, Screen.Rutinas)
```

- [ ] **Paso 3: `ui/common/ErrorScreen.kt`**

```kotlin
package com.osfit.app.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ErrorScreen(mensaje: String, onReintentar: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("No se pudo conectar", style = MaterialTheme.typography.titleLarge)
        Text(mensaje, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 12.dp))
        Button(onClick = onReintentar) {
            Text("Reintentar")
        }
    }
}
```

- [ ] **Paso 4: `ui/navigation/OSfitNavHost.kt`** (placeholder mínimo por pantalla — cada `composable` real se completa en su propia tarea; este archivo se **edita**, no se reescribe, en Tasks 13–17)

```kotlin
package com.osfit.app.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
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
            Text("Clientes", modifier = Modifier.padding(16.dp))
        }
        composable(Screen.Calendario.route) {
            Text("Calendario", modifier = Modifier.padding(16.dp))
        }
        composable(Screen.Rutinas.route) {
            Text("Rutinas", modifier = Modifier.padding(16.dp))
        }
        composable(
            route = Screen.ClienteDetail.route,
            arguments = listOf(navArgument("clienteId") { type = NavType.StringType })
        ) { backStackEntry ->
            val clienteId = backStackEntry.arguments?.getString("clienteId") ?: return@composable
            Text("Detalle de $clienteId", modifier = Modifier.padding(16.dp))
        }
        composable(
            route = Screen.RutinaEditor.route,
            arguments = listOf(navArgument("rutinaId") { type = NavType.StringType; defaultValue = Screen.RutinaEditor.ARG_RUTINA_NUEVA })
        ) { backStackEntry ->
            val rutinaId = backStackEntry.arguments?.getString("rutinaId")
            Text("Editor de rutina $rutinaId", modifier = Modifier.padding(16.dp))
        }
    }
}
```

- [ ] **Paso 5: `ui/OSfitApp.kt`**

```kotlin
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
```

- [ ] **Paso 6: Reescribir `MainActivity.kt`**

```kotlin
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
```

- [ ] **Paso 7: Añadir la dependencia de `material-icons-extended` (usada en el paso 5) al `app/build.gradle.kts`**

Agregar dentro del bloque `dependencies { ... }`:

```kotlin
    implementation("androidx.compose.material:material-icons-extended")
```

- [ ] **Paso 8: Eliminar archivos de plantilla sobrantes**

Si el wizard generó `app/src/main/java/com/osfit/app/ui/theme/Color.kt` y `Type.kt` por separado, elimínalos (su contenido queda consolidado en `Theme.kt` del paso 1).

- [ ] **Paso 9: Compilar e instalar en un emulador/dispositivo para verificación manual**

```
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. Instalar el APK y verificar manualmente: la app arranca, muestra un spinner brevemente, y aterriza en la pantalla "Clientes" con la barra inferior de 3 pestañas navegable. Si Firebase Auth falla (credenciales mal copiadas en Task 3), debe verse la pantalla "No se pudo conectar" con botón "Reintentar".

- [ ] **Paso 10: Commit**

```bash
git add app/src/main/java/com/osfit/app app/src/main/AndroidManifest.xml app/build.gradle.kts
git commit -m "feat: app shell with silent-auth gate, bottom navigation and nav host"
```

---

### Task 13: Pantalla Rutinas — lista y editor de plantillas

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/rutinas/RutinasViewModel.kt`
- Create: `app/src/main/java/com/osfit/app/ui/rutinas/RutinasListScreen.kt`
- Create: `app/src/main/java/com/osfit/app/ui/rutinas/RutinaEditorViewModel.kt`
- Create: `app/src/main/java/com/osfit/app/ui/rutinas/RutinaEditorScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`

**Interfaces:**
- Consumes: `AppContainer.rutinaRepository` (Task 8), `Screen.Rutinas`, `Screen.RutinaEditor` (Task 12).
- Produces: pantallas completas de gestión de plantillas — no consumidas por otras tareas de código, pero `Screen.RutinaEditor.crearRuta(rutinaId)` es usada por Task 15 (botón "Asignar/cambiar rutina" navega indirectamente vía selección, no vía este editor).

- [ ] **Paso 1: `RutinasViewModel.kt`**

```kotlin
package com.osfit.app.ui.rutinas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.RutinaRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class RutinasViewModel(
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository
) : ViewModel() {

    val rutinas: StateFlow<List<Rutina>> = rutinaRepository.observarRutinas()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun eliminarRutina(rutinaId: String) {
        viewModelScope.launch {
            rutinaRepository.eliminarRutina(rutinaId)
        }
    }
}
```

- [ ] **Paso 2: `RutinasListScreen.kt`**

```kotlin
package com.osfit.app.ui.rutinas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.Rutina

@Composable
fun RutinasListScreen(
    onCrearRutina: () -> Unit,
    onEditarRutina: (String) -> Unit,
    viewModel: RutinasViewModel = viewModel()
) {
    val rutinas by viewModel.rutinas.collectAsState()

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = onCrearRutina) {
                Icon(Icons.Filled.Add, contentDescription = "Nueva rutina")
            }
        }
    ) { padding ->
        if (rutinas.isEmpty()) {
            Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                Text("Aún no hay plantillas de rutina. Toca + para crear una.")
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(rutinas, key = { it.id }) { rutina ->
                    RutinaItem(rutina = rutina, onClick = { onEditarRutina(rutina.id) }, onEliminar = { viewModel.eliminarRutina(rutina.id) })
                }
            }
        }
    }
}

@Composable
private fun RutinaItem(rutina: Rutina, onClick: () -> Unit, onEliminar: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp).let { it }) {
                Text(rutina.nombre, style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                Text("${rutina.dias.size} día(s)", style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onEliminar) {
                Icon(Icons.Filled.Delete, contentDescription = "Eliminar")
            }
        }
    }
}
```

Nota: el `Card` completo es clicable vía `onClick` — para mantener el ejemplo corto se omitió `Modifier.clickable`; añádelo explícitamente:

- [ ] **Paso 3: Hacer clicable la tarjeta**

En `RutinaItem`, cambia la firma del `Card` a:

```kotlin
Card(
    modifier = Modifier.fillMaxWidth().let { base ->
        base
    },
    onClick = onClick
)
```

Reemplaza esa línea por el uso directo del overload de `Card` que acepta `onClick` (import `androidx.compose.material3.Card` ya soporta `onClick` como parámetro nombrado):

```kotlin
@Composable
private fun RutinaItem(rutina: Rutina, onClick: () -> Unit, onEliminar: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                Text(rutina.nombre, style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                Text("${rutina.dias.size} día(s)", style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onEliminar) {
                Icon(Icons.Filled.Delete, contentDescription = "Eliminar")
            }
        }
    }
}
```

(Esto reemplaza por completo la función `RutinaItem` del Paso 2 — usa esta versión final.)

- [ ] **Paso 4: `RutinaEditorViewModel.kt`**

```kotlin
package com.osfit.app.ui.rutinas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.RutinaRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class RutinaEditorViewModel(
    private val rutinaId: String?,
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository
) : ViewModel() {

    private val _rutina = MutableStateFlow(Rutina())
    val rutina: StateFlow<Rutina> = _rutina.asStateFlow()

    private val _guardado = MutableStateFlow(false)
    val guardado: StateFlow<Boolean> = _guardado.asStateFlow()

    init {
        if (!rutinaId.isNullOrBlank()) {
            viewModelScope.launch {
                rutinaRepository.obtenerRutina(rutinaId)?.let { _rutina.value = it }
            }
        }
    }

    fun cambiarNombre(nombre: String) {
        _rutina.value = _rutina.value.copy(nombre = nombre)
    }

    fun agregarDia() {
        val dias = _rutina.value.dias + DiaRutina(nombreDia = "Día ${_rutina.value.dias.size + 1}")
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun eliminarDia(indiceDia: Int) {
        val dias = _rutina.value.dias.toMutableList().apply { removeAt(indiceDia) }
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun cambiarNombreDia(indiceDia: Int, nombre: String) {
        val dias = _rutina.value.dias.toMutableList()
        dias[indiceDia] = dias[indiceDia].copy(nombreDia = nombre)
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun agregarEjercicio(indiceDia: Int) {
        val dias = _rutina.value.dias.toMutableList()
        val ejercicios = dias[indiceDia].ejercicios + Ejercicio()
        dias[indiceDia] = dias[indiceDia].copy(ejercicios = ejercicios)
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun eliminarEjercicio(indiceDia: Int, indiceEjercicio: Int) {
        val dias = _rutina.value.dias.toMutableList()
        val ejercicios = dias[indiceDia].ejercicios.toMutableList().apply { removeAt(indiceEjercicio) }
        dias[indiceDia] = dias[indiceDia].copy(ejercicios = ejercicios)
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun actualizarEjercicio(indiceDia: Int, indiceEjercicio: Int, ejercicio: Ejercicio) {
        val dias = _rutina.value.dias.toMutableList()
        val ejercicios = dias[indiceDia].ejercicios.toMutableList()
        ejercicios[indiceEjercicio] = ejercicio
        dias[indiceDia] = dias[indiceDia].copy(ejercicios = ejercicios)
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun guardar() {
        viewModelScope.launch {
            rutinaRepository.guardarRutina(_rutina.value)
            _guardado.value = true
        }
    }
}
```

- [ ] **Paso 5: `RutinaEditorScreen.kt`**

```kotlin
package com.osfit.app.ui.rutinas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.compose.viewModelFactory
import androidx.lifecycle.viewmodel.initializer
import com.osfit.app.data.model.Ejercicio

@Composable
fun RutinaEditorScreen(rutinaId: String?, onGuardado: () -> Unit) {
    val viewModel: RutinaEditorViewModel = viewModel(
        factory = viewModelFactory { initializer { RutinaEditorViewModel(rutinaId) } }
    )
    val rutina by viewModel.rutina.collectAsState()
    val guardado by viewModel.guardado.collectAsState()

    LaunchedEffect(guardado) {
        if (guardado) onGuardado()
    }

    Scaffold { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                OutlinedTextField(
                    value = rutina.nombre,
                    onValueChange = viewModel::cambiarNombre,
                    label = { Text("Nombre de la rutina") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            itemsIndexed(rutina.dias) { indiceDia, dia ->
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            OutlinedTextField(
                                value = dia.nombreDia,
                                onValueChange = { viewModel.cambiarNombreDia(indiceDia, it) },
                                label = { Text("Nombre del día") },
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(onClick = { viewModel.eliminarDia(indiceDia) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Eliminar día")
                            }
                        }
                        dia.ejercicios.forEachIndexed { indiceEjercicio, ejercicio ->
                            EjercicioRow(
                                ejercicio = ejercicio,
                                onChange = { viewModel.actualizarEjercicio(indiceDia, indiceEjercicio, it) },
                                onEliminar = { viewModel.eliminarEjercicio(indiceDia, indiceEjercicio) }
                            )
                        }
                        Button(onClick = { viewModel.agregarEjercicio(indiceDia) }) {
                            Icon(Icons.Filled.Add, contentDescription = null)
                            Text("Agregar ejercicio")
                        }
                    }
                }
            }
            item {
                Button(onClick = viewModel::agregarDia, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Text("Agregar día")
                }
            }
            item {
                Button(
                    onClick = viewModel::guardar,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = rutina.nombre.isNotBlank() && rutina.dias.isNotEmpty()
                ) {
                    Text("Guardar rutina")
                }
            }
        }
    }
}

@Composable
private fun EjercicioRow(ejercicio: Ejercicio, onChange: (Ejercicio) -> Unit, onEliminar: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        OutlinedTextField(
            value = ejercicio.nombre,
            onValueChange = { onChange(ejercicio.copy(nombre = it)) },
            label = { Text("Ejercicio") },
            modifier = Modifier.weight(2f)
        )
        OutlinedTextField(
            value = if (ejercicio.series == 0) "" else ejercicio.series.toString(),
            onValueChange = { onChange(ejercicio.copy(series = it.toIntOrNull() ?: 0)) },
            label = { Text("Series") },
            modifier = Modifier.weight(1f)
        )
        OutlinedTextField(
            value = ejercicio.repeticiones,
            onValueChange = { onChange(ejercicio.copy(repeticiones = it)) },
            label = { Text("Reps") },
            modifier = Modifier.weight(1f)
        )
        IconButton(onClick = onEliminar) {
            Icon(Icons.Filled.Delete, contentDescription = "Eliminar ejercicio")
        }
    }
}
```

Añade el import que falta al principio del archivo (necesario por `itemsIndexed`):

```kotlin
import androidx.compose.foundation.lazy.itemsIndexed
```

- [ ] **Paso 6: Conectar las pantallas en `OSfitNavHost.kt`**

Reemplazar los `composable(Screen.Rutinas.route) { ... }` y `composable(Screen.RutinaEditor.route, ...) { ... }` placeholder por:

```kotlin
        composable(Screen.Rutinas.route) {
            com.osfit.app.ui.rutinas.RutinasListScreen(
                onCrearRutina = { navController.navigate(Screen.RutinaEditor.crearRuta()) },
                onEditarRutina = { rutinaId -> navController.navigate(Screen.RutinaEditor.crearRuta(rutinaId)) }
            )
        }
```

```kotlin
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
```

- [ ] **Paso 7: Compilar e instalar; verificación manual**

```
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. En la pestaña Rutinas: crear una plantilla nueva con 2 días y 2 ejercicios cada uno, guardar, confirmar que aparece en la lista con "2 día(s)", volver a entrar y editarla, y eliminarla con el ícono de basura.

- [ ] **Paso 8: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/rutinas app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt
git commit -m "feat: routine templates screen with create, edit and delete"
```

---

### Task 14: Pantalla Clientes — lista con indicador de pago

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/clientes/ClientesListViewModel.kt`
- Create: `app/src/main/java/com/osfit/app/ui/clientes/ClientesListScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`

**Interfaces:**
- Consumes: `AppContainer.clienteRepository` (Task 9), `Screen.Clientes`, `Screen.ClienteDetail` (Task 12).
- Produces: pantalla de lista, punto de entrada de navegación hacia el detalle (Task 15).

- [ ] **Paso 1: `ClientesListViewModel.kt`**

```kotlin
package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.ClienteRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ClientesListViewModel(
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository
) : ViewModel() {

    val clientes: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _errorValidacion = MutableStateFlow<String?>(null)
    val errorValidacion: StateFlow<String?> = _errorValidacion.asStateFlow()

    fun crearCliente(nombre: String, telefono: String) {
        if (nombre.isBlank()) {
            _errorValidacion.value = "El nombre es obligatorio"
            return
        }
        _errorValidacion.value = null
        viewModelScope.launch {
            clienteRepository.crearCliente(nombre.trim(), telefono.trim())
        }
    }

    fun limpiarError() {
        _errorValidacion.value = null
    }
}
```

- [ ] **Paso 2: `ClientesListScreen.kt`**

```kotlin
package com.osfit.app.ui.clientes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.Timestamp
import com.osfit.app.data.model.Cliente
import java.util.Date

@Composable
fun ClientesListScreen(
    onClienteClick: (String) -> Unit,
    viewModel: ClientesListViewModel = viewModel()
) {
    val clientes by viewModel.clientes.collectAsState()
    val errorValidacion by viewModel.errorValidacion.collectAsState()
    var mostrarDialogo by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { mostrarDialogo = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Nuevo cliente")
            }
        }
    ) { padding ->
        if (clientes.isEmpty()) {
            Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                Text("Aún no hay clientes. Toca + para agregar uno.")
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(clientes, key = { it.id }) { cliente ->
                    ClienteItem(cliente = cliente, onClick = { onClienteClick(cliente.id) })
                }
            }
        }
    }

    if (mostrarDialogo) {
        NuevoClienteDialog(
            errorValidacion = errorValidacion,
            onConfirmar = { nombre, telefono ->
                viewModel.crearCliente(nombre, telefono)
                if (nombre.isNotBlank()) mostrarDialogo = false
            },
            onCancelar = {
                viewModel.limpiarError()
                mostrarDialogo = false
            }
        )
    }
}

@Composable
private fun ClienteItem(cliente: Cliente, onClick: () -> Unit) {
    val (etiqueta, color) = estadoPago(cliente.fechaProximoPago)
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(cliente.nombre, style = MaterialTheme.typography.titleMedium)
            Text(etiqueta, color = color, style = MaterialTheme.typography.labelLarge)
        }
    }
}

private fun estadoPago(fechaProximoPago: Timestamp?): Pair<String, Color> {
    if (fechaProximoPago == null) return "Sin pago registrado" to Color(0xFF9E9E9E)
    return if (fechaProximoPago.toDate().before(Date())) {
        "Atrasado" to Color(0xFFD32F2F)
    } else {
        "Al día" to Color(0xFF2E7D32)
    }
}

@Composable
private fun NuevoClienteDialog(
    errorValidacion: String?,
    onConfirmar: (nombre: String, telefono: String) -> Unit,
    onCancelar: () -> Unit
) {
    var nombre by remember { mutableStateOf("") }
    var telefono by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Nuevo cliente") },
        text = {
            Column {
                OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre") }, modifier = Modifier.fillMaxWidth(), isError = errorValidacion != null)
                if (errorValidacion != null) {
                    Text(errorValidacion, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                OutlinedTextField(value = telefono, onValueChange = { telefono = it }, label = { Text("Teléfono (opcional)") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(nombre, telefono) }) { Text("Guardar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
```

- [ ] **Paso 3: Conectar en `OSfitNavHost.kt`**

Reemplazar el `composable(Screen.Clientes.route) { ... }` placeholder por:

```kotlin
        composable(Screen.Clientes.route) {
            com.osfit.app.ui.clientes.ClientesListScreen(
                onClienteClick = { clienteId -> navController.navigate(Screen.ClienteDetail.crearRuta(clienteId)) }
            )
        }
```

- [ ] **Paso 4: Compilar e instalar; verificación manual**

```
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. En la pestaña Clientes: crear un cliente sin nombre → debe mostrar el error y no cerrar el diálogo ni crear nada; crear un cliente válido → aparece en la lista con etiqueta "Sin pago registrado" en gris (no tiene `fechaProximoPago` todavía).

- [ ] **Paso 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/ClientesListViewModel.kt app/src/main/java/com/osfit/app/ui/clientes/ClientesListScreen.kt app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt
git commit -m "feat: clientes list screen with payment status indicator and create dialog"
```

---

### Task 15: Pantalla Detalle de Cliente — pagos y asignación de rutina

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`
- Create: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`

**Interfaces:**
- Consumes: `AppContainer.clienteRepository` (Task 9), `AppContainer.pagoRepository` (Task 10), `AppContainer.rutinaRepository` (Task 8), `Screen.ClienteDetail` (Task 12).

- [ ] **Paso 1: `ClienteDetailViewModel.kt`**

```kotlin
package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Pago
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RutinaRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ClienteDetailViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val pagoRepository: PagoRepository = AppContainer.pagoRepository,
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository
) : ViewModel() {

    val cliente: StateFlow<Cliente?> = clienteRepository.observarCliente(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val pagos: StateFlow<List<Pago>> = pagoRepository.observarPagos(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val plantillasDisponibles: StateFlow<List<Rutina>> = rutinaRepository.observarRutinas()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _errorPago = MutableStateFlow<String?>(null)
    val errorPago: StateFlow<String?> = _errorPago.asStateFlow()

    fun registrarPago(monto: Double, fecha: Timestamp, fechaProximoPago: Timestamp, nota: String) {
        if (monto <= 0.0) {
            _errorPago.value = "El monto debe ser mayor a 0"
            return
        }
        _errorPago.value = null
        viewModelScope.launch {
            pagoRepository.registrarPago(clienteId, monto, fecha, fechaProximoPago, nota)
        }
    }

    fun limpiarErrorPago() {
        _errorPago.value = null
    }

    fun asignarRutina(rutina: Rutina) {
        viewModelScope.launch {
            clienteRepository.asignarRutina(clienteId, rutina)
        }
    }
}
```

- [ ] **Paso 2: `ClienteDetailScreen.kt`**

```kotlin
package com.osfit.app.ui.clientes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.compose.viewModelFactory
import androidx.lifecycle.viewmodel.initializer
import com.google.firebase.Timestamp
import com.osfit.app.data.model.Pago
import com.osfit.app.data.model.Rutina
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@Composable
fun ClienteDetailScreen(clienteId: String) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val pagos by viewModel.pagos.collectAsState()
    val plantillas by viewModel.plantillasDisponibles.collectAsState()
    val errorPago by viewModel.errorPago.collectAsState()

    var mostrarDialogoPago by remember { mutableStateOf(false) }
    var mostrarDialogoRutina by remember { mutableStateOf(false) }

    val clienteActual = cliente ?: return

    Scaffold { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text(clienteActual.nombre, style = MaterialTheme.typography.headlineSmall)
                if (clienteActual.telefono.isNotBlank()) {
                    Text(clienteActual.telefono, style = MaterialTheme.typography.bodyMedium)
                }
            }
            item {
                val nombreDiaActual = clienteActual.rutinaAsignada?.dias?.getOrNull(clienteActual.diaActualIndex)?.nombreDia
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Rutina asignada", style = MaterialTheme.typography.titleSmall)
                        Text(clienteActual.rutinaAsignada?.nombre ?: "Sin rutina asignada")
                        if (nombreDiaActual != null) {
                            Text("Próximo día: $nombreDiaActual", style = MaterialTheme.typography.bodyMedium)
                        }
                        Button(onClick = { mostrarDialogoRutina = true }, modifier = Modifier.padding(top = 8.dp)) {
                            Text(if (clienteActual.rutinaAsignada == null) "Asignar rutina" else "Cambiar rutina")
                        }
                    }
                }
            }
            item {
                Button(onClick = { mostrarDialogoPago = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Registrar pago")
                }
            }
            item {
                Text("Historial de pagos", style = MaterialTheme.typography.titleSmall)
            }
            if (pagos.isEmpty()) {
                item { Text("Sin pagos registrados todavía.") }
            } else {
                items(pagos, key = { it.id }) { pago -> PagoItem(pago) }
            }
        }
    }

    if (mostrarDialogoPago) {
        RegistrarPagoDialog(
            errorValidacion = errorPago,
            onConfirmar = { monto, fecha, fechaProximoPago, nota ->
                viewModel.registrarPago(monto, fecha, fechaProximoPago, nota)
                if (monto > 0.0) mostrarDialogoPago = false
            },
            onCancelar = {
                viewModel.limpiarErrorPago()
                mostrarDialogoPago = false
            }
        )
    }

    if (mostrarDialogoRutina) {
        AsignarRutinaDialog(
            plantillas = plantillas,
            onSeleccionar = { rutina ->
                viewModel.asignarRutina(rutina)
                mostrarDialogoRutina = false
            },
            onCancelar = { mostrarDialogoRutina = false }
        )
    }
}

@Composable
private fun PagoItem(pago: Pago) {
    val formato = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("$${pago.monto}", style = MaterialTheme.typography.titleMedium)
            Text("Fecha: ${formato.format(pago.fecha.toDate())}", style = MaterialTheme.typography.bodySmall)
            Text("Próximo pago: ${formato.format(pago.fechaProximoPagoGenerada.toDate())}", style = MaterialTheme.typography.bodySmall)
            if (pago.nota.isNotBlank()) {
                Text(pago.nota, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun RegistrarPagoDialog(
    errorValidacion: String?,
    onConfirmar: (monto: Double, fecha: Timestamp, fechaProximoPago: Timestamp, nota: String) -> Unit,
    onCancelar: () -> Unit
) {
    var montoTexto by remember { mutableStateOf("") }
    var nota by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Registrar pago") },
        text = {
            Column {
                OutlinedTextField(
                    value = montoTexto,
                    onValueChange = { montoTexto = it },
                    label = { Text("Monto") },
                    isError = errorValidacion != null,
                    modifier = Modifier.fillMaxWidth()
                )
                if (errorValidacion != null) {
                    Text(errorValidacion, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                OutlinedTextField(
                    value = nota,
                    onValueChange = { nota = it },
                    label = { Text("Nota (opcional)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                )
                Text(
                    "Fecha de pago: hoy. Próximo pago sugerido: hoy + 30 días.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val monto = montoTexto.toDoubleOrNull() ?: -1.0
                val hoy = Timestamp.now()
                val calendario = Calendar.getInstance().apply {
                    time = hoy.toDate()
                    add(Calendar.DAY_OF_MONTH, 30)
                }
                val proximoPago = Timestamp(calendario.time)
                onConfirmar(monto, hoy, proximoPago, nota)
            }) { Text("Guardar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

@Composable
private fun AsignarRutinaDialog(
    plantillas: List<Rutina>,
    onSeleccionar: (Rutina) -> Unit,
    onCancelar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Elegir plantilla") },
        text = {
            if (plantillas.isEmpty()) {
                Text("No hay plantillas creadas todavía. Crea una en la pestaña Rutinas.")
            } else {
                Column {
                    plantillas.forEach { rutina ->
                        TextButton(onClick = { onSeleccionar(rutina) }, modifier = Modifier.fillMaxWidth()) {
                            Text(rutina.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
```

- [ ] **Paso 3: Conectar en `OSfitNavHost.kt`**

Reemplazar el `composable(route = Screen.ClienteDetail.route, ...) { ... }` placeholder por:

```kotlin
        composable(
            route = Screen.ClienteDetail.route,
            arguments = listOf(navArgument("clienteId") { type = NavType.StringType })
        ) { backStackEntry ->
            val clienteId = backStackEntry.arguments?.getString("clienteId") ?: return@composable
            com.osfit.app.ui.clientes.ClienteDetailScreen(clienteId = clienteId)
        }
```

- [ ] **Paso 4: Nota sobre el valor por defecto de "próximo pago" (decisión de diseño #1)**

El diálogo de "Registrar pago" siempre calcula `hoy + 30 días` como sugerencia y la usa directamente al guardar en este MVP (sin campo editable de fecha). Si en uso real 30 días no es el ciclo correcto para algún cliente, la fecha se puede corregir editando manualmente el documento en Firestore Console mientras no exista un selector de fecha en la UI — **esto es una limitación de v1 conocida**, no un bug: el spec no especifica un selector de fecha y añadir un `DatePickerDialog` completo es la primera extensión candidata post-v1 si hace falta.

- [ ] **Paso 5: Compilar e instalar; verificación manual**

```
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. En el detalle de un cliente: registrar un pago con monto vacío o negativo debe mostrar el error de validación y no guardar; registrar un pago válido debe aparecer en el historial y la etiqueta de estado en la lista de Clientes debe cambiar a "Al día"; asignar una plantilla de rutina debe mostrar el nombre y el primer día en "Próximo día".

- [ ] **Paso 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt
git commit -m "feat: cliente detail screen with payment history and routine assignment"
```

---

### Task 16: Pantalla Calendario — asistencia y avance de rutina

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/calendario/CalendarioViewModel.kt`
- Create: `app/src/main/java/com/osfit/app/ui/calendario/CalendarioScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`

**Interfaces:**
- Consumes: `AppContainer.clienteRepository` (Task 9), `AppContainer.asistenciaRepository` (Task 11), `Screen.Calendario` (Task 12).

- [ ] **Paso 1: `CalendarioViewModel.kt`**

```kotlin
package com.osfit.app.ui.calendario

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

class CalendarioViewModel(
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository
) : ViewModel() {

    private val _fechaSeleccionada = MutableStateFlow(LocalDate.now())
    val fechaSeleccionada: StateFlow<LocalDate> = _fechaSeleccionada.asStateFlow()

    val clientesActivos: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .map { lista -> lista.filter { it.activo } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val asistenciasDelDia: StateFlow<List<Asistencia>> = _fechaSeleccionada
        .flatMapLatest { fecha -> asistenciaRepository.observarAsistenciasPorFecha(fecha.toString()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun seleccionarFecha(fecha: LocalDate) {
        _fechaSeleccionada.value = fecha
    }

    fun marcarAsistio(cliente: Cliente, diaRealizado: Int) {
        val totalDias = cliente.rutinaAsignada?.dias?.size ?: return
        viewModelScope.launch {
            asistenciaRepository.registrarAsistencia(
                clienteId = cliente.id,
                fecha = _fechaSeleccionada.value.toString(),
                asistio = true,
                diaActualIndexPrevio = cliente.diaActualIndex,
                diaRutinaRealizado = diaRealizado,
                totalDiasRutina = totalDias
            )
        }
    }

    fun marcarFalto(cliente: Cliente) {
        viewModelScope.launch {
            asistenciaRepository.registrarAsistencia(
                clienteId = cliente.id,
                fecha = _fechaSeleccionada.value.toString(),
                asistio = false,
                diaActualIndexPrevio = cliente.diaActualIndex,
                diaRutinaRealizado = null,
                totalDiasRutina = cliente.rutinaAsignada?.dias?.size ?: 1
            )
        }
    }
}
```

- [ ] **Paso 2: `CalendarioScreen.kt`**

```kotlin
package com.osfit.app.ui.calendario

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun CalendarioScreen(viewModel: CalendarioViewModel = viewModel()) {
    val fechaSeleccionada by viewModel.fechaSeleccionada.collectAsState()
    val clientes by viewModel.clientesActivos.collectAsState()
    val asistencias by viewModel.asistenciasDelDia.collectAsState()
    var mesVisible by remember { mutableStateOf(YearMonth.from(fechaSeleccionada)) }

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            CalendarHeader(
                mesVisible = mesVisible,
                onMesAnterior = { mesVisible = mesVisible.minusMonths(1) },
                onMesSiguiente = { mesVisible = mesVisible.plusMonths(1) }
            )
            CalendarGrid(
                mesVisible = mesVisible,
                fechaSeleccionada = fechaSeleccionada,
                onDiaClick = { viewModel.seleccionarFecha(it) }
            )
            Text(
                "Clientes activos — $fechaSeleccionada",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(16.dp)
            )
            LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(clientes, key = { it.id }) { cliente ->
                    val asistenciaExistente = asistencias.find { it.clienteId == cliente.id }
                    ClienteAsistenciaRow(
                        cliente = cliente,
                        asistenciaExistente = asistenciaExistente,
                        onFalto = { viewModel.marcarFalto(cliente) },
                        onAsistio = { diaRealizado -> viewModel.marcarAsistio(cliente, diaRealizado) }
                    )
                }
            }
        }
    }
}

@Composable
private fun CalendarHeader(mesVisible: YearMonth, onMesAnterior: () -> Unit, onMesSiguiente: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onMesAnterior) { Icon(Icons.Filled.ChevronLeft, contentDescription = "Mes anterior") }
        Text(
            "${mesVisible.month.getDisplayName(TextStyle.FULL, Locale("es"))} ${mesVisible.year}",
            style = MaterialTheme.typography.titleMedium
        )
        IconButton(onClick = onMesSiguiente) { Icon(Icons.Filled.ChevronRight, contentDescription = "Mes siguiente") }
    }
}

@Composable
private fun CalendarGrid(mesVisible: YearMonth, fechaSeleccionada: LocalDate, onDiaClick: (LocalDate) -> Unit) {
    val primerDiaDelMes = mesVisible.atDay(1)
    val diasEnMes = mesVisible.lengthOfMonth()
    val offsetInicial = primerDiaDelMes.dayOfWeek.value % 7 // Domingo = 0

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("D", "L", "M", "M", "J", "V", "S").forEach { letra ->
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(letra, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        val totalCeldas = offsetInicial + diasEnMes
        val filas = (totalCeldas + 6) / 7
        for (fila in 0 until filas) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (columna in 0 until 7) {
                    val indiceDia = fila * 7 + columna - offsetInicial + 1
                    Box(
                        modifier = Modifier.weight(1f).aspectRatio(1f).padding(2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (indiceDia in 1..diasEnMes) {
                            val fecha = mesVisible.atDay(indiceDia)
                            val seleccionado = fecha == fechaSeleccionada
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                                    .background(if (seleccionado) MaterialTheme.colorScheme.primary else Color.Transparent)
                                    .clickable { onDiaClick(fecha) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    indiceDia.toString(),
                                    color = if (seleccionado) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ClienteAsistenciaRow(
    cliente: Cliente,
    asistenciaExistente: Asistencia?,
    onFalto: () -> Unit,
    onAsistio: (diaRealizado: Int) -> Unit
) {
    var mostrarSelectorDia by remember { mutableStateOf(false) }
    val tieneRutina = cliente.rutinaAsignada != null

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(cliente.nombre, style = MaterialTheme.typography.titleSmall)
                val estado = when (asistenciaExistente?.asistio) {
                    true -> "Asistió"
                    false -> "Faltó"
                    null -> if (tieneRutina) "Sin marcar" else "Sin rutina asignada"
                }
                Text(estado, style = MaterialTheme.typography.bodySmall)
            }
            OutlinedButton(onClick = onFalto) { Text("Faltó") }
            Button(onClick = { mostrarSelectorDia = true }, enabled = tieneRutina) { Text("Asistió") }
        }
    }

    if (mostrarSelectorDia && cliente.rutinaAsignada != null) {
        SeleccionarDiaDialog(
            dias = cliente.rutinaAsignada.dias.map { it.nombreDia },
            diaSugerido = cliente.diaActualIndex,
            onConfirmar = { diaElegido ->
                onAsistio(diaElegido)
                mostrarSelectorDia = false
            },
            onCancelar = { mostrarSelectorDia = false }
        )
    }
}

@Composable
private fun SeleccionarDiaDialog(
    dias: List<String>,
    diaSugerido: Int,
    onConfirmar: (Int) -> Unit,
    onCancelar: () -> Unit
) {
    var seleccionado by remember { mutableStateOf(diaSugerido.coerceIn(0, dias.lastIndex)) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("¿Qué día hizo?") },
        text = {
            Column {
                dias.forEachIndexed { indice, nombreDia ->
                    Row(
                        modifier = Modifier.fillMaxWidth().clickable { seleccionado = indice }.padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        androidx.compose.material3.RadioButton(selected = seleccionado == indice, onClick = { seleccionado = indice })
                        Text(nombreDia + if (indice == diaSugerido) " (sugerido)" else "")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionado) }) { Text("Confirmar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
```

Añade el import que falta para `Modifier.clip`:

```kotlin
import androidx.compose.ui.draw.clip
```

- [ ] **Paso 3: Conectar en `OSfitNavHost.kt`**

Reemplazar el `composable(Screen.Calendario.route) { ... }` placeholder por:

```kotlin
        composable(Screen.Calendario.route) {
            com.osfit.app.ui.calendario.CalendarioScreen()
        }
```

- [ ] **Paso 4: Compilar e instalar; verificación manual del flujo completo de avance de rutina**

```
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. Con un cliente que tiene una rutina de al menos 3 días asignada:
1. Marcar "Asistió" hoy → debe sugerir el Día 1 (índice 0) por defecto, confirmar → el detalle del cliente debe mostrar ahora "Próximo día: Día 2".
2. Ir a una fecha futura y marcar "Faltó" → el detalle del cliente debe seguir mostrando "Próximo día: Día 2" (no cambia).
3. Marcar "Asistió" otro día pero **anular manualmente** eligiendo el Día 3 (distinto del sugerido Día 2) → el detalle debe pasar a mostrar "Próximo día: Día 1" si la rutina tiene 3 días (vuelta al ciclo) o "Día 4" si tiene más de 3.
4. Deshabilitar el botón "Asistió" para un cliente sin `rutinaAsignada` — confirmar que está gris/inactivo y "Faltó" sigue disponible.

- [ ] **Paso 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/calendario app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt
git commit -m "feat: calendario screen with attendance marking and routine-day advancement"
```

---

### Task 17: README, verificación final en dos dispositivos y cierre

**Files:**
- Create: `README.md`

**Interfaces:** ninguna — tarea de cierre.

- [ ] **Paso 1: Escribir `README.md`**

```markdown
# OSfit

App Android nativa (Kotlin + Jetpack Compose) de uso personal para gestionar
clientes de gimnasio: lista de clientes con estado de pago, calendario de
asistencias con avance automático de rutina, plantillas de rutina
reutilizables y control de pagos.

Ver el spec de diseño completo en
[docs/superpowers/specs/2026-08-18-osfit-gym-manager-design.md](docs/superpowers/specs/2026-08-18-osfit-gym-manager-design.md)
y el plan de implementación en
[docs/superpowers/plans/2026-08-18-osfit-implementation.md](docs/superpowers/plans/2026-08-18-osfit-implementation.md).

## Configuración local (una sola vez por máquina)

1. Copiar `local.properties.example` a `local.properties` y completar:
   - `sdk.dir`: ruta al Android SDK local.
   - `osfit.auth.email` / `osfit.auth.password`: credenciales del usuario
     fijo creado en Firebase Authentication (ver spec, Task 0 del plan).
2. Descargar `google-services.json` desde Firebase Console (proyecto
   `OSfit`, app Android `com.osfit.app`) y colocarlo en `app/google-services.json`.
   Ninguno de estos dos archivos se versiona (están en `.gitignore`).

## Compilar e instalar

```
./gradlew assembleDebug
./gradlew installDebug
```

## Pruebas unitarias

```
./gradlew test
```

Cubren `RutinaProgressCalculator`, la función que calcula el siguiente día
del ciclo de rutina tras marcar asistencia/falta.

## Instalar en el segundo dispositivo (co-gestor)

Repetir "Configuración local" en la máquina/Android Studio desde la que se
compile para el segundo dispositivo, usando el **mismo** `local.properties`
(mismas credenciales). Ambos dispositivos comparten el mismo Firestore y
sincronizan en tiempo real.
```

- [ ] **Paso 2: Checklist de verificación manual final (dos dispositivos)**

Ejecutar en ambos dispositivos, con la misma cuenta de Firebase configurada:

1. Ambos arrancan sin pantalla de login y llegan directo a "Clientes".
2. Crear un cliente en el dispositivo A → aparece en el dispositivo B en unos segundos (sincronización en tiempo real de Firestore).
3. Crear una plantilla de rutina en un dispositivo, asignarla a un cliente desde el otro.
4. Marcar asistencia de un cliente en un dispositivo → el "próximo día" se actualiza también en el otro.
5. Apagar el WiFi/datos en un dispositivo, crear un cliente offline, reactivar conexión → el cliente aparece en Firestore y en el otro dispositivo (verifica la caché local de Firestore).
6. Registrar un pago con monto negativo → rechazado con mensaje de validación en ambos flujos (Clientes → crear sin nombre, Detalle → pago inválido).

- [ ] **Paso 3: Commit final**

```bash
git add README.md
git commit -m "docs: add setup and verification instructions"
```

---

## Self-Review (completado al escribir este plan)

**Cobertura del spec:** cada sección del spec tiene tarea(s) que la implementan — modelo de datos (Task 6), lógica de avance de rutina (Tasks 5, 11, 16), 3 pantallas + navegación (Tasks 12–16), manejo de errores de auth (Tasks 7, 12), validaciones básicas (Tasks 14, 15), pruebas unitarias (Task 5), autenticación silenciosa (Tasks 3, 7), reglas de seguridad Firestore (Task 4), multi-dispositivo (Task 17 checklist).

**Placeholders:** ninguno queda — cada paso de código tiene el archivo completo o el diff exacto a aplicar; las dos únicas tareas sin código (Task 0, Task 1) son manuales por naturaleza (consola de Firebase / wizard de Android Studio) y están descritas paso a paso sin ambigüedad.

**Consistencia de tipos:** `RutinaProgressCalculator.calcularSiguienteDiaActualIndex` (Task 5) se firma igual en `AsistenciaRepository.registrarAsistencia` (Task 11) y en `CalendarioViewModel` (Task 16); `Cliente`, `Rutina`, `Pago`, `Asistencia` (Task 6) se usan con los mismos nombres de campo en los cuatro repositorios (Tasks 8–11) y en las cinco pantallas (Tasks 13–16); `AppContainer` (Task 8) se referencia de forma idéntica en los cuatro `ViewModel`s.
