import java.util.Properties
import java.io.FileInputStream
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        load(FileInputStream(localPropertiesFile))
    }
}

/**
 * La versión de cada APK (backlog 2, punto 12): todos decían 1 / "1.0" y no había forma de saber
 * qué versión tenía cada teléfono.
 *
 * - `versionName` = fecha y hora de la compilación en Mazatlán, `AAMMDD.HHMM`, como la versión
 *   de la web (`web/vite.config.ts`), más el commit corto: `261017.2125-79d36a3`. Con un `+` al
 *   final si se compiló con cambios sin commit: entonces el commit no describe todo el código.
 * - `versionCode` = minutos desde 2024 al compilar. No sale de la cuenta de commits a
 *   propósito: los clones de las sesiones son parciales y esa cuenta cambia según la copia, y
 *   un `versionCode` que baja hace que Android rechace el APK como "versión anterior".
 */
val momentoDelBuild: ZonedDateTime =
    ZonedDateTime.now(ZoneId.of("America/Mazatlan"))
val versionCodeDelBuild: Int = Duration.between(
    Instant.parse("2024-01-01T00:00:00Z"), momentoDelBuild.toInstant()
).toMinutes().toInt()
val commitDelBuild: String = runCatching {
    providers.exec { commandLine("git", "rev-parse", "--short", "HEAD") }
        .standardOutput.asText.get().trim()
}.getOrNull()?.takeIf { it.isNotEmpty() } ?: "sin-git"
val conCambiosSinCommit: Boolean = runCatching {
    providers.exec { commandLine("git", "status", "--porcelain", "--untracked-files=no") }
        .standardOutput.asText.get().isNotBlank()
}.getOrDefault(false)
val versionNameDelBuild: String =
    momentoDelBuild.format(DateTimeFormatter.ofPattern("yyMMdd.HHmm")) + "-" + commitDelBuild +
        (if (conCambiosSinCommit) "+" else "")

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.osfit.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.osfit.app"
        minSdk = 26
        targetSdk = 36
        versionCode = versionCodeDelBuild
        versionName = versionNameDelBuild
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

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
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.3")
    implementation("androidx.core:core-ktx:1.13.1")
    // No se usa directamente: sube la que llega arrastrada, que era la 1.1.0. Las APIs de
    // ActivityResult —las que piden el permiso de notificaciones— exigen fragment 1.3.0 o
    // mayor, porque las anteriores no llamaban a super.onRequestPermissionsResult(). Sin esto
    // `lintVitalRelease` tumba la build de release.
    implementation("androidx.fragment:fragment:1.8.5")

    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("com.google.firebase:firebase-storage-ktx")
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // Para ver el GIF de cada ejercicio del banco (WebP animado) en "Ejercicios por grupo".
    // coil-gif trae el decodificador animado; sin él Coil muestra solo el primer cuadro.
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("io.coil-kt:coil-gif:2.7.0")

    testImplementation("junit:junit:4.13.2")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
