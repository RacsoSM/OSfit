# OSfit — App de gestión de clientes de gimnasio (v1)

**Fecha:** 2026-08-18
**Estado:** Aprobado para pasar a plan de implementación

## Propósito

App móvil de uso personal para que un entrenador personalizado gestione a
sus clientes: lista de clientes, calendario de asistencias, rutina de
ejercicios asignada a cada uno (con avance automático según asistencia),
y control de pagos. Uso exclusivo del entrenador y su padre (co-gestor);
los clientes no tienen ningún acceso a la app en esta versión.

## Alcance v1

- Sin acceso de clientes: solo el entrenador y su padre usan la app.
- Sin backend propio: Firebase (Auth + Firestore) como única infraestructura.
- Sin notificaciones push (decisión explícita, puede añadirse después).
- Escala esperada: 1–15 clientes activos.

## Stack técnico

- **Android nativo**: Kotlin + Jetpack Compose, arquitectura MVVM.
- **Firebase Authentication**: autenticación silenciosa en segundo plano
  (sin pantalla de login visible). Las credenciales viven en la
  configuración de la app, no las teclea el usuario. Esto permite
  restringir el acceso a los datos en Firestore sin añadir fricción de
  uso.
- **Cloud Firestore**: base de datos en la nube, con caché local
  automática (funciona sin internet; sincroniza al recuperar conexión).
- Mismo login usado en dos dispositivos (celular del entrenador y de su
  padre) — Firestore sincroniza en tiempo real entre ambos.
- Costo esperado: $0 (uso muy por debajo de los límites del plan
  gratuito Spark de Firebase).

### Multi-dispositivo y conflictos

Ambos dispositivos leen/escriben la misma base de datos. Ediciones sobre
campos o documentos distintos no generan conflicto. Si dos ediciones
tocan exactamente el mismo campo al mismo tiempo (muy improbable dado el
volumen de uso), gana la última escritura que llega al servidor — no se
implementa resolución de conflictos más sofisticada porque no se
justifica para este volumen de uso.

## Modelo de datos (Firestore)

### `clientes/{clienteId}`
- `nombre: string`
- `telefono: string` (opcional)
- `activo: bool`
- `rutinaAsignada`: copia completa de la rutina de este cliente
  (nombre + lista ordenada de días + ejercicios). Es una **copia
  independiente** tomada de una plantilla al momento de asignar — editar
  la rutina de un cliente no afecta a otros clientes ni a la plantilla
  origen.
- `plantillaOrigenId: string` (opcional) — referencia a la plantilla
  usada originalmente, solo para permitir reasignar/comparar.
- `diaActualIndex: number` — índice del día del ciclo de rutina que le
  toca a continuación a este cliente.
- `fechaProximoPago: timestamp` — denormalizado desde el último pago
  registrado, para poder listar clientes atrasados sin consultar el
  historial completo.

### `rutinas/{rutinaId}` (plantillas reutilizables)
- `nombre: string` (ej. "Rutina A - Fuerza")
- `dias`: lista **ordenada** (Día 1 … Día N, no ligada a día de la
  semana) de `{ nombreDia, ejercicios: [{ nombre, series, repeticiones,
  peso/nota }] }`

### `clientes/{clienteId}/pagos/{pagoId}` (subcolección, historial)
- `monto: number`
- `fecha: timestamp`
- `fechaProximoPagoGenerada: timestamp`
- `nota: string` (opcional)
- Registrar un pago nuevo actualiza `fechaProximoPago` en el documento
  del cliente.

### `asistencias/{asistenciaId}` (colección de nivel superior)
- `clienteId: string`
- `fecha: string` (`YYYY-MM-DD`)
- `asistio: bool`
- `diaRutinaRealizado: number` (solo si `asistio = true`) — qué día del
  ciclo se hizo realmente, pudiendo diferir del que tocaba por defecto.
- `nota: string` (opcional)

Colección separada (no subcolección de cada cliente) para que la
pantalla de Calendario pueda consultar **todos los clientes de una
fecha** con una sola query, en vez de recorrer cliente por cliente.

## Lógica de avance de rutina

Al marcar la asistencia de un cliente en una fecha:

1. **Faltó** → se guarda el registro de falta; `diaActualIndex` **no
   cambia**. La próxima vez que asista, se le sigue proponiendo el mismo
   día pendiente.
2. **Asistió** → la app propone por defecto el día indicado por
   `diaActualIndex`, pero el entrenador puede **anular manualmente** y
   elegir cualquier otro día del ciclo si el cliente hizo algo distinto
   a lo que tocaba. El día efectivamente realizado se guarda en
   `diaRutinaRealizado`.
3. `diaActualIndex` avanza a `diaRutinaRealizado + 1`. Al superar el
   último día del ciclo, **vuelve automáticamente al Día 1** (ciclo en
   bucle indefinido, sin intervención manual).

Esta es la pieza de lógica de negocio con más riesgo de bugs sutiles y
lleva pruebas unitarias dedicadas (ver Testing).

## Pantallas y navegación

Navegación inferior de 3 secciones, sin pantalla de login:

- **Clientes** (pantalla principal): lista con indicador de al
  día/atrasado en el pago. Al tocar un cliente → detalle (datos, día de
  rutina actual, historial de pagos, botón "Registrar pago", botón
  "Asignar/cambiar rutina" desde una plantilla).
- **Calendario**: vista de mes; al tocar una fecha (por defecto hoy) se
  lista cada cliente con control Asistió/Faltó. Al marcar "Asistió" se
  confirma o se anula manualmente el día de rutina realizado (ver lógica
  de avance arriba).
- **Rutinas**: lista de plantillas reutilizables; crear, editar o
  eliminar una plantilla (nombre + días ordenados + ejercicios por día).

## Manejo de errores

- Sin conexión: Firestore usa su caché local automáticamente; la app
  sigue funcionando y sincroniza al recuperar internet, sin pantallas de
  error intrusivas.
- Falla la autenticación silenciosa (caso raro): pantalla simple de
  "no se pudo conectar, reintentar" en vez de dejar la app en blanco.
- Validaciones básicas: no permitir guardar un cliente sin nombre, ni un
  pago con monto vacío o negativo.

## Testing

- **Pruebas unitarias** para la función que calcula el siguiente
  `diaActualIndex` a partir de asistencia/falta y del día realizado
  (incluyendo el caso de vuelta a Día 1 tras el último día).
- El resto de la app (pantallas, integración con Firestore) se valida
  manualmente en los dos dispositivos durante el desarrollo; no se
  justifica una suite de pruebas de UI automatizada para una app
  personal de un solo flujo de uso.

## Fuera de alcance (v1)

- Acceso o cuenta para los clientes.
- Notificaciones push de pagos o sesiones.
- Multiplataforma (iOS) — arquitectura Android nativa, sin plan de
  portar por ahora.
