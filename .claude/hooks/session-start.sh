#!/bin/bash
# SessionStart hook (solo sesiones cloud de Claude Code): deja el entorno listo
# para compilar la app Android, la web y las functions, y para hacer deploy.
#
# Secretos opcionales (variables de entorno del entorno cloud):
#   OSFIT_AUTH_EMAIL / OSFIT_AUTH_PASSWORD  -> local.properties (login silencioso)
#   GOOGLE_SERVICES_JSON_B64                -> app/google-services.json (base64)
#   FIREBASE_SERVICE_ACCOUNT_B64            -> credenciales para `firebase deploy` (base64)
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Sin locale UTF-8 la JVM no puede escribir los .class de los tests con "ñ" en el nombre.
export LANG=C.UTF-8 LC_ALL=C.UTF-8

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export ANDROID_HOME=\"$sdk\""
    echo "export LANG=C.UTF-8 LC_ALL=C.UTF-8"
  } >> "$CLAUDE_ENV_FILE"
fi

# local.properties: se regenera siempre para tomar los secretos actuales.
cat > local.properties <<PROPS
sdk.dir=$sdk
osfit.auth.email=${OSFIT_AUTH_EMAIL:-}
osfit.auth.password=${OSFIT_AUTH_PASSWORD:-}
PROPS

# google-services.json: el real si viene en el secreto; si no, uno de relleno
# que permite compilar pero no conecta con Firebase.
if [ -n "${GOOGLE_SERVICES_JSON_B64:-}" ]; then
  echo "$GOOGLE_SERVICES_JSON_B64" | base64 -d > app/google-services.json
elif [ ! -f app/google-services.json ]; then
  cat > app/google-services.json <<'JSON'
{
  "project_info": {"project_number": "000000000000", "project_id": "osfit-placeholder", "storage_bucket": "osfit-placeholder.appspot.com"},
  "client": [{
    "client_info": {"mobilesdk_app_id": "1:000000000000:android:0000000000000000", "android_client_info": {"package_name": "com.osfit.app"}},
    "oauth_client": [],
    "api_key": [{"current_key": "AIzaPlaceholderPlaceholderPlaceholder00"}],
    "services": {"appinvite_service": {"other_platform_oauth_client": []}}
  }],
  "configuration_version": "1"
}
JSON
  echo "AVISO: app/google-services.json es de relleno (falta GOOGLE_SERVICES_JSON_B64); el APK compila pero no conecta con Firebase." >&2
fi

# Credenciales de deploy: firebase-tools las toma de GOOGLE_APPLICATION_CREDENTIALS.
if [ -n "${FIREBASE_SERVICE_ACCOUNT_B64:-}" ]; then
  creds="$HOME/.config/osfit/firebase-sa.json"
  mkdir -p "$(dirname "$creds")"
  echo "$FIREBASE_SERVICE_ACCOUNT_B64" | base64 -d > "$creds"
  chmod 600 "$creds"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export GOOGLE_APPLICATION_CREDENTIALS=\"$creds\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

# Dependencias de la web y de las functions (ci: no reescribe los lockfiles).
npm ci --prefix web --no-audit --no-fund
npm ci --prefix functions --no-audit --no-fund

# Descarga Gradle y los plugins para que el primer build no arranque en frío.
chmod +x gradlew
./gradlew help --no-daemon --quiet >/dev/null
