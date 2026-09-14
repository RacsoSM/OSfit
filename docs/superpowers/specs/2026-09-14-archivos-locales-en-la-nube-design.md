# Que los archivos locales sobrevivan a una desinstalación

## Contexto y objetivo

La app guarda tres cosas en `filesDir` y sólo ahí vive el archivo que de verdad
se usa:

| local | quién lo lee |
|---|---|
| `filesDir/canciones/<clienteId>.<ext>` | el generador de video, como música de fondo |
| `filesDir/medallas/<id>.png` | el generador de video, para dibujar la insignia |
| `filesDir/logrosPersonales/<id>.png` | el generador de video, igual |

Desinstalar la app borra las tres carpetas. Las dos de insignias tienen copia en
Storage —`InsigniaStorageRepository.subir` las sube y el catálogo guarda su
`imagenUrl`—, pero **nada las vuelve a bajar**: hay código que sube la que falta
(`MedallasViewModel`, la pasada de relleno) y ninguno que haga el viaje de
vuelta. Y `MedallaCatalogo.kt` es explícito en que la URL no reemplaza al
archivo:

> No reemplaza a `imagenArchivo`: el generador de video sigue leyendo el PNG de
> `filesDir`.

De las canciones no hay copia en ninguna parte. `Cliente.cancionArchivo` guarda
un nombre de archivo local y nada más.

El resultado es que hoy desinstalar cuesta datos que no se pueden recuperar
desde la app: la web se sigue viendo bien —usa `imagenUrl`— y el video se queda
sin imágenes y sin música.

**Objetivo:** que todo lo que el entrenador sube quede además en la nube, y que
al reinstalar la app lo recupere sola, sin que él tenga que hacer nada.

**Alcance:** de aquí en adelante. Las canciones que hay hoy en el teléfono se
pierden si se desinstala antes de que este cambio esté instalado; el entrenador
las vuelve a elegir a mano. Las imágenes de medallas y logros **no** hay que
volver a subirlas: sus copias en Storage ya existen y el restaurador de este
spec las baja solas.

**Fuera de alcance:** rescatar lo que hay hoy en el teléfono; un botón de
"restaurar" manual; borrar de la nube cuando se borra en local; y cualquier
cambio al generador de video, que sigue leyendo de `filesDir` sin enterarse de
nada.

## Por qué no se mueve el archivo a la nube y ya

La tentación es tirar `filesDir` y que el generador descargue al vuelo. Se
descarta por dos razones que ya están escritas en el repo.

`CancionUtil` documenta por qué existe la copia local:

> un `content://` puede perder su permiso de lectura al reiniciar el proceso o
> si el trainer borra el archivo de su galería, y el video generado después
> dejaría de tener música

Y generar el video es lo más delicado de la app: dibuja frame a frame, tarda
minuto y medio en el mejor caso (ver backlog 11) y se hace en el gimnasio. Meterle
una dependencia de red en medio cambia un fallo local y visible por uno remoto e
intermitente.

La copia local se queda como está. La nube es **respaldo**, no fuente.

## El camino de escritura

Sólo cambian las canciones. Las insignias ya suben y no se tocan.

`CancionUtil.copiarCancion` queda igual: copia a `filesDir` primero, que es lo
que garantiza que el video funcione aunque la subida falle. Encima, un
`CancionStorageRepository` con la misma forma que `InsigniaStorageRepository`
sube el archivo a `canciones/<clienteId>.<ext>`.

Devuelve la **ruta**, no la URL de descarga. La convención ya está razonada en
`InsigniaStorageRepository`: URL para el catálogo de insignias, que no es dato
personal y la web pinta con un `<img src>` pelado; ruta para lo personal, como
`resumenes/`, donde un enlace permanente dentro del documento expondría el
archivo de alguien. Una canción está atada a una clienta y no la necesita la
web, así que va por el camino de la ruta.

`Cliente` gana un campo `cancionRuta: String? = null`, junto al `cancionArchivo`
que ya existe. Los dos se quedan: `cancionArchivo` dice qué buscar en disco,
`cancionRuta` dice de dónde bajarlo si no está. Valor por defecto `null` como
exige la convención de Firestore, y toda clienta anterior a este cambio llega
sin el campo — esperado, y el restaurador lo trata como "no hay respaldo".

Si la subida falla, se registra y ya: el archivo local quedó escrito y el video
funciona. Queda sin respaldo hasta la siguiente vez que se elija esa canción.
Esto es deliberado — que una subida caída impida cambiar la canción sería peor
que el problema que resuelve.

## El restaurador

Una clase `RestauradorDeArchivos`, con la misma forma y el mismo motivo que
`SincronizadorDiaWeb`, cuyo comentario explica por qué se concentra en un solo
sitio:

> el riesgo de este diseño es justamente "un camino de escritura que olvidó
> refrescar": concentrarlo hace que la pregunta "¿quién refresca?" se responda
> leyendo un solo archivo

Aquí la pregunta es "¿quién restaura?", y la respuesta debe estar en un archivo.

Corre al arrancar la app, en segundo plano, sin bloquear la interfaz. Lo que
hace, para cada uno de los tres grupos:

1. Arma la lista de lo esperado: de las clientas, las que tienen
   `cancionArchivo`; de los catálogos, las medallas y logros con
   `imagenArchivo`.
2. Descarta las que ya tienen su archivo en disco. **Si está, no toca la red.**
   En el arranque normal —el 99% de las veces— no baja nada.
3. Baja las que faltan y tienen respaldo: la canción desde `cancionRuta`, las
   insignias desde `insignias/<carpeta>/<id>.png`.

La ruta de una insignia se **arma con su id y su carpeta**, no se saca de
`imagenUrl`. Es la misma ruta que `InsigniaStorageRepository.subir` construye al
subirla, y por el mismo motivo que allí la carpeta la fijan dos métodos y no
llega como texto libre: es determinista y no hay nada que parsear. `imagenUrl`
se queda para lo que existe, que es que la web pinte la insignia con un
`<img src>` sin cargar el SDK.

Cada descarga va en su propio `runCatching`: si una falla, las demás siguen. Un
archivo que no se pudo bajar se reintenta en el siguiente arranque, porque el
criterio es "falta en disco" y seguirá faltando. No hace falta estado ni
reintentos propios.

Una insignia sin respaldo (`imagenArchivo` puesto, nada en Storage) se salta en
silencio: es el estado que la pasada de relleno de `MedallasViewModel` ya
existe para arreglar en el otro sentido.

## Las rutas de Storage

Las insignias ya tienen su sitio. Las canciones estrenan uno:

```
canciones/<clienteId>.<ext>
```

Y su regla en `storage.rules`:

```
match /canciones/{archivo} {
  allow read, write: if esEntrenador();
}
```

Sólo el entrenador, a diferencia de `resumenes/`, que deja a cada clienta leer
lo suyo. La web no pinta la canción: la música existe dentro del mp4 ya
generado, no como archivo aparte. Dar acceso a las clientas sería ampliar la
superficie sin que nadie lo use.

## Qué se prueba, y qué no

Lo que decide **qué falta** es una función pura y ahí van las pruebas: recibe la
lista de lo esperado y una forma de preguntar si un archivo existe, y devuelve
lo que hay que bajar. Casos que deben quedar cubiertos:

- Todo presente en disco → no devuelve nada (el caso normal; si esto se rompe,
  la app baja archivos en cada arranque).
- Falta el archivo y hay respaldo → lo devuelve.
- Falta el archivo y no hay respaldo (`cancionRuta` nulo, o clienta anterior al
  cambio) → no lo devuelve y no revienta.
- Clienta sin `cancionArchivo` → no se espera nada suyo.

Subir y bajar en sí son SDK de Firebase y no se prueban con JUnit; quedan para
la verificación en dispositivo, que es donde además se ve lo único que importa
de verdad: **elegir una canción, desinstalar, reinstalar, y que el video salga
con su música sin haber tocado nada**.

## Lo que este spec no arregla

La app sólo se puede actualizar desde la máquina que la firmó (backlog 11). Este
cambio no toca eso, y mientras siga así, instalar la versión con el restaurador
exige desinstalar la actual — que es justo lo que borra las canciones de hoy.
El orden correcto es resolver primero la firma, y después instalar esto.
