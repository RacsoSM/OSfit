# Banco de ejercicios con GIF — plan

**Objetivo:** que cada ejercicio de la rutina muestre su animación en la web de la clienta,
sin tener que editar las rutinas que ya existen. Es la parte del banco (`ejercicios/{id}`)
del punto 7 del backlog que trae los GIF (punto 3).

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
- **Las URLs se resuelven solo para los ejercicios de su rutina**, una vez por carga de
  página, como los videos (`resolverVideos`).
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
- [x] **3. Reglas** — `ejercicios/{id}` en Firestore y `ejercicios/{archivo}` en Storage:
  lee cualquier sesión, escribe el entrenador.
- [x] **4. Web** — `EjercicioBanco` y `observarBanco` (`datos.ts`), `banco.ts` (+ test),
  GIF de 64 px a la izquierda de cada ejercicio de la tarjeta del día y el crédito
  "Animaciones © Gym visual".
- [ ] **5. Desplegar** (lo hace el entrenador, en este orden):

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
  3. La web:
     ```bash
     firebase deploy --only hosting
     ```
  4. Verificar en el teléfono: en Inicio, los ejercicios del día con nombre conocido
     ("Sentadilla", "Press banca", "Jalón al pecho"…) muestran su animación. Un ejercicio
     con nombre que no está en el banco se ve igual que antes. Si alguno no casa y debería,
     se agrega su nombre a `alias` en la semilla y se vuelve a correr la carga.

## Fuera de este plan

Registro, modo guiado (donde el GIF va grande), cálculo de fuerza y estándares, y
`Ejercicio.ejercicioId` con buscador en la app. La app Android no cambia en este plan.
