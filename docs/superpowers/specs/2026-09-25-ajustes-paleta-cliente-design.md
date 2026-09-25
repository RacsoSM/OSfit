# La clienta elige su paleta desde Ajustes

## Contexto y objetivo

Desde el spec del 2026-09-13, la paleta de la página web es **por clienta** y la
elige el entrenador desde la app: `PaletaWebRepository.guardar()` escribe el
mapa `paletaWeb` —`id` más los cuatro hex ya resueltos— en el documento de la
clienta, y `web/src/paleta.ts` los vuelca como variables CSS.

La clienta no tiene voz en eso. Su página tiene una ventana **Ajustes** que
existe pero está vacía: `ventanas.ts` la marca `proximamente: true` y
`contenidoDe()` le pinta "Muy pronto".

Este spec le da su primer contenido: **la clienta elige su propia paleta, del
mismo catálogo de 15 que ve el entrenador.**

**Alcance:** elegir paleta, y nada más. Ajustes deja de decir "Muy pronto" y
contiene una sola cosa.

**Fuera de alcance:** colores a mano (los presets siguen siendo código, no
datos); que la clienta edite su nombre, su rutina o cualquier otro campo;
preferencias de aviso o notificaciones; una paleta distinta por dispositivo.

### Quién manda

Entrenador y clienta **escriben el mismo campo `paletaWeb`**, y gana el último
que toca. Lo que elige el entrenador queda como valor inicial, y la clienta lo
sobrescribe cuando quiera.

Se descartó guardar la preferencia de la clienta en un campo aparte con
precedencia sobre el del entrenador. Habría permitido un "volver a la que
eligió mi entrenador" y que cada lado conservara lo suyo, a cambio de un campo
nuevo y una regla de precedencia que recordar en los dos lenguajes. Con un solo
dueño del campo no hay nada que migrar y no hay estado que explicar.

Consecuencia visible y aceptada: si el entrenador cambia la paleta desde la app
mientras la clienta tiene la página abierta, el listener se la cambia en vivo.
Es correcto bajo "gana el último", pero es un salto de color en pantalla que
nadie pidió en ese instante.

## El catálogo en TypeScript

El catálogo vive hoy **sólo en Kotlin** (`paletas/Paleta.kt`). La web recibe
los cuatro hex de su paleta y ninguno de los otros. Para que la clienta elija
hacen falta las 15 en algún lugar que el navegador alcance.

Se copia **una vez**, a `functions/src/paletas.ts`, con la forma que la web ya
consume más el nombre para mostrar:

```ts
{ id: "morado_osfit", nombre: "Morado OSfit",
  primario: "#B388FF", primarioOscuro: "#6A1B9A",
  primarioClaro: "#E3D2FF", sobrePrimario: "#2A0064" }
```

Sólo la mitad web: los cuatro colores de video (`blobA`, `blobB`, `blobC`,
`destacado`) no se copian porque la página no los usa. Los hex van en
**mayúsculas**, porque `aHexWeb` en Kotlin es `"#%06X".format(...)` y el test
de paridad compara cadenas exactas.

Ese mismo arreglo sirve a las dos funciones: una lo devuelve tal cual, la otra
busca el id en él.

### Por qué en `functions/` y no en `web/`

La función que escribe necesita los hex de todos modos —el navegador manda un
id, no colores—, así que `functions/` tiene que conocer el catálogo. Ponerlo
**también** en `web/` daría tres copias en vez de dos, a cambio de ahorrar una
llamada al abrir la ventana.

También se descartó mover el catálogo a Firestore como fuente única. Es la
única opción sin duplicación, y es la más grande: migración de datos, regla de
lectura nueva, tocar la app, y los tests de contraste de `PaletasTest.kt`
dejarían de proteger datos que ya no serían código.

### El test de paridad

`functions/src/paletas.test.ts` lee
`app/src/main/java/com/osfit/app/paletas/Paleta.kt` con `fs`, extrae de cada
bloque `Paleta(...)` el `id`, el `nombre` y los cuatro `web*`, convierte
`0xFFB388FF` en `#B388FF` replicando `aHexWeb`, y exige igualdad exacta contra
la lista TS, **incluyendo el orden** — que sale de `Paletas.disponibles`, y de
paso deja el selector de la clienta en el mismo orden que ve el entrenador.

Sin él, dos cambios fallarían en silencio: agregar una paleta 16 en Kotlin que
la clienta nunca vería, y cambiarle los hex a un preset dejando a quienes lo
tenían guardado con los viejos mientras el selector muestra los nuevos.

**Requisito de diseño del test:** si el regex no extrae nada, el test tiene que
**fallar**, no pasar. Comparar dos listas vacías pasa y no protege nada. Así
que primero afirma que encontró 15 paletas, y después compara. Si alguien
reformatea `Paleta.kt` y el regex deja de morder, el test grita en vez de
volverse decorativo.

El repo ya marca los gemelos entre lenguajes con un comentario `GEMELO:`
(`hoyEnMazatlan` en `functions/src/comun.ts`). Las dos copias del catálogo lo
llevan; el test es lo que le pone dientes a esa convención.

### Dos comentarios que hay que corregir

`PaletaWebFirestore.kt` dice hoy que se guardan los hex resueltos *"porque el
catálogo existe únicamente en Kotlin: la web recibe colores y los aplica, sin
una copia de la lista que se pueda desincronizar"*. Este diseño contradice esa
frase. Va reescrito: ahora hay una copia en `functions/`, existe porque la
clienta necesita elegir, y el test de paridad la mantiene honesta.

`web/src/paleta.ts` afirma lo mismo en su cabecera y se corrige igual.

## Las dos funciones

Ambas en `functions/src/paletas.ts`, exportadas desde `index.ts` y declaradas
en `web/src/acciones.ts` como las otras cinco.

| función | entrada | salida |
|---|---|---|
| `obtenerPaletas` | nada | `{ paletas }`, las 15 con nombre y hex |
| `elegirPaleta` | `{ id }` | `{ ok: true, id }` |

`obtenerPaletas` no toca Firestore: el catálogo es una constante del módulo.
Exige `clienteDeLaSesion(request)` aunque los colores no sean secretos, para
que ninguna función del proyecto sea la excepción invocable sin token.

`elegirPaleta` resuelve el cliente con `clienteDeLaSesion`, busca el id en el
catálogo y escribe. Si el id no es una cadena o no está en la lista, lanza
`HttpsError("invalid-argument", "paleta_desconocida")` y no escribe nada.

```ts
await db().collection("clientes").doc(clienteId)
  .set({ paletaWeb: paleta }, { merge: true });
```

`merge` por lo que documenta `PaletaWebRepository`: el documento tiene nombre,
rutina y todo lo demás, y un `set` completo lo borraría.

**Se escriben cinco claves: `id` más los cuatro hex, sin `nombre`.** El
catálogo TS lleva `nombre` porque el selector lo necesita, pero el documento
tiene que quedar con la misma forma que produce `camposFirestore` en Kotlin. Si
`elegirPaleta` metiera `nombre`, el documento diría cosas distintas según quién
eligió último, y no se notaría hasta que algo leyera ese campo esperando que no
estuviera.

La lógica va en una función pura exportada con sus dependencias inyectadas,
como `aplicarTirada` en `jugarRuleta.ts`; el `onCall` queda como cáscara
delgada. Así la validación se prueba sin Firestore ni emulador.

### `firestore.rules` no se toca

`clientes/{cid}` sigue con `allow write: if esEntrenador()`. La clienta
permanece en solo lectura y la única que escribe es la función, con el Admin
SDK, que no pasa por las reglas.

La alternativa era relajar la regla para dejar que la clienta escribiera sólo
el campo `paletaWeb` (`affectedKeys().hasOnly([...])`), ahorrando una función.
Se descartó: mover un límite de seguridad para ahorrar código es el tipo de
cambio que se ve inofensivo el día que se hace. Y `acciones.ts` dice hoy que la
página nunca escribe en Firestore por su cuenta; esa frase vale más intacta.

## La ventana Ajustes

`web/src/ui/tarjetaPaletas.ts`, calcado de `tarjetaRanking.ts`, con el mismo
estado de tres ramas:

```ts
export type EstadoPaletas =
  | { estado: "cargando" }
  | { estado: "listo"; paletas: PaletaOpcion[] }
  | { estado: "error" };
```

`PaletaOpcion` se declara en ese mismo módulo: los seis campos del catálogo
(`id`, `nombre` y los cuatro hex), que es lo que devuelve `obtenerPaletas`.

`tarjetaPaletas(estado, guardada)` devuelve el HTML: esqueleto mientras carga,
un `vacio` con 📡 y "Reintentar" si falló, y la rejilla si está listo. El
segundo argumento es **sólo lo que dice Firestore**
(`d.cliente.paletaWeb?.id ?? null`); la elección optimista no se pasa, porque
vive dentro del módulo (ver abajo). `conectarPaletas(...)` cuelga los listeners
después del `innerHTML`.

En `ventanas.ts`, Ajustes pierde `proximamente` y gana
`pintar: (d) => tarjetaPaletas(d.paletas, d.cliente.paletaWeb?.id ?? null)`. El badge
"Pronto" del menú **desaparece solo**: sale de esa bandera en
`menuLateral.ts:57`, no de una lista aparte.

En `main.ts`, tres cosas en los mismos sitios donde el ranking tiene las suyas:
un campo `paletas: EstadoPaletas` en `DatosCliente`, un `cargarPaletas()` al
entrar a la ventana, y el `conectarPaletas(...)` con su `return` temprano.
Diferencia con el ranking: el catálogo se pide **una sola vez** y se queda —el
ranking cambia cada día, las 15 paletas son una constante compilada.

**Markup:** una rejilla de botones, uno por paleta, cada uno con sus cuatro
colores como muestras y el nombre debajo. `data-paleta="<id>"`, y la elegida
con `.activa` y `aria-pressed="true"`. Los estilos van a `estilos.css`. Los
nombres se escapan con `escapar`, por disciplina, aunque vengan del catálogo
propio y no de Firestore.

### Cuál sale marcada

Sale de `cliente.paletaWeb?.id`, con dos casos resueltos a propósito:

| estado | qué se marca |
|---|---|
| sin campo `paletaWeb` | `morado_osfit` — es literalmente lo que está viendo |
| id que ya no está en el catálogo | ninguna; la página sigue con los hex guardados |

El primero es la clienta a la que nunca se le asignó nada. `morado_osfit` es el
por defecto de la web y está en el catálogo como cualquier otra, así que "lo de
siempre" es una opción elegible y no un estado raro.

El segundo es un preset que se quitó de Kotlin. Es real y poco probable; se
documenta en un comentario en vez de inventarle un rescate.

### La elección optimista vive en el módulo

Como `pestanaElegida` en `tarjetaRanking.ts` y por el motivo que explica su
comentario: `pintar()` rehace `#contenido` en **cada** snapshot de Firestore. Si
el "cuál está elegida" viviera en el DOM, cualquier asistencia marcada desde la
app haría brincar la marca a la vieja mientras la escritura va en camino.

`tarjetaPaletas` prefiere la elección optimista si hay una, y cae en la de
Firestore si no. Cuando el snapshot llega y coinciden, la optimista se limpia.

## Flujo al elegir

1. La UI aplica el color **de inmediato** con `aplicarPaleta` sobre
   `document.documentElement`, usando los hex que ya tiene del catálogo.
2. En paralelo llama `elegirPaleta({ id })`.
3. La función valida el id, resuelve los hex **del lado del servidor** y
   escribe `paletaWeb` con `merge`.
4. `observarCliente` recibe el snapshot y `main.ts:440` ya llama
   `aplicarPaleta(c?.paletaWeb, …)` en cada uno. El círculo se cierra sin una
   línea de sincronización nueva.

Lo importante de ese orden: los hex que se **pintan** salen del catálogo del
cliente, pero los que se **guardan** salen del catálogo del servidor. El
navegador manda un id y nada más, así que no puede inyectar colores arbitrarios
en su documento ni guardar un id inexistente que dejaría la página en morado
para siempre.

Elegir dos veces la misma paleta escribe dos veces. Es inofensivo y no se
evita.

## Errores

### Revertir es aplicar `morado_osfit`

`aplicarPaleta` sólo escribe variables CSS; nunca las quita
(`if (!paleta) return`). Así que una clienta sin campo `paletaWeb` cuya
escritura falle no podría volver al morado de `:root`: los estilos inline ya
están puestos.

La salida sale del propio catálogo: **los cuatro hex de `morado_osfit` son
literalmente los de `:root`** en `estilos.css`, y
`` PaletasTest.`la paleta por defecto de la web conserva los colores actuales de la pagina` ``
lo mantiene así. Entonces revertir es una sola operación en todos los casos
—`aplicarPaleta(anterior)`, donde `anterior` es la paleta guardada o
`morado_osfit` si no había— y **`paleta.ts` no se toca**.

Se descartó darle un `quitarPaleta` que hiciera `removeProperty` de las cuatro:
más código y más superficie para un caso que el catálogo ya cubre.

### El patrón es el de `accionDia.ts`

Un `error: string | null` en el estado del módulo, pintado como
`<p class="aviso-error">` dentro de la tarjeta:

```ts
try {
  await elegirPaleta({ id });
} catch {
  optimista = null;
  aplicarPaleta(anterior, document.documentElement);
  estado.error = "No pudimos guardar tu color. Inténtalo otra vez en un momento.";
  repintar();
}
```

Nada de modales: el color vuelve a lo de antes y aparece una línea bajo la
rejilla. Al siguiente toque, `estado.error` se limpia antes de intentar, como
en las líneas 165, 171 y 203 de `accionDia.ts`.

Ese `catch` cubre sin red, función caída, arranque en frío que expira y
`unauthenticated` por sesión vencida. Los cuatro se ven igual, a propósito: no
hay nada distinto que la clienta pueda hacer, y distinguirlos sólo le daría
vocabulario de errores. **No** intenta renovar credencial por su cuenta:
`renovarCredencial` hoy lo usan los listeners de Firestore ante
`permission-denied`, no las acciones callable, y este spec no cambia ese
reparto.

Si falla `obtenerPaletas`, la otra rama del estado ocupa la tarjeta completa
—📡 y "Reintentar"— como el ranking cuando no carga. Sin catálogo no hay nada
que elegir.

Queda un parpadeo posible: si la escritura falla después de que llegó un
snapshot por otro motivo, el repintado intermedio pudo mostrar la marca vieja
un instante. Es la marca, no el color, y no se complica el diseño por eso.

## Pruebas

`functions/src/paletas.test.ts`, con dependencias inyectadas como
`jugarRuleta.test.ts`:

- elegir una paleta válida escribe **cinco claves exactas**, sin `nombre`
- escribe con `merge: true`, verificado sobre los argumentos del `vi.fn()`
- id desconocido, vacío y no-cadena: lanzan `invalid-argument` y **no llaman al
  escritor**
- `obtenerPaletas` devuelve las 15 con nombre
- paridad con `Paleta.kt`, afirmando primero que extrajo 15

`web/src/ui/tarjetaPaletas.test.ts`, funciones puras sin DOM:

- `cargando` da esqueleto, `error` da "Reintentar", `listo` da 15 botones con
  su `data-paleta`
- la guardada sale con `.activa` y `aria-pressed="true"`, y es la única
- sin campo `paletaWeb` sale marcada `morado_osfit`
- un id fuera del catálogo no marca ninguna y no truena
- la elección optimista le gana a la de Firestore mientras exista

`web/src/ventanas.test.ts`: la aserción de la línea 42 pasa de "`ajustes` es la
única con `proximamente`" a "ya ninguna ventana lo tiene". La de la línea 47
sigue pasando sin tocarla, porque Ajustes ahora tiene `pintar`.

**No se prueban unitariamente**, por convención del repo: `conectarPaletas`, la
cáscara `onCall` y el CSS. Se verifican en el navegador contra el link de
prueba de una clienta: que la rejilla se vea bien, que el color cambie al
instante al tocar, que la marca siga ahí tras recargar, y que un fallo de red
revierta.

Comandos: `cd functions && npm test`, `cd web && npm test`, `./gradlew test`.

## Despliegue

Las dos funciones son nuevas, así que `web/` no puede desplegarse antes que
`functions/`: una página que llame a `obtenerPaletas` contra un backend viejo
deja Ajustes en el estado de error.

Orden: `cd functions && npm run deploy`, después `cd web && npm run build` y
subir. `firestore.rules` no cambia, así que no hay nada que desplegar ahí.

Nada que migrar: los documentos que ya tienen `paletaWeb` escrito por la app
siguen válidos sin tocarlos, porque la forma del campo no cambia.
