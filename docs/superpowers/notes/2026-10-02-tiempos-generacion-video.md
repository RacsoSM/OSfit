# Tiempos de generación del video: Blobs vs. Mancu

**Estado:** pendiente de medir. Hace falta el teléfono del entrenador; en la sesión de
implementación no había ningún dispositivo conectado por adb.

**Criterio acordado:** Mancu no debería tardar más de ~1.5× lo que tarda Blobs con el mismo
cliente. Si lo supera, **el entrenador decide** si se acepta (la autorización es suya).

## Cómo se mide

`ResumenVideoGenerator.generarYCompartir` ya emite una línea por video (tiempo de la llamada al
encoder, sin contar la lectura de Firestore ni el menú de compartir):

```
I/ResumenVideo: estilo=<blobs|mancu> videoMs=<duración del video> generacionMs=<ms> ratio=<generacionMs/videoMs>
```

Con el teléfono por USB y depuración activa:

```bash
adb logcat -c
# en la app: generar el resumen quincenal con estilo Blobs, luego otro con Mancu (mismo cliente)
adb logcat -d -s ResumenVideo:I
```

`adb` está en `C:\Users\Usuario\AppData\Local\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe`.

Para que sea comparable: mismo cliente y misma quincena, teléfono sin otras apps pesadas, y repetir
2–3 veces cada estilo (la primera generación incluye el arranque en frío de las fuentes y del
encoder). Solo cuenta el estilo quincenal; semanal y mensual siempre usan Blobs.

## Resultados

| Fecha | Dispositivo | Cliente | Estilo | videoMs | generacionMs | ratio |
|---|---|---|---|---|---|---|
| _pendiente_ | | | blobs | | | |
| _pendiente_ | | | mancu | | | |

**Ratio Mancu / Blobs:** _pendiente_ (objetivo ≤ 1.5).

## Si Mancu sale lento: dónde mirar primero

- `saveLayerAlpha` ya no se usa en las transiciones (la nube dibuja una sola escena).
- `FondoPapelRenderer`: la textura es un bitmap de 256×256 en `BitmapShader` (barato); el costo
  mayor suele ser el degradado de viñeta a pantalla completa.
- `TextoMancu`: contorno + sombra dura = 3 pasadas de texto por bloque.
- `MancuDibujo`: unas 40 primitivas por frame, normalmente despreciable frente al encoder.
