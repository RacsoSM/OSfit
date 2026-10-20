# Estadísticas: progresión por ejercicio o por músculo (web del cliente)

Backlog 2, punto 22.

## Contexto y objetivo

La clienta registra cada entrenamiento en Registro, pero no tiene dónde ver cómo ha avanzado:
el historial es una lista y Músculos solo dice su rango de hoy. **Estadísticas** es una ventana
nueva en el menú ☰ donde elige un ejercicio o un músculo y ve su progresión en una gráfica,
con sus datos clave.

**Decisiones tomadas (entrenador, 2026-10-20):**

- **Solo en la web de la clienta**, ventana nueva en el menú ☰ (grupo `principal`). La app del
  entrenador queda igual.
- **Todo su historial**, no solo lo reciente. Los entrenamientos nunca se borraron (viven en
  `clientes/{cid}/sesiones`); lo que limita hoy es que la web escucha solo los últimos 60.
- **Las 8 semanas del rango no cambian.** El color de Músculos sigue siendo la fuerza de hoy
  (mejor marca de las últimas 8 semanas, `SEMANAS_VENTANA`). Estadísticas muestra el historial
  completo aparte.
- **Un ejercicio** tiene sus **datos clave** (veces que lo ha hecho, kg levantados en toda su
  historia, reps totales, series, mejor serie, 1RM…) y una **gráfica con dos apartados**:
  - **1RM:** en cada fecha, su 1RM estimado (Epley con tope de 12 reps, el mismo `unoRm` del
    mapa).
  - **Sesiones:** en cada fecha, lo que levantó tal cual: la serie más pesada y sus reps
    ("60 kg × 6").
- **Un músculo** tiene una gráfica de su **nivel de fuerza** en el tiempo con las franjas de
  cada rango, y abajo **sus ejercicios**: tocar uno abre ese ejercicio.

**Fuera de alcance (por ahora):** la app del entrenador, comparar con otras clientas, metas,
volumen semanal por músculo y elegir un rango de fechas.

## Datos

### Historial completo, solo al abrir Estadísticas

`observarHistorial(cid)` en `datos.ts`: todas sus sesiones (`orderBy("creada", "desc")`, sin
`limit`). Se empieza la primera vez que entra a Estadísticas y sigue escuchando mientras la
página esté abierta: después de la primera carga solo cuestan los cambios.

- No reemplaza a `observarSesiones` (60): Inicio, Registro y Músculos abren con lo de siempre y
  no pagan el historial entero en cada apertura. Una clienta que entrena 5 días tiene ~250
  sesiones al año: son 250 lecturas la primera vez que abre Estadísticas en una carga.
- Mientras llega, se pinta con las 60 que ya hay (mejor que una pantalla vacía).
- Con el modo sin datos (`sinDatos.ts`) sale del caché del teléfono: lo que ya se haya bajado.

### Unidades

Las sesiones guardan el peso en kg (Registro convierte las barras al enviar), así que todo va en
kg, como el historial de Registro. En mancuernas el peso es de una mancuerna, igual que como se
anota.

## Cálculos (`web/src/estadisticas.ts`, puros y con tests)

- **Ejercicios hechos:** los que aparecen en sus sesiones, con su tipo del banco, cuántas veces y
  la última fecha; de la más reciente a la más vieja.
- **Músculos con datos:** los grupos que algún ejercicio hecho trabaja como principal (× 1 en
  el banco), igual que el mapa ("solo trabajo directo").
- **Datos clave de un ejercicio** (todas sus series, contando las bajadas de los dropsets):
  - de peso: veces, series, reps totales, **kg levantados** (Σ peso × reps), peso máximo, mejor
    1RM estimado y su serie, cambio del 1RM contra hace 30 días, primera y última vez.
  - corporal: veces, series, reps totales, más reps en una serie, primera y última vez.
  - de tiempo: veces, series, tiempo total, serie más larga, primera y última vez.
- **Puntos de la gráfica de un ejercicio**, uno por fecha (si lo hizo dos veces el mismo día,
  cuenta lo mejor del día):
  - `1rm`: el mejor 1RM estimado del día.
  - `sesiones`: la serie más pesada del día (a igual peso, la de más reps), con su etiqueta
    "60 kg × 6".
  - Corporales: reps máximas en una serie. Tiempo: segundos de la serie más larga. Ninguno de
    los dos tiene 1RM, así que no muestran los dos apartados.
- **Nivel de un músculo en el tiempo:** en cada fecha en que lo trabajó, su nivel con la misma
  cuenta del mapa (`fuerzaPorMusculo`) como si "hoy" fuera esa fecha: mejor marca de las 8
  semanas anteriores. Usa su peso corporal, edad y grasa **de hoy**: no hay registro de su peso
  de antes. Músculos sin estándares (o sin peso o sexo en su ficha) no tienen nivel: sale el
  aviso y solo la lista de ejercicios.

## Pantalla (`web/src/ui/estadisticas.ts`)

Diseño elegido por el entrenador entre cuatro maquetas (2026-10-20): la **A** ("tarjetas
arriba"), con el selector cambiado por la opción **1** de tres.

1. **Selector arriba:** una tarjeta con el GIF y el nombre de lo elegido (o la insignia y el
   nombre del músculo) y "Cambiar ›". Al tocarla sube una hoja con un buscador y sus ejercicios
   agrupados por músculo; cada músculo lleva su rango actual en una pastilla y tocar su nombre
   abre la vista del músculo. Un ejercicio que trabaja dos músculos principales sale en los dos.
   Abre en el ejercicio que hizo más recientemente.
2. **Ejercicio:** el ejercicio **en grande**, igual que la tarjeta activa de Registro (su video HD
   en bucle si lo tiene, si no su GIF, con el crédito de Gym visual; pedido del entrenador,
   2026-10-20); tarjetas con los datos clave en dos columnas; la gráfica con sus dos
   apartados ("1RM | Sesiones") cuando aplica; abajo la lista de sus sesiones (fecha y series),
   de la más nueva a la más vieja, que es además la vista en tabla de la gráfica.
3. **Músculo:** su rango actual (insignia y nombre) y cuánto falta para el siguiente; la gráfica
   de nivel con franjas de rango; la lista de sus ejercicios con veces y última fecha.
4. **Sin datos:** quien no ha registrado nada ve "Registra tu primer entrenamiento para ver tu
   progreso" con un botón a Registro.

### La gráfica (`web/src/ui/grafica.ts`)

SVG dibujado a mano, como el mapa: una sola serie, así que va en `--primario` sin leyenda (el
título del apartado la nombra). Línea de 2 px, puntos de 8 px con anillo del color de la
superficie, rejilla de 1 px recesiva, ejes con números redondos y pocas fechas abajo. El eje X
es la fecha real (los huecos sin entrenar se ven como huecos).

- **Lectura:** arriba de la gráfica un renglón con el valor del punto elegido ("16 oct · 62.5 kg
  × 5"). Por defecto, el último. Tocar o arrastrar sobre la gráfica elige el punto más cercano
  en X y marca una línea vertical; se escribe con `textContent`.
- La gráfica de nivel pinta detrás las franjas de cada rango con su color del mapa
  (`COLORES_RANGO`), tenues, con el nombre del rango a la derecha.
- Con un solo punto se ve el punto y el valor, sin línea.
- Se ve bien en los siete estilos porque usa sus variables (`--primario`, `--texto-tenue`,
  `--superficie-alta`).
