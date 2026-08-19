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
     fijo creado en Firebase Authentication (proyecto `osfit-cccfe`,
     sección Authentication → Users).
2. Descargar `google-services.json` desde Firebase Console (proyecto
   `OSfit`, app Android `com.osfit.app`) y colocarlo en
   `app/google-services.json`. Ninguno de estos dos archivos se
   versiona (están en `.gitignore`).

## Compilar e instalar

```
./gradlew assembleDebug
./gradlew installDebug
```

Con el teléfono conectado por USB y depuración USB activada
(`adb devices` debe listarlo como `device`, no `unauthorized`).

## Pruebas unitarias

```
./gradlew test
```

Cubren `RutinaProgressCalculator`, la función que calcula el siguiente día
del ciclo de rutina tras marcar asistencia/falta (9 casos, incluyendo la
vuelta al Día 1 y las anulaciones manuales del día sugerido).

## Instalar en el segundo dispositivo (co-gestor)

Repetir "Configuración local" en la máquina desde la que se compile para
el segundo dispositivo, usando el **mismo** `local.properties` (mismas
credenciales de `osfit.auth.email`/`osfit.auth.password`) y el mismo
`google-services.json`. Ambos dispositivos comparten el mismo proyecto
Firestore y sincronizan en tiempo real: un cambio hecho en un teléfono
aparece en el otro en cuanto haya conexión a internet.

## Estructura del proyecto

- `app/src/main/java/com/osfit/app/domain/` — lógica de negocio pura
  (avance de rutina), sin dependencias de Android.
- `app/src/main/java/com/osfit/app/data/model/` — modelos de datos que
  reflejan los documentos de Firestore.
- `app/src/main/java/com/osfit/app/data/repository/` — acceso a
  Firestore (CRUD + listeners en tiempo real vía `Flow`).
- `app/src/main/java/com/osfit/app/auth/` — autenticación silenciosa con
  Firebase Auth.
- `app/src/main/java/com/osfit/app/ui/` — pantallas Compose + ViewModels,
  una carpeta por sección (`clientes/`, `calendario/`, `rutinas/`).
