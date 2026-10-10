# Mapa de fuerza, registro de ejercicios y entrenamiento guiado (web del cliente)

## Contexto y objetivo

Ya existen los cuatro mapas musculares en `web/public/`:

| Archivo | Vista | Grupos (`data-musculo`) |
|---|---|---|
| `mapa-muscular-frente.svg` | Hombre, frente | pecho, abdomen, hombro, biceps, antebrazo, trapecio, cuadriceps, pantorrilla |
| `mapa-muscular-espalda.svg` | Hombre, espalda | trapecio, hombro, infraespinoso, dorsal, lumbar, triceps, antebrazo, gluteo, isquiotibiales, cuadriceps, pantorrilla |
| `mapa-muscular-frente-mujer.svg` | Mujer, frente | igual que el hombre **sin trapecio** |
| `mapa-muscular-espalda-mujer.svg` | Mujer, espalda | igual que el hombre **sin lumbar** |

Cada músculo es un `path.musculo` con `data-musculo="<grupo>"` e
`id="musculo-<grupo>-<izq|der>"` (el abdomen es un solo `musculo-abdomen`), así que para
pintarlos basta con CSS sobre `data-musculo`.

El objetivo es que **cada músculo se pinte según la fuerza de la clienta en ese músculo**,
con datos que ella misma registra desde la web. Para eso hay tres piezas nuevas:

1. **Músculos**: los mapas de frente y espalda según su sexo, coloreados por nivel.
2. **Registro**: anota los ejercicios que hizo (series, repeticiones y peso).
3. **Entrenar** (desde Inicio): modo guiado a pantalla completa, con su rutina del día, un GIF grande por
   ejercicio y captura de pesos serie por serie.

**Decisiones tomadas (entrenador, 2026-10-10):**

- **El modo guiado usa la rutina que el entrenador le asignó**, en el día que le toca (el
  mismo que ya calcula la tarjeta del día). La app no trae rutinas genéricas.
- **La fuerza se mide contra estándares**: el 1RM estimado entre el peso corporal,
  comparado con una referencia por ejercicio y sexo. No es contra su propio progreso ni por
  volumen.
- **En Registro puede elegir los ejercicios de su rutina y, además, cualquiera del banco**:
  los suyos salen primero y el resto se busca.
- **GIFs: sin preferencia.** Se decide arrancar **sin depender de ellos**: el banco tiene un
  campo opcional `gifRuta` y la UI muestra un marcador mientras falte. La fuente (grabación
  propia o dataset con licencia) se decide al llenar el banco, sin tocar código.

**Fuera de alcance (por ahora):** rutinas genéricas de la app, planes de progresión
automáticos, compartir el mapa en redes y que la clienta edite su rutina.

## Navegación

Esto es de lo fuerte de la app, así que **no va escondido en el menú lateral**: se agrega
una **barra de navegación abajo, fija y visible en toda la web**, tipo WhatsApp.

```
  🏠 Inicio      💪 Músculos      📝 Registro
```

- **Músculos y Registro son ventanas de primer nivel**, al mismo nivel que Inicio: se suman
  `"musculos" | "registro"` a `IdVentana` en `web/src/ventanas.ts`, con un campo nuevo
  `grupo: "barra"` para que salgan en la barra y no en el menú lateral.
- **Entrenar no va en la barra (decidido 2026-10-10).** Se abre **solo desde Inicio**, con un
  botón grande y del color del estilo en la tarjeta del día (`ui/tarjetaDia.ts`), que ya
  sabe qué día toca: "Hoy: Pierna · ▶️ Empezar". Es lo primero que se ve en Inicio. Sin
  rutina asignada, el botón no aparece.
- **El menú lateral (☰) se queda** para lo secundario: Ranking, Medallas, Logros, Videos y
  Ajustes.
- **`navegacion.ts` no cambia de modelo:** cambiar de pestaña en la barra es `abrirVentana`;
  el historial sigue siendo `[Inicio, ventana]`, así que "atrás" regresa a Inicio.
- La barra respeta el área segura de abajo (`env(safe-area-inset-bottom)`) y cada estilo
  (Neón, Pixel, Sakura, etc.) la pinta con su paleta. Se oculta en el modo guiado y mientras
  el menú lateral está abierto.
- **El modo guiado es una capa a pantalla completa, sin barra ni menú.** Tiene su propia
  entrada en el historial, para que "atrás" pregunte "¿Salir del entrenamiento?" en vez de
  perder lo capturado.

## Ventanas nuevas

### Músculos

- Muestra frente y espalda **lado a lado** según `cliente.sexo`. Sin `sexo` no adivina:
  avisa que el entrenador tiene que completar su perfil.
- Cada grupo se pinta con el color de su nivel, 0–5, de la paleta del estilo activo; los
  músculos sin datos van con el gris de `.sin-color`. Abajo hay una leyenda.
- Al tocar un músculo se abre una hoja con su nivel, su mejor marca reciente y los
  ejercicios que lo alimentan.
- El SVG se inserta inline (fetch + `innerHTML` una sola vez, cacheado) para poder ponerle
  clases o `style.fill` a cada `[data-musculo]`.

### Registro

- Historial de sesiones de la más reciente a la más vieja: fecha, ejercicios y series.
  Vacío, invita: "¿Entrenas hoy? Empieza desde Inicio", con un toque que lleva a Inicio.
- **"+ Registrar"**: arriba salen los ejercicios del día y luego los del resto de su rutina;
  abajo, un buscador del banco completo. Por cada ejercicio captura series de
  `{reps, peso}`, prellenadas con lo que hizo la última vez o, si no hay, con `pesoONota` /
  `pesoPorEjercicio`.
- Puede borrar una sesión propia el mismo día que la registró, por si se equivocó.

### Entrenar (modo guiado, se abre desde Inicio)

- Un ejercicio a la vez: el GIF grande arriba, el nombre, "Serie 2 de 4" y debajo los campos
  de peso y reps, prellenados con la última vez y con botones ±.
- Al confirmar una serie corre el temporizador de descanso (`cliente.minutosDescanso`, si
  existe). Se puede saltar o reordenar.
- **Borrador local:** cada serie se guarda en `localStorage` en cuanto se captura. Si se cae
  la señal o cierra la pestaña, al volver se le ofrece retomar. Al terminar se envía todo
  como **una sesión** (`origen: "guiado"`), y el borrador se borra solo cuando la función
  confirma.
- El resumen final muestra los músculos trabajados y, si subió de nivel alguno, lo celebra.

## Datos

### Banco de ejercicios: `ejercicios/{id}` (nueva, de nivel raíz)

```
nombre: String
alias: List<String>            // para ligar por nombre lo que ya existe ("press banca", ...)
tipo: "peso" | "corporal" | "tiempo"
musculos: Map<String, Double>  // grupo del SVG -> 1.0 principal, 0.5 secundario
estandares: {                  // 1RM / peso corporal en los niveles 1..5
  H: [Double x5], M: [Double x5]
}
gifRuta: String?               // ruta en Storage, `ejercicios/<id>.webp`; null = sin GIF
```

Las claves de `musculos` son exactamente los `data-musculo` de los SVG. Lo lee la clienta
y lo escribe el entrenador.

### Cambios en modelos existentes (Kotlin y su gemelo en `web/src/datos.ts`)

- `Cliente.sexo: "H" | "M"?`, que pone el entrenador en la ficha. Sin él no hay mapa
  correcto ni estándares.
- `Ejercicio.ejercicioId: String?`, que liga el ejercicio de la rutina con el banco. El
  editor de rutinas lo ofrece con un buscador. Para lo que ya existe, se resuelve por
  `claveEjercicio(nombre)` contra `nombre` y `alias`; lo que no case cuenta como "sin
  ligar" y no alimenta el mapa.

### Sesiones: `clientes/{cid}/sesiones/{id}` (nueva)

```
fecha: String (AAAA-MM-DD)
creada: Timestamp
origen: "manual" | "guiado"
diaIndex: Int?                 // solo en guiado
ejercicios: [{
  ejercicioId: String,
  nombre: String,              // copia, por si el banco cambia
  series: [{ reps: Int, peso: Double? }]   // peso null en corporales
}]
```

Registro y Entrenar escriben **la misma forma**: el mapa sale de una sola fuente.

### Reglas y escritura

Como con `avisarFalta` y `jugarRuleta`, **la clienta no escribe directo**:

- `firestore.rules`: `sesiones` la leen el entrenador y la clienta y solo escribe el
  entrenador; `ejercicios` la leen ambos y solo escribe el entrenador.
- Nueva función callable **`registrarSesion`** (`functions/src/registrarSesion.ts`):
  valida la sesión (`clienteId` del token, ejercicios que existan en el banco, reps 1–100,
  peso 0–500, como mucho 30 ejercicios y 20 series cada uno) y la guarda con el Admin SDK.
  **`borrarSesion`** permite borrar solo las del mismo día.

## Cálculo de fuerza

Va en un módulo puro y probado, `web/src/fuerza.ts`, con su gemelo en Kotlin
(`domain/FuerzaCalculator.kt`) cuando el entrenador lo vea en la app.

1. **Ventana:** sesiones de las últimas **8 semanas**.
2. **Por serie con peso:** 1RM estimado (Epley) `e1rm = peso × (1 + reps/30)`, con reps
   topadas en 12 (más arriba la fórmula se infla).
3. **Por ejercicio:** la mejor `e1rm` de la ventana, dividida entre `cliente.peso`. Se
   ubica entre los `estandares[sexo]` del ejercicio y da un nivel continuo de 0 a 5.
4. **Corporales:** el nivel sale de las reps máximas contra su propio estándar de reps.
   Los de `tiempo` no alimentan el mapa (por ahora).
5. **Por músculo:** se queda con el **máximo** de `nivelEjercicio × peso del músculo` entre
   los ejercicios que lo trabajan. Se usa máximo y no promedio para que registrar un
   accesorio ligero no baje el nivel.
6. **Sin `cliente.peso`:** se divide entre un peso de referencia por sexo y la hoja avisa
   que es aproximado.
7. **Sin datos:** el músculo no tiene nivel y sale gris. Distinto de nivel 0.

Los estándares de cada ejercicio se llenan a mano al cargar el banco, por ejemplo con
tablas públicas de fuerza por peso corporal (principiante → élite), repartidas en cinco
cortes.

## Lado del entrenador (app Android)

- Ficha de la clienta: el campo **Sexo**, y ver sus sesiones y su mapa (fase 4).
- Editor de rutinas: ligar cada ejercicio con el banco.
- Administración del banco: alta y edición de ejercicios, músculos, estándares y GIF. Para
  el arranque basta con un script de semilla (`functions/` o `docs/`) que cargue un JSON;
  la pantalla en la app puede llegar después.

## Fases

0. **Barra de abajo:** la navegación fija con Inicio, Músculos y Registro (las dos nuevas
   empiezan como "próximamente").
1. **Cimientos:** `Cliente.sexo`, colección `ejercicios` con una semilla de unos 40
   ejercicios básicos, `Ejercicio.ejercicioId` y el emparejado por nombre, reglas.
2. **Músculos:** la ventana con el mapa coloreado
   por `fuerza.ts`. Mientras no haya sesiones se ve gris, así que se puede probar con datos
   falsos.
3. **Registro:** la función `registrarSesion` / `borrarSesion`, la pestaña y el
   historial. Desde aquí el mapa ya se colorea.
4. **Entrenar:** el modo guiado, el botón en la tarjeta del día, el borrador local y el
   resumen final.
5. **Entrenador:** sesiones y mapa en la ficha, y la pantalla del banco.

## Preguntas abiertas

- ¿Quién llena los estándares por ejercicio: el entrenador, o se proponen valores de tablas
  públicas para que él los revise?
- GIFs: ¿grabación propia o dataset con licencia? No bloquea ninguna fase.
- ¿Debe el entrenador ver una alerta cuando una clienta registra un peso muy por encima de
  lo esperado (error de captura o riesgo)?
