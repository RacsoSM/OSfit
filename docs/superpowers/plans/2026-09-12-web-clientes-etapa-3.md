# Web para clientes — Etapa 3: medallas, logros y videos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la página del cliente muestre sus medallas con su insignia, sus logros personales y sus últimos 6 resúmenes en video; y que el entrenador pueda subir las insignias y publicar un video desde la app, sin salir de donde ya hace esas cosas.

**Architecture:** Firebase Storage entra por primera vez al proyecto. Sube **la app**, nunca una function: el entrenador ya tiene el PNG en `filesDir` y el mp4 en su disco, y mandarlos por un callable sería pasarlos en base64 por un sitio que no aporta nada. Las reglas de Storage usan el mismo claim `clienteId` que ya usan las de Firestore. La página no gana ninguna escritura nueva: sigue siendo de solo lectura, y las tres secciones nuevas son tres listeners más.

**Tech Stack:** Kotlin + Jetpack Compose (app existente), Firebase Auth + Firestore + Hosting + **Storage**, sitio en Vite + TypeScript sin framework, Vitest para los tests de TS, JUnit4 para los de Kotlin.

**Spec:** `docs/superpowers/specs/2026-09-10-web-clientes-design.md` — secciones "Reglas de Storage", "Colecciones nuevas" (`VideoPublicado`), "Campos nuevos en modelos existentes" (`imagenUrl`), "Medallas, logros y videos", "Estados vacíos y de excepción", y los puntos 2 y 3 de "Cambios en la app Android".

**Etapa previa:** `docs/superpowers/plans/2026-09-12-web-clientes-etapa-2.md`. Tasks 1-12 completas y desplegadas; el Task 13 (verificación en dispositivo) sigue abierto — ver U1 en `docs/backlog.md`. **Esta etapa no lo espera**: no toca las dos acciones ni el trío denormalizado, así que lo que quede por verificar de la Etapa 2 no bloquea nada de acá.

## Global Constraints

- **Idioma:** código, nombres de variables, comentarios y nombres de test **en español**. Mensajes de commit **en inglés**. Ver `GEMINI.md`.
- **Comentarios:** solo explican el *porqué* de decisiones no obvias, nunca repiten lo que el código ya dice.
- **Firestore:** todo `data class` necesita valor por defecto en **todos** los campos. El `id` no se guarda dentro del documento: se escribe con `.copy(id = "")` y se rellena al leer desde `doc.id`.
- **Repositorios:** clases planas, no interfaces.
- **ViewModels:** reciben repositorios por constructor con `AppContainer.xxx` como valor por defecto.
- **Tests Kotlin:** JUnit4, nombres en backticks y en español. Solo para `domain/` y `video/`.
- **UID del entrenador:** `G8lW4rIgXhZrswQXJ84pT1StFx82`.
- **Proyecto Firebase:** `osfit-cccfe`. Bucket: `osfit-cccfe.firebasestorage.app`. Región de functions: `us-west1`.
- **Desplegar cada cambio a producción**, solo lo que el cambio tocó, compilando a mano antes (`firebase.json` no tiene `predeploy`).
- **Commits:** uno por tarea, en inglés, terminando con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## Cuatro decisiones que el spec no fija

Se anotan acá, y no escondidas dentro de una tarea, porque son los sitios donde este plan elige algo que el spec dejó abierto — y el primero es un agujero, no una preferencia.

### 1. La insignia se copia en la medalla otorgada. El catálogo NO se le abre al cliente

**El spec, tal como está, no se puede implementar.** Pide "medallas con su imagen de Storage y su nombre", pero las reglas dejan el catálogo (`medallas`, `logrosPersonales`) como **solo entrenador**, y la imagen vive ahí. El cliente puede leer `clientes/{cid}/medallas` —lo que se le otorgó— y ahí hay `nombreMedalla` pero no hay imagen. Tal cual está, la página puede escribir el nombre y nada más.

Hay dos salidas, y este plan toma la segunda:

- **Abrirle el catálogo al cliente.** Una superficie más que exponer, y el spec ya rechazó exactamente eso para `rutinas` ("es una superficie menos que exponer").
- **Copiar `imagenUrl` en la otorgada**, que es lo que ya se hace con el nombre. `MedallaOtorgada` y `LogroPersonalOtorgado` denormalizan `nombreMedalla` / `nombreLogro` a propósito, con este comentario: *"Copia del nombre al momento de otorgarla: si el catálogo se edita después, el historial no cambia retroactivamente"*. La imagen merece el mismo trato por la misma razón: si el entrenador le cambia el dibujo a una medalla en enero, la que el cliente ganó en agosto debería seguir viéndose como se veía en agosto.

Así que las dos otorgadas ganan un `imagenUrl: String? = null`, copiado del catálogo al otorgar. Las reglas de Firestore **no cambian en esta etapa**.

Consecuencia a tener presente: **todo lo otorgado antes de esta etapa se queda sin imagen**, porque cuando se otorgó no existía ninguna. No se rellena hacia atrás — habría que decidir qué insignia tenía el catálogo en ese momento, y ese dato no está en ningún lado. Esos casos caen en la insignia genérica, que el spec ya contempla (`null` = la web dibuja la genérica).

### 2. Insignias por URL de descarga; videos por ruta

Las reglas de Storage **no se aplican al cargar la URL**, se aplican al **obtenerla**. Una URL de descarga de Firebase lleva un token dentro y funciona para cualquiera que la tenga, sin sesión. Eso cambia qué conviene guardar en cada caso:

- **Insignias:** se guarda la URL de descarga completa en `imagenUrl`. La página las pinta con un `<img src>` pelado y **no necesita el SDK de Storage**. Que la URL sea pública no molesta: el spec ya dice que el catálogo de insignias "no es dato personal".
- **Videos:** se guarda `rutaStorage` (`resumenes/<clienteId>/<rangoInicio>.mp4`), como pide el spec, y la página llama a `getDownloadURL()` al pintar. Así el documento que el cliente puede leer **no contiene un enlace permanente al video de nadie**, y quien no tenga el claim no puede ni pedirlo. Mismo criterio que el token del link mágico, que vive fuera del documento del cliente.

Esto obliga a meter el SDK de Storage en la web, pero solo por los videos.

### 3. Las insignias van primero y se despliegan solas

El spec junta las tres secciones en una etapa, pero son dos bloques con costos muy distintos: unos PNG de kilobytes contra mp4 de megabytes con lógica de retención. Este plan ordena las tareas para que el **bloque de insignias (Tasks 1-5) se pueda desplegar entero y solo**, dejando ya dos de las tres secciones en pie. El bloque de videos (Tasks 6-8) va después, y es el que se corta si hay que cortar algo — que es justo lo que el spec dice de esta etapa.

### 4. Al aplicar la retención de 6, se borra el blob antes que el documento

El orden importa porque el borrado no es atómico entre Storage y Firestore, y los dos fallos posibles no cuestan lo mismo:

- Si se borra primero el documento y falla el blob, queda un mp4 **huérfano**: nadie lo ve, nadie lo encuentra, y se paga todos los meses.
- Si se borra primero el blob y falla el documento, queda un documento apuntando a un archivo que no está: **se ve**, la página lo resuelve como "video no disponible", y el próximo publicar lo vuelve a intentar.

Se prefiere el fallo visible. Borrar blob, después documento.

---

## Bloque A — Insignias

### Task 1: Storage en el proyecto — ✅ HECHO (2026-09-12)

No hay nada montado: ni dependencia en la app, ni `storage.rules`, ni sección `storage` en `firebase.json`. El bucket sí existe (responde 403, no 404).

**Files:**
- Create: `storage.rules`
- Modify: `firebase.json`, `app/build.gradle.kts`

- [x] **Step 1: Comprobar qué reglas tiene el bucket HOY, antes de pisarlas.** Si sigue en las de por defecto y ya hay algo subido, conviene saberlo antes de desplegar encima.
- [x] **Step 2: Escribir `storage.rules`** con las del spec: `insignias/**` legible por cualquier sesión, `resumenes/{clienteId}/**` legible por el entrenador o por el dueño del claim, escritura solo entrenador en ambos.
- [x] **Step 3: Apuntar `firebase.json` al archivo** con `"storage": { "rules": "storage.rules" }`.
- [x] **Step 4: Agregar `firebase-storage-ktx`** al bloque de dependencias, dentro del BOM que ya está.
- [x] **Step 5: Desplegar** `firebase deploy --only storage` y compilar la app.
- [x] **Step 6: Commit.**

**Cómo quedó el Step 1.** Listar la raíz del bucket da 403 aunque las reglas sean permisivas
—`{allPaths=**}` no autoriza listar el prefijo raíz—, así que ese 403 no dice nada. Lo que sí
distingue es pedir un objeto concreto: con reglas abiertas, uno que no existe da 404; con el
bucket cerrado, da 403. Como entrenador autenticado daban **403 las tres rutas probadas**, o
sea que el bucket estaba cerrado (`if false`, el default moderno). Nada podía leerse ni
escribirse, así que nada dependía de él.

**Verificado después de desplegar**, con la sesión del entrenador sacada por REST con las
credenciales de `local.properties`:

| prueba | resultado | qué prueba |
|---|---|---|
| entrenador → ruta fuera de las dos | 403 | no se abrió nada de más |
| entrenador → `insignias/…` | 404 | puede leer; el objeto no existe |
| entrenador → `resumenes/…` | 404 | puede leer |
| sin sesión → `insignias/…` | 403 | sigue cerrado sin sesión |

Falta la rama de aislamiento entre clientas (que una no pueda pedir el video de otra), que
necesita dos sesiones de clienta y va en el Task 10, Step 5.

### Task 2: `imagenUrl` en los cuatro modelos, y el repositorio de subida

**Files:**
- Modify: `MedallaCatalogo.kt`, `LogroPersonalCatalogo.kt`, `MedallaOtorgada.kt`, `LogroPersonalOtorgado.kt`
- Create: `app/src/main/java/com/osfit/app/data/repository/InsigniaStorageRepository.kt`
- Modify: `AppContainer.kt`

**Interfaces:**
- Produces: `InsigniaStorageRepository.subir(carpeta: String, id: String, archivo: File): String` — sube y devuelve la URL de descarga.

- [ ] **Step 1: Agregar `imagenUrl: String? = null`** a los dos catálogos y a las dos otorgadas, cada uno con el comentario de por qué se copia (decisión 1).
- [ ] **Step 2: Escribir `InsigniaStorageRepository`**, que sube a `insignias/<carpeta>/<id>.png` y devuelve `getDownloadUrl()`. `imagenArchivo` **no se toca**: el generador de video sigue leyendo de `filesDir`, y la subida es un agregado, no un reemplazo.
- [ ] **Step 3: Registrarlo en `AppContainer`.**
- [ ] **Step 4: Compilar.**
- [ ] **Step 5: Commit.**

### Task 3: Subir la insignia al crear o editar

**Files:**
- Modify: las pantallas y ViewModels de `ui/medallas/` y `ui/logros/`, y `MedallaRepository` / `LogroPersonalRepository`.

- [ ] **Step 1: Al guardar una medalla con imagen nueva**, subirla y guardar `imagenUrl` junto al resto.
- [ ] **Step 2: Lo mismo para un logro personal.**
- [ ] **Step 3: Copiar `imagenUrl` al otorgar**, en los dos caminos, junto a la copia del nombre que ya se hace.
- [ ] **Step 4: Qué pasa si la subida falla.** La medalla se guarda igual, sin `imagenUrl`: el entrenador no se puede quedar sin poder crear una medalla porque el wifi del gimnasio se cayó. Ese caso lo recoge el botón del Task 4.
- [ ] **Step 5: Compilar y correr la suite.**
- [ ] **Step 6: Commit.**

### Task 4: Botón "Subir insignias" para las que ya existen

Se toca una vez y sube las que no tengan URL (spec, punto 2 de "Cambios en la app Android"). También es la red de seguridad del Step 4 anterior.

- [ ] **Step 1: Añadir el botón** en la pantalla del catálogo de medallas y en la de logros.
- [ ] **Step 2: Recorrer las que tengan `imagenArchivo != null && imagenUrl == null`**, subir y actualizar.
- [ ] **Step 3: Reportar cuántas subió y cuántas fallaron**, sin cortar el recorrido en la primera que falle.
- [ ] **Step 4: Compilar. Commit.**

### Task 5: Medallas y logros en la página

**Files:**
- Modify: `web/src/datos.ts`, `web/src/main.ts`
- Create: `web/src/ui/tarjetaInsignias.ts` (+ su test)

- [ ] **Step 1: Observar `clientes/{cid}/medallas` y `/logrosPersonales`.** Las reglas ya lo permiten desde la Etapa 1; no hay nada que desplegar de reglas.
- [ ] **Step 2: Pintar las dos secciones.** Medalla: imagen y nombre. Logro: nombre y encabezado del período. Sin `imagenUrl`, la insignia genérica.
- [ ] **Step 3: Tests de Vitest** del armado del HTML, incluidos los casos sin imagen y sin nada otorgado.
- [ ] **Step 4: Compilar, desplegar hosting, verificar con `curl.exe`. Commit.**

---

## Bloque B — Videos

### Task 6: `VideoPublicado` y su repositorio

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/VideoPublicado.kt`, `.../repository/VideoPublicadoRepository.kt`
- Modify: `AppContainer.kt`

- [ ] **Step 1: Crear el modelo** con los campos del spec: `id`, `rangoInicio`, `encabezadoRango`, `rutaStorage`, `duracionSegundos`, `creado`.
- [ ] **Step 2: El repositorio**, con `publicar()`, `observarDe(clienteId)` y `borrar()`.
- [ ] **Step 3: Registrar. Compilar. Commit.**

### Task 7: "Publicar en la web" y la retención de 6

**Files:**
- Modify: `ResumenClienteViewModel.kt` y la pantalla del resumen.

- [ ] **Step 1: Botón "Publicar en la web"** junto a la acción de compartir que ya existe. Compartir **no cambia**: publicar es otra cosa, no un reemplazo.
- [ ] **Step 2: Subir el mp4** a `resumenes/<clienteId>/<rangoInicio>.mp4` y escribir el documento.
- [ ] **Step 3: Retención.** Ordenar por `rangoInicio` descendente y, de la séptima en adelante, **borrar el blob y después el documento** (decisión 4).
- [ ] **Step 4: Republicar la misma quincena** pisa la anterior: la ruta se deriva de `rangoInicio`, así que el blob se sobreescribe y el documento es un upsert.
- [ ] **Step 5: Compilar. Commit.**

### Task 8: Videos en la página

- [ ] **Step 1: Meter el SDK de Storage en la web** y observar `clientes/{cid}/videos`.
- [ ] **Step 2: Los últimos 6, más reciente primero**, con encabezado del rango y duración.
- [ ] **Step 3: Resolver cada `rutaStorage` con `getDownloadURL()`** al pintar (decisión 2). Si falla —blob borrado, retención a medias—, la tarjeta dice "video no disponible" en vez de dejar un reproductor roto.
- [ ] **Step 4: Tests. Desplegar. Commit.**

---

## Cierre

### Task 9: Estados vacíos de las tres secciones

Spec, "Estados vacíos y de excepción": *"cada sección dice qué falta y quién lo resuelve. Ninguna sección queda en blanco."*

- [ ] **Step 1: Sin medallas, sin logros, sin videos**, cada una con su texto.
- [ ] **Step 2: Tests. Desplegar. Commit.**

### Task 10: Verificación en dispositivo

- [ ] **Step 1: Subir las insignias existentes** con el botón del Task 4 y confirmar que aparecen en la página de una clienta de verdad.
- [ ] **Step 2: Otorgar una medalla nueva** y ver que llega con su imagen.
- [ ] **Step 3: Publicar un video** y verlo reproducirse desde la página.
- [ ] **Step 4: Publicar un séptimo video** y confirmar que el más viejo desaparece de Firestore **y** de Storage.
- [ ] **Step 5: El test negativo de Storage**, que es el que no se puede saltar: con la sesión de una clienta, pedir el video de **otra**. Tiene que dar error de permisos. Se corre igual que el de la Etapa 2 (ver U1 en `docs/backlog.md`).
