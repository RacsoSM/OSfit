# Generar GIF propios para el banco de ejercicios

Cómo se hizo el GIF de **Prensa en máquina** (`prensa-maquina`), y cómo repetirlo para otro
ejercicio que el dataset no trae. Hecho el 2026-10-17.

## El problema

Los GIF del banco salen de [`hasaneyldrm/exercises-dataset`](https://github.com/hasaneyldrm/exercises-dataset)
(animaciones © Gym visual, ver `docs/licencias/GymVisual.md`). Para la prensa horizontal
sentado en máquina de placas, la del gym, el dataset solo trae:

| id   | animación                         | por qué no sirve                        |
|------|-----------------------------------|-----------------------------------------|
| 2611 | prensa horizontal a **una** pierna | la otra pierna descansa en el escalón   |
| 2287 | prensa de palanca alternando      | otra máquina, piernas alternadas        |
| 0739 | prensa 45°                        | otra máquina (ya es `prensa` en el banco) |

## Lo que se intentó

1. **Canva:** no hizo falta. Genera imágenes fijas con otro estilo; no sirve para armar los
   cuadros de un movimiento con el muñeco de Gym visual.
2. **Dibujarlo desde cero en código** (Pillow, figura y máquina con cinemática de dos tramos
   para la pierna): el movimiento salía bien, pero se veía esquemático, tipo maniquí, al
   lado de los renders de Gym visual. Se descartó.
3. **Derivarlo de 2611**, que tiene la misma máquina horizontal: **es el que se usa.** Gym
   visual permite derivadas en su estilo (lo revisó el entrenador, 2026-10-17).

## Cómo está hecha una animación de Gym visual

Abriendo 2611 cuadro por cuadro (`convert 2611.gif -coalesce f%02d.png`, duraciones con
`identify -format "%T "`):

- 180×180, fondo blanco, **12 cuadros**.
- Solo hay **dos poses reales**: el cuadro 0 (rodillas flexionadas) y el 6 (piernas
  extendidas), de **1 s** cada una.
- Los otros 10 son un **fundido** entre las dos poses, de **0.1 s** cada uno (5 de ida y 5 de
  vuelta).
- Músculos que trabajan en rojo, el resto gris claro con sombreado suave, sin contorno duro.

Así que hacer un GIF en su estilo se reduce a **hacer bien dos imágenes** y repetir ese
fundido.

## El proceso, paso a paso

Todo está en `functions/scripts/gifsPropios/prensa_maquina.py`. Por cada pose:

### 1. Trazar las zonas a mano

Sobre una ampliación ×5–×10 del cuadro con cuadrícula cada 10 px (así se leen las
coordenadas), se trazan polígonos en píxeles del GIF de 180×180:

- `cerca`: la pierna que empuja (pie, espinilla, muslo rojo). En 2611 es la pierna
  **cercana**: su muslo tapa a la otra.
- `descansa`: la pierna que va al escalón; es la que se borra.
- `torso`: la persona a la derecha del muslo (torso, brazos, cabeza).
- `movil`: el asiento, que se desliza entre poses (en esta máquina se mueve el asiento y la
  plataforma queda fija).
- `caja`: el escalón negro, que la pierna que descansa tapa en las dos poses.

Con `--revision` el script deja una hoja con las guías dibujadas encima para comprobar que
los polígonos calzan.

### 2. Borrar la pierna que descansa

La máquina no se mueve entre poses, salvo el asiento. Lo que la pierna tapa en una pose se
copia de la otra pose, siempre que ahí no esté la persona (`cerca`, `descansa`, `torso`,
`movil` de la otra pose). Lo que queda tapado en las dos se pinta blanco, y el escalón se
repinta negro con `caja`.

### 3. Dibujar la pierna lejana

Es una copia de la pierna cercana, puesta detrás:

- **Desplazada `(7, -7)`** (atrás y arriba). Con 4 px se leía como un contorno doble, no como
  otra pierna; se probaron 4, 6, 8 y 9 px en una hoja comparativa y 7 fue el mejor.
- **Como silueta sólida**, no como recorte del polígono: los brillos casi blancos de la piel
  dejaban ver el fondo a través de la pierna. La silueta se saca con un umbral (`< 250`),
  un cierre morfológico (`MaxFilter` + `MinFilter`) y relleno de huecos (`floodfill` desde
  la esquina).
- **Oscurecida** (`× 0.8`) y con **sombra de contacto** (hasta 30 % más oscura) donde queda
  pegada a la cercana. Es como Gym visual distingue la pierna lejana.
- `recorte_lejos` redondea la rodilla lejana en la pose flexionada, que salía cuadrada
  porque heredaba la esquina del polígono de la cercana.

### 4. Volver a poner encima la pierna cercana y el torso

La pierna cercana se pega **por su silueta**. Pegarla por el polígono traía el fondo blanco
de encima de la espinilla y tapaba la pierna lejana; ese fue el error que hacía que "la
pierna de atrás se viera rara".

### 5. Animar

`Image.blend` entre las dos poses: pose A 1 s, 5 cuadros de fundido de 0.1 s, pose B 1 s,
5 de vuelta. Sale `functions/scripts/salida/propios/prensa-maquina.gif`.

## Subirlo a la app

1. **Generar el GIF**, desde `functions/` (necesita Pillow y numpy; baja 2611 del commit
   fijado del dataset):

   ```bash
   python3 -I scripts/gifsPropios/prensa_maquina.py --revision
   ```

   El GIF queda en `scripts/salida/propios/`, que está en `.gitignore`. Igual que los demás
   archivos de Gym visual, no se versiona; se puede regenerar idéntico con el script.

2. **La entrada en la semilla** (`functions/semilla/ejercicios.json`) lleva `gifArchivo` en
   vez de `gifOrigen`, y `derivadoDe` con el id de la animación de origen (la valida contra
   el dataset):

   ```json
   { "id": "prensa-maquina", "nombre": "Prensa en máquina",
     "alias": ["prensa en maquina", "prensa horizontal", "prensa sentado", "..."],
     "tipo": "peso", "grupo": "cuadriceps",
     "musculos": { "cuadriceps": 1, "gluteo": 1, "isquiotibiales": 0.5 },
     "gifArchivo": "prensa-maquina.gif", "derivadoDe": "2611" }
   ```

   Los alias no pueden repetirse entre ejercicios. "prensa en maquina" era de `prensa`
   (45°), y "prensa horizontal" y "prensa sentado" eran de `prensa-horizontal-una-pierna`;
   ahora son de `prensa-maquina`.

3. **Probar y cargar.** Los ejercicios cuyos alias cambiaron también se cargan, para que
   Firestore no se quede con los alias viejos:

   ```bash
   node scripts/cargarBancoEjercicios.mjs --prueba prensa prensa-horizontal-una-pierna prensa-maquina
   node scripts/cargarBancoEjercicios.mjs prensa prensa-horizontal-una-pierna prensa-maquina
   ```

   La carga lo convierte a WebP (de ~140 kB a ~38 kB), lo sube a
   `ejercicios/prensa-maquina.webp` en Storage y escribe `ejercicios/prensa-maquina` en
   Firestore con la atribución de Gym visual. La web y la app lo leen de ahí, así que no
   hace falta desplegar nada.

4. **Unidad en Registro:** la máquina es de placas, así que `prensa-maquina` está en
   `MAQUINAS_DE_BARRAS` (`web/src/barras.ts`) y abre en barras.

## Para hacer otro

1. Busca en `data/exercises.json` del dataset la animación más parecida (misma máquina y
   mismo ángulo) y ábrela cuadro por cuadro. Confirma que las poses son el 0 y el 6.
2. Copia `prensa_maquina.py` y cambia `URL_ORIGEN`, `ARCHIVO` y los polígonos de `POSES`.
   Si el cambio no es "una pierna → dos", cambia los pasos 2–4; lo demás (leer poses,
   fundido, revisión) se reusa tal cual.
3. Revisa con `--revision` y con ampliaciones de la zona editada. Los defectos que
   aparecieron aquí: restos de la pierna borrada en los bordes del polígono, piezas que se
   mueven entre poses (el asiento) usadas como fondo, y fondo blanco pegado encima de lo
   que debía verse.
4. Agrega la entrada con `gifArchivo` + `derivadoDe`, corre `--prueba` y luego la carga.
