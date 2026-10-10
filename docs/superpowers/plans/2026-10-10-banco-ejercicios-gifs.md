# Banco de ejercicios con GIF y Registro — plan

**Objetivo:** el banco de ejercicios (`ejercicios/{id}`) con un GIF por ejercicio, y la
ventana Registro donde la clienta anota lo que su coach le pone en el gym: elige cada
ejercicio en un grid con su GIF y captura peso y reps por serie. Es la parte del punto 7 del
backlog que trae los GIF (punto 3) y el registro.

**Spec:** `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md`, secciones
"Banco de ejercicios" y "Preguntas abiertas".

**Fuente de los GIF:** `hasaneyldrm/exercises-dataset` (animaciones © Gym visual). Licencia
de los medios: `docs/licencias/GymVisual.md`.

## Decisiones

- **Ligar por nombre, no por id guardado.** Las rutinas existentes no tienen
  `ejercicioId`, y el entrenador escribe los nombres a su manera. Cada ejercicio del banco
  trae nombre y alias en español; se comparan con `claveBanco` (la de `claveEjercicio` más
  quitar acentos). `claveEjercicio` no se toca porque guarda las llaves de
  `pesoPorEjercicio`. El `Ejercicio.ejercicioId` del spec llega después, con el buscador en
  el editor de rutinas.
- **Semilla curada de 91 ejercicios**, no los 1,324 del dataset: los nombres del dataset
  están solo en inglés, y para ligar hacen falta nombres en español revisados a mano. Cada
  entrada apunta a su animación con `gifOrigen` (id del dataset). Ampliar el banco es
  agregar entradas al JSON y volver a cargar.
- **Sin `estandares`** por ahora: sigue abierto quién los llena. La carga escribe con
  `merge`, así que agregarlos después no se pisa.
- **WebP animado, no GIF:** ~40 kB en vez de ~125 kB, con los mismos cuadros.
- **Los GIF van en Registro, no en Inicio** (entrenador, 2026-10-10). La tarjeta del día
  queda como estaba.
- **Los GIF se leen sin sesión** (`storage.rules`) y la página arma la URL directo
  (`urlGif`): el grid muestra decenas, y un `getDownloadURL` por cada uno retrasaría la
  pantalla. Son catálogo; una URL con token los dejaba igual de expuestos.
- **Hip thrust** usa la animación de puente de glúteo con barra en el piso: el dataset no
  tiene el hip thrust con la espalda en el banco.

## Tareas

- [x] **1. Semilla y validación** — `functions/semilla/ejercicios.json`,
  `functions/scripts/bancoEjercicios.mjs` (+ test): ids únicos, ningún nombre o alias
  repetido entre dos ejercicios, músculos que existan en los SVG, GIF que exista en el
  dataset.
- [x] **2. Script de carga** — `functions/scripts/cargarBancoEjercicios.mjs`. `--prueba`
  convierte los 91 sin subir nada (dejan los .webp en `functions/scripts/salida/`, ignorada
  por git). Revisada la hoja de contacto: cada animación corresponde a su ejercicio.
- [x] **3. Reglas** — `ejercicios/{id}` en Firestore lo lee cualquier sesión;
  `ejercicios/{archivo}` en Storage se lee sin sesión (ver Decisiones). Escribe el entrenador.
- [x] **4. Web: banco** — `EjercicioBanco` y `observarBanco` (`datos.ts`), `banco.ts`
  (+ test): ligar por nombre, buscar y armar la URL del GIF.
- [x] **5. Función `registrarSesion`** (+ test) y regla de lectura de
  `clientes/{id}/sesiones`.
- [x] **6. Web: Registro** — `registro.ts` (el borrador, puro, + test) y `ui/registro.ts`
  (historial, grid, captura; + test). `diaDeHoy` sale de `tarjetaDia.ts` para ofrecer
  primero los ejercicios del día.
- [ ] **7. Desplegar** (lo hace el entrenador, en este orden):

  1. Reglas primero, para que la página pueda leer el banco en cuanto exista:
     ```bash
     firebase deploy --only firestore:rules,storage
     ```
  2. Cargar el banco, desde `functions/`:
     ```bash
     npm install
     gcloud auth application-default login          # con la cuenta del proyecto
     gcloud auth application-default set-quota-project osfit-cccfe
     node scripts/cargarBancoEjercicios.mjs --prueba   # opcional: revisar los .webp
     node scripts/cargarBancoEjercicios.mjs
     ```
     Debe terminar en "91 de 91 cargados". Se puede repetir sin miedo.
  3. La función, por nombre (un `--only functions` a secas intentaría borrar
     `guardarEstilo`):
     ```bash
     firebase deploy --only functions:registrarSesion
     ```
  4. La web:
     ```bash
     firebase deploy --only hosting
     ```
  5. Verificar en el teléfono: Registro → "+ Agregar ejercicio" muestra los ejercicios del
     día con su animación; buscar "jalón" encuentra el del banco; anotar dos series y
     guardar deja la sesión en el historial. Si un ejercicio del día no aparece en el grid,
     su nombre no casa con el banco: se agrega a `alias` en la semilla y se vuelve a correr
     la carga.

## Fuera de este plan

Borrar una sesión del día, modo guiado, cálculo de fuerza y estándares (colorear el mapa),
ver las sesiones desde la app, y `Ejercicio.ejercicioId` con buscador en la app. La app
Android no cambia en este plan.
