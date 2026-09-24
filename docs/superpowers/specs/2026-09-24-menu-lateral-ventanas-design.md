# Menú lateral y ventanas en la web del cliente

## Contexto y objetivo

Hoy la web de la clienta es un solo scroll, en este orden: saludo, tarjeta del
día (con "Quiero cambiar el día" y "Hoy no podré ir"), racha y promedio,
revivir racha, calendario, medallas, logros personales y videos. Cada sección
nueva que se agregue alarga ese scroll y empuja lo que se consulta a diario
—el día que le toca— entre cosas que se miran de vez en cuando.

Este spec parte la página en **ventanas** a las que se entra desde un **menú
lateral** que se abre con un botón ☰ arriba a la izquierda. La pantalla
principal (Inicio) se queda con lo que es de "hoy", y el historial pasa a sus
propias ventanas.

El objetivo de fondo es que **agregar una ventana nueva sea agregar una entrada
a un registro**, sin tocar el cableado de `pintar()` en `main.ts` y sin volver
a saturar Inicio.

**Alcance:**

- Menú lateral con las ventanas: Inicio, Ranking, Medallas, Logros personales,
  Videos y, separada abajo, Ajustes.
- Medallas, Logros personales y Videos salen de Inicio a su propia ventana.
- Ranking y Ajustes existen como **ventanas "próximamente"**: se pueden abrir y
  muestran un estado vacío. Su contenido es de otro spec.
- El botón "atrás" del teléfono navega entre ventanas.

**Fuera de alcance:** el contenido de Ranking y Ajustes; contadores o puntos de
"nuevo" en el menú; direcciones propias por ventana (`/c/<token>/medallas`);
cambios a Firestore, reglas, Cloud Functions o a la app Android.

## Qué va en cada ventana

| Ventana | Contenido | Notas |
|---|---|---|
| **Inicio** | saludo, tarjeta del día con sus dos acciones, racha y promedio, revivir racha, calendario | Lo que hoy está arriba de medallas, en el mismo orden. |
| **Ranking** | "Muy pronto" | `proximamente` |
| **Medallas** | `tarjetaMedallas` | Sin cambios en la tarjeta. |
| **Logros personales** | `tarjetaLogrosPersonales` | Sin cambios en la tarjeta. |
| **Videos** | `tarjetaVideos` | En su contenedor propio (ver "Videos"). |
| **Ajustes** | "Muy pronto" | `proximamente`, grupo `pie` |

El calendario **se queda en Inicio**: es el contexto directo de la racha y se
consulta casi a diario.

## El menú lateral

**Barra superior.** Un botón ☰ fijo arriba a la izquierda, en el renglón del
saludo. Área táctil mínima de 44×44 px y `aria-label="Abrir menú"`. Vive fuera
de `#contenido`, igual que el saludo, para que los snapshots de Firestore no lo
recreen.

**Panel.** Se desliza desde la izquierda, con un ancho del 80% de la pantalla y
máximo 300 px, sobre un velo oscuro semitransparente. Arriba lleva el nombre de
la clienta y debajo la lista de ventanas generada del registro:

```
🏠 Inicio
🏆 Ranking            Pronto
🏅 Medallas
⭐ Logros personales
🎬 Videos

        (espacio)

⚙️ Ajustes            Pronto
```

- Las ventanas del grupo `pie` se empujan al fondo del panel
  (`margin-top: auto` en un contenedor flex en columna). Ajustes queda
  claramente separado aunque se agreguen más ventanas arriba.
- Las ventanas `proximamente` llevan una etiqueta tenue "Pronto".
- La ventana activa se resalta con `--primario`, así respeta la paleta de cada
  clienta.
- El panel se cierra de cuatro formas: tocando una opción, tocando el velo, con
  el botón ✕ o con "atrás".
- Con `prefers-reduced-motion: reduce`, el panel aparece sin deslizarse.
- Cuando el panel está abierto, el foco va a su primer elemento y la página de
  abajo no hace scroll (`overflow: hidden` en `body`).

**Encabezado de cada ventana.** En Inicio se ve el saludo con su máquina de
escribir. En las demás ventanas el saludo **se oculta, no se destruye**, y en
su lugar aparece el título de la ventana ("Medallas"). Así el saludo no se
vuelve a animar al regresar a Inicio.

## Navegación y "atrás"

La ventana activa **no va en la dirección**. Hay dos razones:

1. El `#` ya está ocupado: `firebase.ts` lee `location.hash` como token de
   sesión heredado (`tokenEscondido`). Un `#medallas` se leería como token.
2. La ruta la usa `resolverSesion` (`rutaActual`) para decidir si hay que
   canjear un token. Meter segmentos nuevos ahí toca la zona de sesión, que ya
   costó varios arreglos.

Por eso la ventana vive en `history.state`, con la URL visible sin cambios:

- **Abrir una ventana desde Inicio:**
  `history.pushState({ ventana: id }, "")`. Scroll al inicio y repintado.
- **Saltar de una ventana a otra** (Medallas → Videos):
  `history.replaceState({ ventana: id }, "")`. "Atrás" siempre regresa a
  Inicio y no recorre todo lo visitado.
- **Abrir el menú:** `history.pushState({ ...estadoActual, menu: true }, "")`.
  "Atrás" cierra el menú en vez de salir de la página, como un drawer nativo
  de Android. Cerrar el menú con ✕ o con el velo hace `history.back()` para
  retirar esa entrada.
- **Elegir una opción del menú:** primero se cierra el menú con
  `history.back()` y se anota la ventana elegida como pendiente. Cuando llega
  ese `popstate`, se navega a la pendiente con las reglas de arriba: push si se
  está en Inicio, replace si se está en otra ventana, y `history.back()` si la
  pendiente es Inicio y se está en otra ventana. Así el historial nunca pasa de
  `[Inicio, ventana]`, y la entrada del menú nunca se queda en el historial
  aunque se abra desde una ventana. Elegir la ventana que ya está activa solo
  cierra el menú.
- **`popstate`:** lee `history.state?.ventana` (si no hay, Inicio) y
  `history.state?.menu`, y repinta.
- **Recarga:** siempre cae en Inicio. Algunos navegadores conservan
  `history.state` al recargar, así que al arrancar se hace
  `history.replaceState(null, "")`. Esto pasa **después** de que la sesión se
  resuelve, para no alterar el diagnóstico `h+/-` de la pantalla del candado.

`navegacion.ts` es **el único módulo que toca `history`**, y lo recibe
inyectado (mismo patrón que `resolverSesion` con el navegador) para poder
probarlo sin DOM.

## Arquitectura del código

### `src/ventanas.ts` (nuevo, puro)

```ts
export interface DatosCliente {
  cliente: Cliente;
  hoy: string;
  asistencias: Asistencia[];
  mesVisible: string;
  yaAviso: boolean;
  medallas: MedallaOtorgada[];
  logros: LogroPersonalOtorgado[];
  tiradaEsteMes: Tirada | null;
  tiradaMesAnterior: Tirada | null;
}

export type IdVentana = "inicio" | "ranking" | "medallas" | "logros" | "videos" | "ajustes";

export interface Ventana {
  id: IdVentana;
  titulo: string;
  icono: string;
  grupo: "principal" | "pie";
  /** Abre con un estado vacío de "Muy pronto". */
  proximamente?: boolean;
  /** Lo que va dentro de `#contenido`. */
  pintar?: (d: DatosCliente) => string;
  /** La ventana vive en un contenedor fuera del repintado (hoy solo videos). */
  contenedorPropio?: "videos";
}

export const VENTANAS: readonly Ventana[];
export function ventana(id: IdVentana): Ventana;
```

- La ventana de Inicio arma lo mismo que hoy arma `pintar()` hasta el
  calendario: `tarjetaDia` con sus acciones, `tarjetasStats`, `tarjetaRevivir`
  y `calendario`.
- Una ventana `proximamente` sin `pintar` usa `seccionVacia` con "Muy pronto".
- **Agregar una ventana** = sumar un id al tipo, una entrada a `VENTANAS` y su
  función de tarjeta. Si necesita datos nuevos, se agrega el campo a
  `DatosCliente` y su listener en `main.ts`.

### `src/navegacion.ts` (nuevo)

Guarda la ventana activa y si el menú está abierto, **fuera de `pintar()`**,
igual que el estado de las acciones. Así un snapshot a destiempo no regresa a
la clienta a Inicio.

```ts
export function iniciarNavegacion(historial: Historial, alCambiar: () => void): void;
export function ventanaActiva(): IdVentana;
export function menuAbierto(): boolean;
export function abrirVentana(id: IdVentana): void;
export function abrirMenu(): void;
export function cerrarMenu(): void;
```

`Historial` es la interfaz mínima de `history` que se usa: `state`,
`pushState`, `replaceState`, `back` y la suscripción a `popstate`.

### `src/ui/menuLateral.ts` (nuevo)

- `barraSuperior(titulo: string | null)`: el ☰ y, fuera de Inicio, el título.
- `panelMenu(ventanas, activa, nombre)`: el HTML del panel y el velo,
  generado del registro.
- `conectarMenu()`: los listeners del ☰, las opciones, el ✕ y el velo, que
  llaman a `navegacion.ts`.

### Cambios en `main.ts`

- `prepararEstructura` arma, en orden:
  `#barra` · saludo · `#contenido` · `#videos` · `#menu` · `#ruleta`.
- `pintar()` reúne `DatosCliente`, toma `ventana(ventanaActiva())` y hace
  `contenido.innerHTML = v.pintar(datos)`. La lista fija de tarjetas
  desaparece de `main.ts`.
- La barra, el saludo (visible u oculto) y el menú se actualizan en cada
  `pintar()`, sin recrear el nodo del saludo.
- `conectarAccionDia`, `conectarAccionFalta` y los botones de mes del
  calendario **solo se conectan en Inicio**, porque en las otras ventanas esos
  elementos no existen.
- `pintarVideos()` y `pintarRuleta()` siguen iguales. La ruleta sigue siendo
  un modal global.
- Los 8 listeners de Firestore siguen vivos siempre, sin importar la ventana
  activa. Al cambiar de ventana los datos ya están y no hay carga.
- `iniciarNavegacion(history, pintar)` se llama después de resolver la sesión.

### Videos

`#videos` sigue fuera de `#contenido`, por la misma razón que hoy: el
`<video>` tiene estado propio (posición, buffer descargado) y `innerHTML` lo
destruye.

- Se muestra solo con la ventana Videos (`hidden` en las demás).
- Al salir de la ventana, se pausa cualquier `<video>` que esté reproduciendo.
- El nodo no se destruye. Al volver, el video sigue donde estaba y no se
  descarga otra vez con dato móvil.
- `resolverVideos` sigue corriendo al arrancar, así que la ventana abre con las
  URLs ya resueltas.

## Esqueleto de carga

El esqueleto de `index.html` gana la barra superior con un ☰ en gris neutro y
sin colores de la paleta, por la misma razón que el resto del esqueleto. El
resto no cambia: Inicio sigue mostrando saludo, día, stats y calendario.

## Pruebas

- **`ventanas.test.ts`**
  - Los ids son únicos. Inicio va primero.
  - Ajustes es la única ventana del grupo `pie` y es la última.
  - Ranking y Ajustes son `proximamente`.
  - Toda ventana que no es `proximamente` tiene `pintar` o `contenedorPropio`.
  - El HTML de Inicio va en orden día → stats → revivir → calendario y **no**
    contiene medallas, logros ni videos.
  - Una ventana `proximamente` pinta "Muy pronto".
- **`navegacion.test.ts`**, con un `Historial` falso:
  - Arranca en Inicio y limpia un `history.state` heredado.
  - Abrir una ventana desde Inicio hace push; saltar entre ventanas hace
    replace.
  - "Atrás" desde una ventana regresa a Inicio.
  - "Atrás" con el menú abierto solo cierra el menú y deja la ventana.
  - Elegir una ventana desde el menú abierto no deja la entrada del menú en el
    historial, tanto si se abrió desde Inicio como desde otra ventana.
  - Desde Medallas, menú → Videos deja el historial en `[Inicio, Videos]`.
  - Desde Medallas, menú → Inicio deja el historial en `[Inicio]`.
  - Elegir la ventana activa solo cierra el menú.
- **`menuLateral.test.ts`**:
  - El panel lista todas las ventanas del registro y marca la activa.
  - Ajustes queda en el bloque de pie.
  - Las ventanas `proximamente` llevan la etiqueta "Pronto".
  - El nombre se escapa.
- **`ordenSecciones.test.ts`** se reescribe. Ya no lee el fuente de `main.ts`
  para el orden: eso pasa a probarse sobre la ventana Inicio en
  `ventanas.test.ts`. Queda solo la comprobación de que `tarjetaVideos` sigue
  fuera del bloque repintado y de que `#videos` va después de `#contenido`.
- **Prueba manual** con `npm run dev` en viewport móvil (Playwright):
  - Abrir y cerrar el menú de las cuatro formas.
  - "Atrás" desde una ventana y desde el menú abierto.
  - Un video reproduciéndose se pausa al salir y conserva su posición al
    volver.
  - Revivir racha y la ruleta siguen funcionando en Inicio.
  - Recargar desde Medallas cae en Inicio.
  - Una asistencia marcada desde la app con la clienta en Medallas no la
    regresa a Inicio.
