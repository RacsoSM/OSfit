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

178 casos en 15 clases, sobre la lógica pura de `domain/` (avance del día del
ciclo, rachas, períodos quincenales, medallas, tiempo en el gimnasio y armado
del resumen) y la de `video/` (timeline, escenas, paletas y geometría de los
blobs).

Los repositorios de Firestore, las pantallas Compose y el render sobre Canvas
no se testean unitariamente: se verifican en dispositivo.

## Instalar en el segundo dispositivo (co-gestor)

Repetir "Configuración local" en la máquina desde la que se compile para
el segundo dispositivo, usando el **mismo** `local.properties` (mismas
credenciales de `osfit.auth.email`/`osfit.auth.password`) y el mismo
`google-services.json`. Ambos dispositivos comparten el mismo proyecto
Firestore y sincronizan en tiempo real: un cambio hecho en un teléfono
aparece en el otro en cuanto haya conexión a internet.

## Web para clientes

Cada cliente tiene una página de solo lectura en `https://osfit-cccfe.web.app`, a la que
entra por un link personal que se comparte desde su ficha ("Compartir acceso web").
Muestra el día que le toca, su racha, su promedio por sesión y su calendario.

- `web/` — sitio estático (Vite + TypeScript). `npm run dev` para desarrollo,
  `npm run build` para compilar.
- `functions/` — Cloud Functions. `sesion` canjea el token del link por una sesión de
  Firebase acotada a ese cliente.

Desplegar: `firebase deploy --only hosting,functions,firestore:rules`

El día de rutina **no** se recalcula en la web: la app lo denormaliza en
`Cliente.ultimoDia` / `ultimoDiaFecha` / `ultimoDiaEsAncla` (ver
`RutinaProgressCalculator.denormalizar`), y la web solo lo interpreta en `web/src/dia.ts`.

Diseño completo en
[docs/superpowers/specs/2026-09-10-web-clientes-design.md](docs/superpowers/specs/2026-09-10-web-clientes-design.md).

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
