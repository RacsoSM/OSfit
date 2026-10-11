# Traspaso: generar y publicar los videos HD (camino 1)

Para la sesión de Claude que ejecute el **punto 10 de `docs/backlog-2.md`**. Este documento
dice **qué hacer, en qué orden, dónde y cómo**; el detalle técnico y el porqué están en
`docs/videos-ejercicios/camino1.md`. **Lee los dos completos antes de empezar.**

## 0. Contexto en 6 líneas

- OSfit: app Android del entrenador (`app/`), web de las clientas (`web/`), Cloud Functions
  (`functions/`), un solo Firebase `osfit-cccfe`. El entrenador habla español; respóndele en
  español. Commits en inglés. Regla del repo: contexto vía graphify primero (`CLAUDE.md`).
- El banco de ejercicios (`ejercicios/{id}` en Firestore) tiene un GIF de 180 px por
  ejercicio, que se ve pixelado en grande.
- El "camino 1" saca las 2 poses de cada GIF, las escala ×4 con Real-ESRGAN y arma un MP4 de
  720 px en bucle (fundido entre las dos poses). Decidido por el entrenador el 2026-10-10.
- **La web y la app ya reproducen el video** de cualquier ejercicio con `videoRuta`. No hay
  que tocar código: solo generar, revisar y subir archivos.
- Hoy el banco tiene **108 ejercicios; 102 son de 2 poses** (los que entran). Los otros 6
  (zancadas caminando, giros rusos, plancha, escaladores, burpees, caminata del granjero) se
  saltan solos y **no se usan**: decisión del entrenador.
- Ya hecho en el piloto: **press de banca** subido a producción (`ejercicios/press-banca.mp4`).

## 1. Lo que hay en el entorno (sesión en la nube de Claude Code)

Verificado el 2026-10-10/11 en una sesión anterior; confírmalo, no lo supongas:

- **Credenciales de Firebase:** el entorno trae una cuenta de servicio de `osfit-cccfe` en
  `GOOGLE_APPLICATION_CREDENTIALS` (también `FIREBASE_SERVICE_ACCOUNT_B64`). Compruébalo sin
  imprimir la llave:
  `python3 -c "import json,os;d=json.load(open(os.environ['GOOGLE_APPLICATION_CREDENTIALS']));print(d['project_id'],d['client_email'])"`
  → debe decir `osfit-cccfe`. `gcloud` NO tiene cuenta; no hace falta.
- **Escribir en producción:** el filtro de permisos de la sesión puede bloquear el primer
  comando que sube a Firebase aunque el entrenador ya lo haya pedido. No lo esquives: dile qué
  ibas a subir y que lo autorice; con su "sí" explícito en la conversación suele pasar.
- `ffmpeg` está instalado. No hay tarjeta gráfica: todo corre en CPU (4 núcleos ≈ 13 s por
  ejercicio, ~25 min los 102).
- `docs/videos-ejercicios/venv`, `modelos/`, `salida/`, `trabajo/` están en `.gitignore`. En
  una sesión nueva **no existen**: hay que crearlos (paso 2).

## 2. Instalar (una vez por sesión)

```bash
cd docs/videos-ejercicios
python3 -m venv venv
venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
venv/bin/pip install spandrel pillow numpy
venv/bin/python -c "import torch, torchvision, spandrel; print(torch.__version__, torchvision.__version__)"
```

**Trampa conocida:** si `torchvision` viene de PyPI y no del índice de PyTorch, al importar
falla con `operator torchvision::nms does not exist`. Arreglo:
`venv/bin/pip install --force-reinstall --no-deps --index-url https://download.pytorch.org/whl/cpu torchvision`.

El modelo `RealESRGAN_x4plus.pth` (64 MB) lo baja `camino1.py` la primera vez.

## 3. Generar

```bash
cd docs/videos-ejercicios
venv/bin/python camino1.py --todos        # en segundo plano: ~25 min
```

- Deja `salida/<id>.mp4` y `salida/<id>-poses.png` por ejercicio.
- Debe terminar con "102 videos … saltados: zancadas-caminando, giros-rusos, plancha,
  escaladores, burpees, caminata-granjero". Si salta otro, revísalo antes de seguir.
- Para rehacer solo algunos: `venv/bin/python camino1.py <id> <id> …`.

## 4. Revisar (tú primero, luego el entrenador)

```bash
venv/bin/python hoja_revision.py          # salida/_revision-1.png … _revision-6.png
```

1. **Revísalas tú** con la lista de `camino1.md` §6.2: ejercicio correcto, sin deformaciones
   (manos, dedos, barra, pesas, cables, cara), fondo blanco limpio, músculo en rojo igual que
   el GIF. Anota los dudosos.
2. **Mándale las hojas al entrenador** (herramienta para enviar archivos) con tu lista de
   dudosos, y **espera su OK** antes de subir. Si rechaza alguno, ese no se sube (se queda con
   su GIF).
3. Comprueba el formato de unos cuantos:
   `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of default=nw=1 salida/<id>.mp4`
   → `h264`, `720`×`720`, `30/1`, `3.2`.

## 5. Subir (producción)

Solo con el OK del entrenador. Desde `functions/` (instala dependencias si hace falta:
`npm install`):

```bash
cd functions
for f in ../docs/videos-ejercicios/salida/*.mp4; do
  id="$(basename "$f" .mp4)"
  # Los que el entrenador rechazó: agrégalos aquí para saltarlos.
  case "$id" in ID_RECHAZADO_1|ID_RECHAZADO_2) continue ;; esac
  node scripts/subirVideoEjercicio.mjs "$id" "$f"
done
```

Cada uno imprime `✓ <id>: video subido (… kB) → ejercicios/<id>.mp4`. Qué escribe:

| Dónde | Qué |
|---|---|
| Storage `ejercicios/<id>.mp4` | el video (`video/mp4`, caché de 1 día) |
| Firestore `ejercicios/{id}.videoRuta` | `"ejercicios/<id>.mp4"` |

**No se toca nada más**: el GIF (`gifRuta`) se queda (grid, filas comprimidas y póster),
igual que nombres, alias, grupos y las listas de "Ejercicios por grupo". No se despliega la
web ni se recompila la app. Deshacer uno: `node scripts/subirVideoEjercicio.mjs <id> --quitar`.

## 6. Verificar

1. Todos responden en público (cuenta los `200`):
   ```bash
   for f in ../docs/videos-ejercicios/salida/*.mp4; do id="$(basename "$f" .mp4)"; \
     curl -s -o /dev/null -w "%{http_code} $id\n" "https://firebasestorage.googleapis.com/v0/b/osfit-cccfe.firebasestorage.app/o/ejercicios%2F$id.mp4?alt=media"; done | sort | uniq -c | head
   ```
2. Firestore: cuántos ejercicios tienen `videoRuta` (con firebase-admin, en `functions/`):
   ```bash
   node -e 'const{initializeApp,applicationDefault}=require("firebase-admin/app");const{getFirestore}=require("firebase-admin/firestore");initializeApp({credential:applicationDefault(),projectId:"osfit-cccfe"});getFirestore().collection("ejercicios").get().then(s=>console.log(s.docs.filter(d=>d.get("videoRuta")).length,"con video de",s.size))'
   ```
3. Pídele al entrenador que lo vea en su teléfono: **web** (Registro → Iniciar entrenamiento →
   agregar un ejercicio → la tarjeta grande muestra el video, 260 px) y **app** (Ejercicios por
   grupo → tocar un ejercicio). El navegador de pruebas del entorno (Playwright/Chromium) **no
   reproduce H.264**: no intentes verificar la reproducción ahí, solo que la página arme el
   `<video>`.

## 7. Cerrar

1. `docs/backlog-2.md`, punto 10: márcalo `✅ HECHO (fecha)` con cuántos se subieron, cuáles
   se rechazaron y que falta la verificación en el teléfono si no la hizo.
2. `docs/videos-ejercicios/camino1.md` §10 "Estado": actualízalo igual.
3. Commit (en inglés, con prefijo `docs:`) y push a la rama que indique la sesión. Merge a
   `main` **solo si el entrenador lo pide**. Los videos NO se versionan (están en
   `.gitignore`); solo cambian los dos documentos.
4. Si `graphify-out/` cambió solo, súbelo en un commit aparte (`graphify: update the graph`).

## 8. Qué NO hacer

- No cambiar código de la web, la app ni las funciones: el soporte de video ya está
  desplegado (`web/src/ui/registro.ts` → `medioGrande`, `app/.../ui/common/VideoEjercicio.kt`).
- No volver a correr `cargarBancoEjercicios.mjs` "por si acaso": no hace falta para los
  videos (aunque no los borra).
- No subir videos sin el OK del entrenador ni los de los 6 ejercicios que se saltan.
- No versionar los `.mp4`/`.png` generados (derivados de Gym visual: solo viven en Storage).
- No cambiar el tamaño en pantalla (260 px) ni los parámetros del video sin que él lo pida.

## 9. Mapa de archivos

| Archivo | Para qué |
|---|---|
| `docs/videos-ejercicios/camino1.md` | El proceso completo y el porqué |
| `docs/videos-ejercicios/camino1.py` | Genera los videos |
| `docs/videos-ejercicios/hoja_revision.py` | Junta las hojas de poses para revisar |
| `functions/scripts/subirVideoEjercicio.mjs` | Sube un video y escribe `videoRuta` |
| `functions/semilla/ejercicios.json` | Los ejercicios del banco y su GIF de origen (`gifOrigen`) |
| `web/src/ui/registro.ts`, `web/src/estilos.css` | Cómo se muestra en la web (ya hecho) |
| `app/src/main/java/com/osfit/app/ui/common/VideoEjercicio.kt` | Cómo se muestra en la app (ya hecho) |
| `docs/backlog-2.md` (punto 10) | La tarea |
