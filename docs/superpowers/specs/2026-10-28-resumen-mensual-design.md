# Resumen mensual (web de la clienta)

## Contexto y objetivo

La clienta ve su día, su racha y su fuerza de hoy, pero no tiene dónde mirar cómo le fue en un
mes ni comparar un mes con otro. **Resumen mensual** es una ventana nueva en el menú ☰ donde
elige uno de sus meses y ve el resumen de ese mes: asistencia, entrenamiento, calendario,
fuerza al cierre y sus mejores marcas.

Cada mes **se congela al cerrarse**: una función programada guarda el resumen el día 1 y le avisa
con una notificación. El mes en curso se calcula en vivo y se congela cuando termina.

**Decisiones tomadas (entrenador, 2026-10-28):**

- **Solo en la web de la clienta**, ventana nueva en el menú ☰ (grupo `principal`). La app del
  entrenador queda igual.
- **Título "Resumen mensual", sin emoji** en el menú ni en la cabecera.
- **Opción A del cierre:** una Cloud Function programada (`cerrarMes`) guarda cada mes cerrado en
  `clientes/{cid}/resumenesMensuales/{AAAA-MM}`. Un mes guardado **no cambia nunca**, aunque
  después se recalibren los estándares (como el 2026-10-28) o cambie su peso.
- **El mes en curso sale en la lista**, marcado "en curso", calculado en vivo en la web con el
  mismo módulo que usa la función.
- **La lista tiene solo los meses con actividad:** al menos una asistencia o un entrenamiento
  registrado. Los meses vacíos no salen.
- **Navegación:** un `<select>` con sus meses (el más nuevo arriba) **sin escribir** (no es un
  buscador) y botones ← → a los lados para el mes anterior y el siguiente. Cada botón se
  deshabilita en su orilla de la lista.
- **Push al cerrar el mes:** "Tu resumen de octubre ya está listo", que abre la ventana en ese
  mes. Solo a quien tiene prendidas las notificaciones y tuvo actividad ese mes.
- **El diseño elegido** es el tablero "Final · B + A" del canvas de diseños (2026-10-28), en este
  orden:
  1. Cabecera con el selector de mes (← select →).
  2. **Portada** (de la B): tarjeta con el color oscuro de su paleta, el nombre del mes grande y
     tres datos: **% de asistencia**, **kg levantados** (en kg, no en toneladas) y **tiempo en el
     gym**.
  3. **Entrenamiento** (de la A): kg levantados (en kg), series y reps; entrenamientos
     registrados y día favorito; los 5 ejercicios que más hizo.
  4. **Calendario** (de la A): el mes completo con entrenó / justificada / falta, y hoy marcado
     en el mes en curso.
  5. **Fuerza** (de la A): rango general y cada músculo con su rango y una barra; contra el mes
     anterior cuando lo hay.
  6. **Mejores marcas** (de la B): lista con divisiones, la serie a la derecha.

**Fuera de alcance (por ahora):** la app del entrenador, comparar con otras clientas, compartir el
resumen como imagen o video, otros rangos (semana, año) y una llave para apagar el push de este
aviso en particular.

## Datos

### El documento de un mes cerrado

`clientes/{cid}/resumenesMensuales/{AAAA-MM}`. Lo escribe solo el servidor; la clienta lo lee.

```ts
interface ResumenMensual {
  mes: string;              // "2026-10"
  version: 1;               // del cálculo; sube si cambia la forma
  generado: Timestamp;      // cuándo se congeló
  asistencia: {
    entreno: number;        // días con asistio
    justificadas: number;   // justificada y sin asistio (incluye las ganadas en la ruleta)
    faltas: number;         // con registro, sin asistio ni justificada
    porcentaje: number;     // entreno / (entreno + justificadas + faltas), 0–100 entero
    minutos: number;        // suma de duracionMinutos de los días que entrenó
    visitasConMinutos: number; // cuántas de esas tenían cronómetro (para el promedio)
    rachaMasLarga: number;  // dentro del mes, misma regla que rachaMasLarga (hábiles cortan)
    dias: Record<string, "e" | "j" | "f">; // "01".."31": entrenó, justificada, falta
  };
  entrenamiento: {
    sesiones: number;       // entrenamientos registrados en el mes
    kg: number;             // Σ peso × reps, entero; incluye las bajadas de dropset
    series: number;
    reps: number;
    top: { ejercicioId: string; nombre: string; veces: number }[]; // hasta 5
    diaFavorito: { indice: number; nombre: string; veces: number } | null;
  };
  fuerza: {
    general: number;        // promedio de los músculos con nivel (rangoGeneral)
    musculos: Record<string, number>; // grupo → nivel 0–8
  } | null;                 // null sin sexo, sin peso o sin sesiones en la ventana
  marcas: {
    ejercicioId: string; nombre: string; tipo: "peso" | "corporal";
    reps: number; peso: number | null; nivel: number;
  }[];                      // hasta 5
}
```

Los nombres (ejercicios y día favorito) se guardan tal como estaban al cerrar el mes: si después
cambia el nombre en el banco o la rutina, el mes viejo dice lo que decía entonces.

### Lo que lee la web

- `observarResumenesMensuales(cid)` en `datos.ts`: la subcolección completa. Son documentos
  chicos, uno por mes con actividad. Se empieza la primera vez que abre la ventana y sigue
  escuchando, igual que el historial de Estadísticas.
- El mes en curso sale de lo que la página ya escucha: asistencias (todas), sesiones (las 60 de
  siempre, que cubren el mes de sobra), banco, perfil y sede.

## Cálculos

Un módulo puro, `resumenMensual.ts`, con **gemelo** en `functions/src` y `web/src`. El test de
functions importa el de la web y compara resultados, igual que `fuerza.ts`. Entra: el mes
(`AAAA-MM`), el día de corte (último día del mes, u hoy si está en curso), asistencias, sesiones,
banco ya ajustado a la sede (`bancoEnSede`), perfil (sexo, peso, % de grasa, año de nacimiento,
rutina). Sale: un `ResumenMensual` sin `generado`.

- **Asistencia:** solo los registros con `fecha` dentro del mes y hasta el corte.
  - `porcentaje` cuenta los días con registro, que son los que el gimnasio esperaba. Los fines de
    semana sin registro no cuentan, igual que en la racha.
  - El "con justificadas" que mostraba la opción A no va en la portada. Si se quiere después, se
    calcula de los mismos números.
  - `rachaMasLarga` aplica la regla de `rachaMasLarga` (`racha.ts`) solo sobre los días del mes:
    una racha que viene del mes anterior empieza a contar el día 1.
- **Tiempo en el gym:** `minutos` es la suma de lo cronometrado; las visitas sin cronómetro no
  suman. Se muestra "17 h 24 min".
- **Entrenamiento:**
  - `kg`, `series` y `reps` cuentan los ejercicios de peso y corporales y dejan fuera los de tiempo
    y cardio. En los corporales, `kg` no suma (el peso va en 0).
  - Las bajadas de dropset (`caidas`) suman, igual que "kg levantados" en Estadísticas.
  - `top`: los ejercicios que aparecen en más entrenamientos del mes. Si empatan, gana el de más
    series y después el nombre.
  - `diaFavorito`: el `diaRutinaRealizado` más repetido entre los días que entrenó, con el nombre
    del día de su rutina. `null` si no hay.
- **Fuerza al cierre:** `fuerzaPorMusculo` con `hoy` = último día del mes. Es la misma ventana de
  8 semanas, los mismos estándares y la misma lista `pinta` que el mapa de ese día, con el peso,
  el % de grasa y la edad de su perfil al cerrar. `general` es `rangoGeneral`. En el mes en curso
  es exactamente lo que dice Músculos hoy.
- **Mejores marcas:**
  - Por ejercicio, la mejor serie del mes: la de mayor 1RM en los de peso y la de más reps en los
    corporales. Las bajadas no cuentan.
  - Entran solo los ejercicios con estándar.
  - Se ordenan por el `nivel` que da esa serie, que es lo que permite comparar una banca con un
    curl, y quedan las 5 primeras.
  - Se muestran como "100 kg × 4" o "15 reps".
- **Contra el mes anterior** (solo en la web, no se guarda): si el mes anterior de la lista tiene
  `fuerza`, cada músculo muestra cuánto subió o bajó su nivel. Si no, la tarjeta dice "Primer mes
  con datos".

## El cierre: `cerrarMes`

Una función programada nueva en `functions/src/cerrarMes.ts`:
`onSchedule({ schedule: "30 0 1 * *", timeZone: "America/Mazatlan" })`.

1. Por cada cliente, activa o no (una que se fue también tiene su historial): lee sus asistencias,
   sesiones y perfil, su sede y el banco una sola vez.
2. Calcula **todos los meses cerrados con actividad que todavía no tienen documento** y los escribe
   con `create()`. Si el documento ya existe, se salta.
   - **Es idempotente:** correrla dos veces no duplica ni cambia nada.
   - **El respaldo sale de la misma corrida:** la primera vez llena todos los meses pasados y
     después solo el que acaba de cerrar. Así no hace falta un script aparte.
   - Los meses de antes de que existieran las sesiones (septiembre y antes) salen con asistencia
     y sin fuerza ni marcas. La web no muestra esas secciones.
3. Para el mes **que acaba de cerrar** (no los del respaldo), si la clienta tiene
   `notificacionesWeb` y el documento se creó en esta corrida, encola el aviso en `notificaciones`
   como `programarAvisos`:
   - id `resumenMensual_{cid}_{AAAA-MM}`, que evita duplicados;
   - `titulo` "Tu resumen de octubre ya está listo";
   - `texto` con dos datos del mes;
   - `automatico: "resumenMensual"`;
   - `abrir: { ventana: "resumenMensual", mes }`.
4. Una clienta que falla no detiene a las demás. Se registra en el log y la siguiente corrida la
   reintenta, porque su mes sigue sin documento.

**Primera corrida:** después de desplegar, se dispara a mano una vez para el respaldo (correr el
job de Cloud Scheduler). Necesita confirmación del entrenador, como todo lo que escribe en
Firestore. En esa corrida no sale ningún push: el mes que "acaba de cerrar" se define por la fecha
del día 1, y si no es día 1 no hay mes recién cerrado.

## La notificación abre la ventana

Hoy tocar una notificación solo enfoca o abre la página. Para que abra el resumen:

- `enviarNotificacion` copia `abrir` (si el aviso lo trae) a `data` del mensaje. Es un campo
  opcional: los avisos viejos no lo tienen.
- `sw.js`, en `notificationclick`: si hay una ventana abierta, le manda un `postMessage` con
  `abrir` y la enfoca. Si no la hay, abre `/?abrir=resumenMensual&mes=AAAA-MM`.
- `main.ts`:
  - Al arrancar lee esos parámetros, abre la ventana en ese mes y los quita de la dirección con
    `history.replaceState`.
  - Escucha el `postMessage` para hacer lo mismo con la página ya abierta.
  - Hay que verificar que `resolverSesion` no confunda el `?abrir` con un token.
  - La ventana sigue sin ir en la dirección: el parámetro solo dice qué abrir al entrar.

## La ventana

- `ventanas.ts`: `{ id: "resumenMensual", titulo: "Resumen mensual", icono: "", grupo:
  "principal" }` después de Estadísticas. El menú pinta solo el título (`opcion` en
  `ui/menuLateral.ts`), así que no sale ningún emoji; `icono` va vacío porque el tipo lo pide y
  solo se usa en "Muy pronto".
- La ventana recuerda qué mes está viendo mientras la página siga abierta, aunque llegue un
  snapshot. Al entrar abre el mes en curso, o el que diga la notificación.
- **Selector:** un `<select>` nativo con "Octubre 2026 · en curso" y luego los meses cerrados,
  del más nuevo al más viejo, con ← y → a los lados (44 px, `aria-label` "Mes anterior" y
  "Mes siguiente"). Debajo del selector, solo en el mes en curso: "Al 28 de octubre. Se cierra el
  1 de noviembre."
- **Portada:** fondo `var(--primario-oscuro)` con texto claro de la paleta.
  - Encima: "EN CURSO · AL 28" o "CERRADO". Debajo, el mes en grande.
  - Tres datos: "53 %" (asistencia), "59,123 kg" (kg levantados) y "17 h 24 min" (tiempo en el
    gym). Un dato sin base (sin registros, sin sesiones, sin cronómetro) se muestra como "—".
- **Entrenamiento, Calendario, Fuerza, Mejores marcas:**
  - Como en el tablero "Final · B + A".
  - El calendario reusa la cuadrícula de `ui/calendario.ts` con las tres marcas (entrenó lleno,
    justificada con borde, falta en rojo tenue).
  - Las barras de fuerza van de 0 a 8, como el nivel.
  - Una sección sin datos no se pinta: un mes sin sesiones no tiene Entrenamiento, Fuerza ni
    Mejores marcas.
- **Colores:** solo los tokens de cada tema (`var(--primario)`, `var(--superficie)`, etc.). Se
  revisa en los 6 estilos de paleta.
- **Sin meses:** una clienta sin ninguna actividad ve un estado vacío: "Todavía no hay meses que
  resumir".
- **Modo sin datos:** sale de lo que haya en el caché, como Estadísticas.

## Reglas de Firestore

```
match /resumenesMensuales/{doc} {
  // Los escribe solo cerrarMes (Admin SDK). La clienta lee los suyos; el entrenador, todos.
  allow read: if esEntrenador() || esCliente(cid);
  allow write: if false;
}
```

## Pruebas

- `resumenMensual.ts` (web, vitest):
  - asistencia: porcentaje, justificadas de la ruleta, faltas, racha que cruza el día 1, minutos
    solo cronometrados;
  - entrenamiento: kg con bajadas y sin cardio, empates del top, día favorito;
  - fuerza con corte al fin de mes (una sesión de 9 semanas antes no cuenta);
  - marcas ordenadas por nivel;
  - el mes en curso corta en hoy.
- Gemelo en `functions` con prueba de igualdad contra la web.
- `cerrarMes`:
  - meses a generar: solo los cerrados con actividad y sin documento;
  - el push solo para el mes recién cerrado y con `notificacionesWeb`;
  - el id del aviso evita duplicados.
- `ui/resumenMensual.ts`: el HTML de cada sección, que una sección vacía no se pinta, que el
  selector deshabilita las flechas en las orillas y que todo texto de Firestore va escapado.
- `navegacion` y `main`: abrir la ventana en un mes desde `?abrir=` y desde `postMessage`.

## Riesgos

- **Costo de la primera corrida:** lee todas las asistencias y sesiones de cada clienta una vez.
  Con decenas de clientas son unos miles de lecturas, una sola vez. Las corridas siguientes leen lo
  mismo, pero escriben un documento por clienta.
- **El mes en curso y el cerrado pueden diferir un poco:** si el día 1 llega una sesión del día 31
  registrada tarde, el documento ya no la incluye. Se acepta. El entrenador puede pedir que se
  regenere un mes borrando su documento y corriendo la función.
- **Hora de Mazatlán:** el corte del mes usa `hoyEnMazatlan`, igual que los avisos.
