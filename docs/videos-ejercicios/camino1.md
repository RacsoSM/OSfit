# Videos HD de los ejercicios — "camino 1"

Guía completa para generar, revisar y publicar los videos en alta definición de los ejercicios
del banco. Decidido por el entrenador el 2026-10-10, después de un piloto con 3 ejercicios.
La tarea está en `docs/backlog-2.md` (punto 10).

## 1. Por qué

Las animaciones del banco salen de [`hasaneyldrm/exercises-dataset`](https://github.com/hasaneyldrm/exercises-dataset)
(© Gym visual) y miden **180 × 180 px**: es la resolución con la que Gym visual permitió
redistribuirlas. En la tarjeta grande de Registro se ven pixeladas porque el teléfono las estira
3 o 4 veces.

Se compararon cuatro caminos (ver la conversación del 2026-10-10 y el punto 10 del backlog):
mejorar las animaciones actuales (**camino 1**), redibujarlas y animarlas con Gemini/ChatGPT
(camino 2), video generado con IA desde cero (camino 3) y comprar ExerciseDB V2. Se eligió el
camino 1: es casi gratis, automático, y conserva el estilo que ya conocen las clientas.

## 2. Qué hay dentro de cada GIF (el hallazgo del piloto)

Los GIFs **no tienen movimiento real**. Traen 12 cuadros:

| Cuadro | Duración | Qué es |
|---|---|---|
| 0 | 1000 ms | **Pose A** (inicio del movimiento) |
| 1–5 | 100 ms c/u | Fundido de A hacia B (mezcla de las dos imágenes: se ven "fantasmas") |
| 6 | 1000 ms | **Pose B** (final del movimiento) |
| 7–11 | 100 ms c/u | Fundido de B hacia A |

O sea: solo hay **2 imágenes reales**. Ningún interpolador puede sacar movimiento real de un
fundido, así que el camino 1 no intenta inventarlo: rehace **el mismo fundido, pero nítido**.

De los 97 ejercicios del banco, **91 siguen este patrón**. Los otros 6 (zancadas caminando,
giros rusos, plancha, escaladores, burpees, caminata del granjero) tienen más poses o un patrón
distinto; el script los **salta** y se quedan con su GIF. Decisión del entrenador: no se usan.

## 3. Qué hace el camino 1

Por cada ejercicio, `docs/videos-ejercicios/camino1.py`:

1. **Baja su GIF** del dataset, del mismo commit fijado que usa la carga del banco
   (`7455efae…`, ver `DATASET` en `functions/scripts/bancoEjercicios.mjs`). El ejercicio y su
   GIF salen de `functions/semilla/ejercicios.json` (`gifOrigen`).
2. **Toma las 2 poses**: los cuadros de 1000 ms. Si no son exactamente 2 en 12 cuadros, lo salta.
3. **Las escala ×4 con IA**: [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN), modelo
   `RealESRGAN_x4plus` (180 → 720 px). Se probó también `RealESRGAN_x4plus_anime_6B`: exagera
   los contornos y se ve caricatura; `x4plus` respeta el estilo 3D.
4. **Arma el video** con `ffmpeg`: pose A quieta 1 s → fundido 0.6 s → pose B quieta 1 s →
   fundido 0.6 s de regreso. Total **3.2 s**, y el último cuadro empata con el primero, así que
   el bucle no salta.
5. Deja en `docs/videos-ejercicios/salida/`:
   - `<id>.mp4`: el video a subir.
   - `<id>-poses.png`: las 2 poses lado a lado, para revisar a ojo.

Se hacen solo 2 imágenes por ejercicio con IA (no los 12 cuadros), porque los demás eran
mezclas: escalar mezclas da peores bordes que mezclar imágenes ya escaladas.

### Especificación del video que se entrega

| Propiedad | Valor |
|---|---|
| Formato | MP4, video H.264 (perfil High), `yuv420p` |
| Tamaño | 720 × 720 px (cuadrado) |
| Cuadros por segundo | 30 |
| Duración | 3.2 s, en bucle sin salto |
| Audio | Ninguno |
| `faststart` | Sí (el índice `moov` va al principio: empieza a reproducirse antes de bajar completo) |
| Peso | ~110–150 kB (máximo que acepta el script de subida: 3 MB) |

## 4. Qué se entrega y qué se reemplaza

Por cada ejercicio, **solo se agrega** su video. Nada se borra:

| Dónde | Qué | Quién lo escribe |
|---|---|---|
| Storage `ejercicios/<id>.mp4` | El video | `functions/scripts/subirVideoEjercicio.mjs` |
| Firestore `ejercicios/{id}` → `videoRuta` | `"ejercicios/<id>.mp4"` | El mismo script |

**Lo que NO cambia:**

- El GIF (`ejercicios/<id>.webp`, campo `gifRuta`) **se queda**: sigue saliendo en el grid,
  en las filas comprimidas del entrenamiento y como póster mientras carga el video.
- Nombre, alias, grupo, músculos y las listas de "Ejercicios por grupo" no se tocan.
- Recargar el banco (`cargarBancoEjercicios.mjs`) **no borra** `videoRuta`: escribe con
  `merge` y sin ese campo.
- No hay que desplegar la web ni reinstalar la app: ya leen `videoRuta` del banco en vivo.

## 5. Instalación (una sola vez)

Requisitos: Python 3.11+, `ffmpeg` y unos 1.5 GB libres. No hace falta tarjeta gráfica: corre
en CPU (~13 s por ejercicio con 4 núcleos).

```bash
cd docs/videos-ejercicios
python3 -m venv venv
# PyTorch para CPU. torchvision TIENE que venir del mismo índice que torch: la de PyPI no
# corresponde y falla con "operator torchvision::nms does not exist".
venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
venv/bin/pip install spandrel pillow numpy
```

El modelo (`modelos/RealESRGAN_x4plus.pth`, 64 MB) lo baja el script la primera vez.
`venv/`, `modelos/`, `salida/` y `trabajo/` están en `.gitignore`: no se versionan (los videos
son derivados de las animaciones de Gym visual y viven solo en Storage).

## 6. Paso a paso

### 6.1 Generar

```bash
cd docs/videos-ejercicios
venv/bin/python camino1.py press-banca sentadilla jalon-al-pecho   # unos cuantos
venv/bin/python camino1.py --todos                                  # los 91 (~20 min)
```

Termina con un resumen: cuántos hizo y cuáles saltó.

### 6.2 Revisar (antes de subir)

Por cada ejercicio, abrir `salida/<id>-poses.png` y, si hay duda, `salida/<id>.mp4`:

- [ ] Las 2 poses son las del ejercicio correcto (comparar con el nombre).
- [ ] No hay deformaciones del escalado: manos, dedos, barra, pesas, cables, cara.
- [ ] El fondo es blanco y limpio, sin manchas ni bordes raros.
- [ ] El músculo marcado en rojo se ve igual que en el GIF.
- [ ] El bucle no salta (al terminar regresa a la pose A sin brinco).

Si uno sale mal, no se sube: se queda con su GIF.

### 6.3 Subir

Credenciales con permiso sobre `osfit-cccfe` (las mismas que la carga del banco):
`gcloud auth application-default login`, o `GOOGLE_APPLICATION_CREDENTIALS` apuntando a la
llave de una cuenta de servicio.

```bash
cd functions
# Uno:
node scripts/subirVideoEjercicio.mjs press-banca ../docs/videos-ejercicios/salida/press-banca.mp4

# Todos los generados (cada archivo se llama como el id del ejercicio):
for f in ../docs/videos-ejercicios/salida/*.mp4; do
  node scripts/subirVideoEjercicio.mjs "$(basename "$f" .mp4)" "$f"
done
```

Cada uno imprime `✓ <id>: video subido (… kB) → ejercicios/<id>.mp4`.

### 6.4 Verificar

1. La URL pública responde (cambiar el id):
   `curl -I "https://firebasestorage.googleapis.com/v0/b/osfit-cccfe.firebasestorage.app/o/ejercicios%2F<id>.mp4?alt=media"`
   → `200` y `content-type: video/mp4`.
2. **Web**: Registro → Iniciar entrenamiento → agregar el ejercicio → la tarjeta grande muestra
   el video en bucle.
3. **App**: menú → Ejercicios por grupo → su grupo → tocar el ejercicio → la vista grande lo
   reproduce.

### 6.5 Deshacer

```bash
cd functions && node scripts/subirVideoEjercicio.mjs <id> --quitar
```

Borra el video de Storage y el campo `videoRuta`; el ejercicio vuelve a su GIF.

## 7. Cómo está implementado

### Datos

- `ejercicios/{id}.videoRuta` (opcional): ruta en Storage. Tipos: `EjercicioBanco.videoRuta`
  en `web/src/datos.ts` y en `app/.../data/model/EjercicioBanco.kt`.
- `storage.rules`: `ejercicios/{archivo}` se lee **sin sesión**, igual que los GIF. Por eso la
  página arma la URL pública directo, sin pedir una URL por archivo.
- Caché: los videos se suben con `Cache-Control: public, max-age=86400` (un día). Si se
  reemplaza el video de un ejercicio, a más tardar al día siguiente todas ven el nuevo.

### Web (Registro)

- `web/src/banco.ts` → `urlVideo(ruta)`: la URL pública de Storage.
- `web/src/ui/registro.ts` → `medioGrande()`: en la tarjeta del ejercicio activo, si el banco
  tiene `videoRuta`, pinta
  `<video autoplay muted loop playsinline preload="auto" poster="<GIF>">`; si no, el GIF.
  Mudo, en bucle y `playsinline` es lo que deja a iOS reproducirlo solo, sin que la clienta
  toque nada. Toma las rutas **del banco vivo**, no de la copia del entrenamiento: un video
  subido con un entrenamiento abierto aparece sin empezar otro.
- Tamaño: **260 px** (`.registro-activo-gif .registro-ej-video` en `web/src/estilos.css`,
  decisión del entrenador). El GIF sin video se queda en 180 px, su tamaño real.
- El grid y las filas comprimidas **nunca** cargan video (serían decenas a la vez).
- La animación de vuelo (`ui/vueloRegistro.ts`) aterriza igual en el video que en el GIF.
- Tests: `web/src/ui/registro.test.ts` ("video del ejercicio") y `web/src/banco.test.ts`.

### App (Android)

- `app/.../ui/common/VideoEjercicio.kt`: `VideoView` del sistema, mudo y en bucle, con el GIF
  debajo hasta que pinta el primer cuadro; si el video falla (sin red) se queda el GIF.
- Se usa en la vista grande de "Ejercicios por grupo" (`ui/grupos/GruposEjerciciosScreen.kt`).
- `NombresBanco.urlVideo()` arma la misma URL pública que la web (con test).

### Scripts

- `docs/videos-ejercicios/camino1.py`: genera los videos (este documento).
- `functions/scripts/subirVideoEjercicio.mjs`: sube uno y escribe `videoRuta` (o `--quitar`).
- `functions/scripts/bancoEjercicios.mjs` → `rutaVideo(id)`: `ejercicios/<id>.mp4` (con test).

## 8. Tiempos y costo

| Paso | Tiempo |
|---|---|
| Instalación | ~10 min (descargas) |
| Generar los 91 | ~20 min en CPU, automático |
| Revisar | ~1 min por ejercicio, ~1.5 h en total |
| Subir los 91 | ~2 min |

Costo: cero (todo libre y en local). Storage: ~91 × 130 kB ≈ 12 MB.

## 9. Licencia

Los videos son **derivados** de las animaciones de Gym visual: mismo dibujo, escalado. El
entrenador lo está arreglando con ellos (ver `docs/licencias/GymVisual.md`). Se conserva el
crédito "Animaciones © Gym visual" en la página, junto a donde se muestran.

## 10. Estado

- **Piloto (2026-10-10):** press de banca generado y **subido a producción**
  (`ejercicios/press-banca.mp4`); sentadilla y jalón al pecho generados, sin subir.
- **Pendiente:** generar, revisar y subir los demás (punto 10 de `docs/backlog-2.md`).
