# Ranking de rachas en la web del cliente

## Contexto y objetivo

La ventana **Ranking** del menú lateral existe desde
`2026-09-24-menu-lateral-ventanas-design.md`, pero como "próximamente": se abre
y dice "Muy pronto". Este spec le da contenido: un **top de clientes ordenado
por racha**, en dos apartados:

- **Racha actual**: la racha que cada cliente tiene en este instante.
- **Racha histórica**: la racha más larga que cada cliente ha logrado.

No se inventa ninguna regla de racha nueva. Las dos ya existen en
`RachaCalculator` (Kotlin): `calcularRachaActual` y `calcularRachaMasLarga`.
Solo días hábiles; las justificadas ("soborno") cuentan igual que una
asistencia; hoy, si es hábil y todavía no hay registro, no rompe la racha (día
de gracia).

**Decisiones tomadas en el brainstorming:**

- Vive en la **web del cliente**, no en la app del entrenador.
- **Privacidad:** cada cliente ve el **nombre completo y la racha de todos**.
- **Quién aparece:** en *Racha actual*, solo clientes con `activo == true`; en
  *Racha histórica*, **todos** (activos e inactivos), a modo de salón de la fama.
- Los clientes con racha 0 **sí aparecen**, al fondo.
- **Empates comparten puesto**, igual que `calcularRanking` en Kotlin
  (10, 10, 8 → puestos 1, 1, 3). Dentro de un empate, orden alfabético por
  nombre para que la lista no baile entre aperturas.

**Fuera de alcance:** actualización en vivo mientras la ventana está abierta;
filtros por mes o periodo; ranking en la app Android; caché del resultado.

## Por qué una Cloud Function

Las reglas de Firestore dejan que cada cliente lea **solo** su documento y sus
asistencias, y la racha se calcula en el navegador con las asistencias propias
(`rachaActual` en `web/src/racha.ts`). Un ranking necesita las de todos.

Se descartaron:

- **Abrir las reglas** para que el cliente lea todas las `asistencias`: expone
  el historial completo de los demás (fechas, duraciones, justificadas) solo
  para mostrar un número.
- **Documento precalculado** (`ranking/actual`) mantenido por un trigger más un
  job nocturno: dos funciones nuevas, un cambio de reglas y riesgo de dato
  viejo —si nadie toca asistencias, el día de gracia no se recalcula al cambiar
  la fecha—.

Se elige una **función callable `obtenerRanking`**, el mismo patrón que
`revivirRacha` y `jugarRuleta`: calcula al momento con el Admin SDK y devuelve
solo lo que se muestra. Sin cambios de reglas y siempre correcto con la fecha de
Mazatlán.

## Servidor (`functions/`)

### `functions/src/rachas.ts` (nuevo, puro)

GEMELO de `RachaCalculator` en Kotlin y de `web/src/racha.ts`; lleva el
comentario `GEMELO` como los demás. Separado del `onCall` para probarse en Node.

- `fechasQueCuentan(asistencias)`: fechas con `asistio || justificada`.
- `rachaActual(fechas, hoy)`: con día de gracia.
- `rachaMasLarga(fechas)`: la corrida más larga de días hábiles contados, del
  primer al último registro. 0 si no hay fechas.

Por construcción `rachaMasLarga >= rachaActual` para un mismo conjunto de
fechas.

### `functions/src/ranking.ts` (nuevo)

```ts
interface FilaRanking {
  puesto: number;
  nombre: string;
  racha: number;
  esTuyo: boolean;
}

interface Ranking {
  actual: FilaRanking[];    // solo activo === true
  historica: FilaRanking[]; // todos
}

function armarRanking(
  clientes: { id: string; nombre: string; activo: boolean }[],
  asistencias: { clienteId: string; fecha: string; asistio: boolean; justificada: boolean }[],
  clienteId: string,
  hoy: string
): Ranking;

export const obtenerRanking = onCall({ region: REGION }, async (request) => { ... });
```

- `armarRanking` es pura: agrupa asistencias por `clienteId`, calcula las dos
  rachas por cliente, filtra inactivos solo para `actual`, ordena por racha
  descendente y luego por nombre, y asigna puestos compartidos en empates.
- `obtenerRanking`: `clienteDeLaSesion(request)` → lee `clientes` y
  `asistencias` completas una vez cada una → `armarRanking(..., hoyEnMazatlan())`.
  Campos ausentes o de tipo raro se normalizan como en `revivirRacha`
  (`activo` ausente cuenta como `false`; fecha no string se descarta).
- La respuesta lleva **solo** puesto, nombre, racha y `esTuyo`: ni ids ni
  asistencias viajan al navegador.
- Solo lectura: no escribe nada.
- Se exporta en `functions/src/index.ts`.

**Errores:** sin sesión → `unauthenticated` (lo lanza `clienteDeLaSesion`).
Cualquier otro fallo sale como error de la callable y la web lo muestra como
estado de error.

### Pruebas (vitest)

- `rachas.test.ts`: fines de semana no suman ni rompen; justificadas cuentan;
  día de gracia; `rachaMasLarga` encuentra la corrida más larga aunque no sea
  la última; sin fechas → 0.
- `ranking.test.ts`: orden descendente; empates con puesto compartido y orden
  alfabético; inactivos fuera de `actual` y dentro de `historica`; racha 0
  aparece al fondo; `esTuyo` solo en la fila de quien llama.

## Web (`web/`)

### Llamada

- `web/src/acciones.ts`: `obtenerRanking = httpsCallable<Record<string, never>, Ranking>`.
  Sigue siendo el único lugar con `httpsCallable`; se ajusta su comentario de
  cabecera, que hoy habla de "las cuatro escrituras".
- Los tipos `FilaRanking` y `Ranking` se declaran en la web (proyectos npm
  separados, como `hoyEnMazatlan`).

### Estado y carga (`main.ts`)

- Nuevo estado `ranking: EstadoRanking`:
  `{ estado: "cargando" } | { estado: "listo"; datos: Ranking } | { estado: "error" }`.
- **Cada vez que la ventana activa pasa a ser "ranking"** (no en cada
  repintado), se llama a `obtenerRanking` y se repinta al llegar.
- Si ya había datos de una apertura anterior, se siguen mostrando mientras
  refresca; solo la primera vez se ve "cargando".
- Una respuesta que llega cuando la clienta ya cambió de ventana se guarda pero
  no fuerza nada más que el repintado normal.

### Registro (`ventanas.ts`)

- `DatosCliente` gana `ranking: EstadoRanking`.
- La entrada `ranking` pierde `proximamente` y gana
  `pintar: (d) => tarjetaRanking(d.ranking)`.

### Vista (`web/src/ui/tarjetaRanking.ts`, nuevo, puro)

- Control segmentado arriba: **Racha actual** | **Histórica**, "actual" por
  defecto. La pestaña elegida vive dentro del módulo (como el estado de
  `accionDia`) para que un snapshot de Firestore no la reinicie.
  `conectarRanking(pintar)` cuelga los clics después de cada repintado, igual
  que Inicio con sus acciones.
- Filas: 🥇🥈🥉 para los puestos 1–3 (por puesto, así un empate comparte
  medalla) y el número a partir del 4; nombre con `escapar()`; `🔥 N`.
- La fila propia (`esTuyo`) se resalta con los colores de la paleta
  (`var(--...)`), así respeta la `paletaWeb` de cada clienta.
- Estados:
  - **cargando**: tarjeta esqueleto.
  - **error**: "No pudimos cargar el ranking" + botón **Reintentar**, que
    vuelve a llamar a la función.
  - **lista vacía**: `seccionVacia(...)`.

### Pruebas

- `tarjetaRanking.test.ts`: medallas por puesto; empates; fila resaltada;
  cambio de pestaña; los tres estados; nombres escapados.
- `ventanas.test.ts`: solo "ajustes" queda como `proximamente`; `contenidoDe`
  de ranking ya no dice "Muy pronto".

## Despliegue

- Sin cambios en `firestore.rules` ni `firestore.indexes.json`: el Admin SDK no
  pasa por reglas y leer colecciones enteras no pide índice.
- Orden: `firebase deploy --only functions:obtenerRanking` antes que `hosting`.
  Si la web sube primero, la ventana muestra el estado de error con
  "Reintentar" hasta que la función exista.

## Costo y mejora futura

Cada apertura lee todos los `clientes` y todas las `asistencias`. Para un
gimnasio es poco. Si el historial crece mucho, la siguiente mejora sería cachear
el resultado unos minutos en memoria de la función o en un documento; no entra
en este spec.
