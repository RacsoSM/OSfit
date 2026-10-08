# Recordatorio de pago en la web del cliente

## Contexto y objetivo

El entrenador ya ve en la app quién está por pagar: en la lista de clientes el nombre se
pinta de rojo cuando faltan menos de 3 días (`PagoCalculator.diasParaProximoPago`, usado en
`ClientesListScreen`). La clienta, en cambio, no tiene forma de enterarse desde su página.

Este spec agrega un **recordatorio de pago opcional** en la web: una tarjeta en **Inicio** que
dice cuántos días le quedan a su periodo de entrenamiento. Se activa **clienta por clienta**
desde la app, en el apartado **Web** de su ficha.

**Decisiones tomadas:**

- **Interruptor por clienta, apagado por defecto.** Solo la ven las que el entrenador elija.
  Hay clientas con las que el cobro se platica en persona y un aviso en su página se leería
  como reclamo; por eso no es global.
- **Sí / No, nada más.** Sin configurar cuántos días antes ni el texto.
- **Ventana de 2 días o menos.** La tarjeta aparece cuando faltan 2, 1 o 0 días, y sigue
  apareciendo si ya venció. Coincide con el umbral del rojo de la lista de la app
  (`diasParaPago < 3`), así que el entrenador y la clienta ven la alarma el mismo día.
- **Verde si sigue vigente, rojo si ya venció.** El día del pago (0 días) cuenta como
  vigente: el periodo vence *ese* día, todavía no se pasó. Confirmado por el entrenador el
  2026-10-08.
- **Ya vencido dice "venció hace X días"**, también los días que pasen después del primero
  (nada de "ayer"). Confirmado por el entrenador el 2026-10-08.
- **Mientras esté vencido, la tarjeta se queda** (en rojo) hasta que el entrenador registre
  el pago o mueva la fecha. Registrar el pago ya actualiza `fechaProximoPago`, así que la
  tarjeta desaparece sola sin pasos extra.
- **Solo informa.** No tiene botones, no enlaza a WhatsApp, no muestra montos ni historial.

**Fuera de alcance:** notificaciones push o por WhatsApp; recordatorio global para todas las
clientas; elegir los días de anticipación; mostrar el monto o los pagos en la web.

## Datos

### Campo nuevo en `clientes/{id}`

```
recordatorioPago: Boolean   // ausente = false
```

- Vive en el documento del cliente, igual que `paletaWeb`: es una preferencia de cómo se ve su
  página, y la web ya escucha ese documento en tiempo real. Prender o apagar el interruptor se
  refleja en la página abierta sin recargar.
- Se lee junto con `fechaProximoPago`, que **ya** está en el mismo documento.

### Reglas de Firestore — sin cambios

- `clientes/{cid}` ya es legible por la propia clienta (`esCliente(cid)`) y solo escribible por
  el entrenador. El nuevo campo lo escribe la app; la web solo lo lee.
- `fechaProximoPago` ya era legible por la clienta (vive en su documento); este spec no expone
  nada nuevo. La subcolección `pagos` (montos, notas) sigue cerrada como hasta hoy.

## App Android (`app/`)

### Modelo

`Cliente.kt` gana:

```kotlin
// Si la web le muestra la tarjeta "Tu periodo vence en X días". Apagado por defecto: el
// entrenador lo prende solo para las clientas a las que quiere recordarles el pago.
val recordatorioPago: Boolean = false
```

### Repositorio

`ClienteRepository` gana `suspend fun actualizarRecordatorioPago(clienteId: String, activo: Boolean)`,
implementado en `FirestoreClienteRepository` con un `update("recordatorioPago", activo)` y en
`FakeClienteRepository` con `copy(recordatorioPago = activo)` — mismo patrón que
`actualizarActivo`.

### Pantalla Web (`WebClienteScreen`)

Las secciones de hoy (`seccionesWeb`) son tarjetas que **navegan** a otra pantalla. Un sí/no no
merece pantalla propia, así que el interruptor va **debajo de la rejilla**, como una fila
aparte:

```
Web
[Rutina y variaciones] [Videos en la web]
[Paleta de colores   ]

┌──────────────────────────────────────────┐
│ 🔔 Recordatorios de pago        [  ○ ]   │
│ Muestra en su inicio cuántos días le      │
│ quedan cuando faltan 2 o menos.           │
└──────────────────────────────────────────┘
```

- Es una `Card` con `Text` + `Switch` de Material 3, leyendo y escribiendo en tiempo real.
- Si la clienta no tiene `fechaProximoPago`, el interruptor se puede prender igual, pero la
  descripción dice "Sin fecha de pago registrada: no se mostrará nada todavía." para que el
  entrenador no crea que está roto.
- `WebClienteScreen` hoy no tiene ViewModel (solo recibe `clienteId`). Se agrega
  `WebClienteViewModel(clienteId, clienteRepository = AppContainer.clienteRepository)` que
  expone `cliente: StateFlow<Cliente?>` vía `observarCliente` y una función
  `cambiarRecordatorioPago(activo)`. Sigue la convención de ViewModels del repo.
- El comentario de cabecera de `WebClienteScreen` dice que todo lo nuevo entra por
  `seccionesWeb`; se ajusta para explicar por qué este interruptor no es una sección
  (no navega a ningún lado).

### Pruebas

Sin tests unitarios nuevos en la app: es un repositorio Firestore y una pantalla Compose, que
el repo no testea (ver `AGENTS.md`). Se verifica en dispositivo.

## Web (`web/`)

### Tipos (`datos.ts`)

`Cliente` gana dos campos **opcionales**, con el comentario de siempre (Firestore omite lo que
nunca se escribió, así que las clientas existentes llegan sin ellos):

```ts
recordatorioPago?: boolean;
fechaProximoPago?: Timestamp | null;   // Timestamp de firebase/firestore
```

### Cálculo puro (`web/src/pago.ts`, nuevo)

```ts
/** Días entre `hoy` y la fecha de pago, ambas AAAA-MM-DD. Negativo = ya venció. */
export function diasParaPago(fechaPago: string, hoy: string): number;

export type RecordatorioPago =
  | { visible: false }
  | { visible: true; dias: number; vencido: boolean };

export function recordatorioPago(cliente: Cliente, hoy: string): RecordatorioPago;
```

- `recordatorioPago` devuelve `{ visible: false }` si `recordatorioPago !== true`, si no hay
  `fechaProximoPago`, o si faltan **más de 2** días.
- `vencido` es `dias < 0`.
- **La fecha del Timestamp se pasa a AAAA-MM-DD en la zona de Mazatlán** (helper nuevo
  `fechaEnMazatlan(date: Date): string` en `fecha.ts`, junto a `hoyEnMazatlan`). No se usa la
  zona del navegador por la misma razón que `hoyEnMazatlan`: una clienta de viaje vería un día
  distinto al que ve el entrenador. La app guarda la fecha a mediodía
  (`AsignarProximoPagoDialog`), así que el cambio de zona nunca la empuja a otro día.
- Es **GEMELO** de `PagoCalculator.diasParaProximoPago` en Kotlin; lleva el comentario `GEMELO`
  como los demás.

### Tarjeta (`web/src/ui/tarjetaRecordatorioPago.ts`, nuevo)

Función pura `tarjetaRecordatorioPago(r: RecordatorioPago): string`. Devuelve `""` si no es
visible.

| Días | Color | Texto |
| --- | --- | --- |
| 2 | verde | Tu periodo de entrenamiento vence en 2 días |
| 1 | verde | Tu periodo de entrenamiento vence en 1 día |
| 0 | verde | Tu periodo de entrenamiento vence hoy |
| -1 | rojo | Tu periodo de entrenamiento venció hace 1 día |
| -N | rojo | Tu periodo de entrenamiento venció hace N días |

- "en 0 días" y "en -3 días" se leen como un error, por eso hoy y vencido tienen su propia
  frase. El singular "1 día" (en las dos direcciones) por lo mismo.
- Colores con las variables que ya existen, `--verde` y `--rojo` (`estilos.css`), mediante
  clases `.recordatorio-pago.vigente` / `.recordatorio-pago.vencido`, para que cada estilo
  (neón, cómic, pixel, sakura, minimalista) pueda ajustarlas si las sobreescribe.
- Sin datos de Firestore que escapar (solo números), pero se arma igual con plantillas fijas.

### Dónde va (`ventanas.ts`)

En `inicio()`, **arriba de todo**, antes de `tarjetaDia`: es lo único de la página con fecha
límite, y abajo del calendario nadie lo vería.

```ts
${tarjetaRecordatorioPago(recordatorioPago(d.cliente, d.hoy))}
${tarjetaDia(...)}
...
```

No hace falta un listener nuevo: `d.cliente` ya llega en vivo desde `observarCliente`.

### Pruebas (vitest)

- `pago.test.ts`:
  - interruptor apagado o ausente → no visible, aunque falte 1 día;
  - sin `fechaProximoPago` → no visible;
  - faltan 3 días → no visible; faltan 2, 1, 0 → visible y no vencido;
  - pasó la fecha → visible y vencido;
  - `diasParaPago` cruzando fin de mes y fin de año.
- `fecha.test.ts` (o dentro de `pago.test.ts`): `fechaEnMazatlan` de un instante a las 00:30
  UTC devuelve el día anterior (Mazatlán va 7 h atrás).
- `tarjetaRecordatorioPago.test.ts`: las cinco frases de la tabla, la clase `vigente` /
  `vencido` según el caso, y `""` cuando no es visible.

## Resumen de archivos

| Archivo | Cambio |
| --- | --- |
| `app/.../data/model/Cliente.kt` | campo `recordatorioPago` |
| `app/.../data/repository/ClienteRepository.kt` + Firestore + Fake | `actualizarRecordatorioPago` |
| `app/.../ui/clientes/WebClienteScreen.kt` | fila con `Switch` + `WebClienteViewModel` |
| `web/src/datos.ts` | `recordatorioPago?`, `fechaProximoPago?` en `Cliente` |
| `web/src/fecha.ts` | `fechaEnMazatlan` |
| `web/src/pago.ts` (+ test) | cálculo puro |
| `web/src/ui/tarjetaRecordatorioPago.ts` (+ test) | la tarjeta |
| `web/src/ventanas.ts` | la tarjeta arriba en `inicio()` |
| `web/src/estilos.css` | clases `.recordatorio-pago` |

Sin cambios en `functions/` ni en `firestore.rules`.
