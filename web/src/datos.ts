import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import type { FirestoreError } from "firebase/firestore";
import { db, renovarCredencial } from "./firebase";
import type { PaletaWeb } from "./paleta";

export interface Ejercicio { nombre: string; series: number; repeticiones: string; pesoONota: string; }
/**
 * Envuelve la lista porque Firestore no admite arreglos anidados: un `Ejercicio[][]` no se
 * puede guardar, un arreglo de mapas sí. Espejo de `VariacionDia` en Kotlin.
 */
export interface VariacionDia { ejercicios: Ejercicio[]; }

export interface DiaRutina {
  nombreDia: string;
  ejercicios: Ejercicio[];
  /**
   * Invariante: exactamente una de las dos listas está llena. Vacía o ausente → manda
   * `ejercicios`, que es el estado de todo lo anterior al 2026-09-15 y de toda plantilla
   * compartida. Opcional por la misma razón que los campos de `Asistencia`: Firestore omite
   * los que nunca se escribieron.
   */
  variaciones?: VariacionDia[];
}
export interface Rutina { id: string; nombre: string; dias: DiaRutina[]; }

export interface Cliente {
  nombre: string;
  activo: boolean;
  rutinaAsignada: Rutina | null;
  /**
   * Con valor, sigue una plantilla compartida; vacío o ausente, la rutina es suya. Lo único que
   * decide si `pesoPorEjercicio` se aplica.
   */
  plantillaOrigenId?: string;
  /**
   * Sus pesos y notas propios, por nombre de ejercicio normalizado. Opcional por la razón de
   * siempre: Firestore omite los campos que nunca se escribieron.
   */
  pesoPorEjercicio?: Record<string, string>;
  ultimoDia: number | null;
  ultimoDiaFecha: string | null;
  ultimoDiaEsAncla: boolean;
  /**
   * La paleta que el entrenador le eligió desde la app. Opcional: una clienta a la que nunca
   * se le asignó una no tiene el campo, y entonces la página se queda con el morado de :root.
   */
  paletaWeb?: PaletaWeb;
}

export interface Asistencia {
  fecha: string;
  asistio: boolean;
  justificada: boolean;
  /**
   * La justificó el cliente desde la web. Solo estas gastan su cupo mensual.
   *
   * Opcional a propósito: Firestore omite los campos que nunca se escribieron, así que
   * toda asistencia anterior a esta etapa llega sin él. Ver el commit bf5463c.
   */
  justificadaPorCliente?: boolean;
  /**
   * Opcional por la misma razon que `justificadaPorCliente`: las asistencias anteriores al
   * cronometro (commit 473220e) nunca lo escribieron y llegan sin el campo.
   */
  duracionMinutos?: number | null;
  /**
   * Qué variación del día se hizo. Opcional por la misma razón que los dos de arriba: nada
   * anterior al 2026-09-15 la escribió, así que llega `undefined` y no `null`. Vale 0, que es
   * lo correcto: cuando esas asistencias se guardaron no había variaciones que preservar.
   */
  variacionRealizada?: number | null;
  diaRutinaRealizado?: number | null;
}

/**
 * Adónde van los fallos de los listeners.
 *
 * Ninguno tenía manejador de error, y eso fue un agujero caro: `onSnapshot` se queda callado
 * cuando el servidor le dice que no, así que un listener podía morirse —reglas, red, el caché
 * local roto— sin que la página se enterara. Con el del cliente muerto y los demás vivos, la
 * pantalla decía "No encontramos tus datos" para siempre, que suena a que la clienta no
 * existe cuando lo que pasó fue que la lectura falló.
 *
 * Es un solo punto de reporte y no un parámetro por observador porque quien lo escucha es
 * uno solo: la pantalla, que solo necesita saber que algo falló y qué dijo Firestore.
 */
let reportarFallo: (origen: string, error: FirestoreError) => void = () => {};
let reportarVuelta: (origen: string) => void = () => {};

export function alFallarDatos(escucha: (origen: string, error: FirestoreError) => void): void {
  reportarFallo = escucha;
}

/** El otro lado: un listener que se había caído y volvió. La pantalla borra su error. */
export function alVolverDatos(escucha: (origen: string) => void): void {
  reportarVuelta = escucha;
}

/**
 * Un listener que se vuelve a parar cuando se cae.
 *
 * `onSnapshot` es terminal: al primer error se muere y no vuelve nunca. Eso convierte
 * cualquier tropiezo de medio segundo en una página rota hasta que la clienta recargue, y el
 * tropiezo existe: al arrancar, la sesión recién canjeada tarda en llegarle al cliente de
 * Firestore, así que las primeras lecturas pueden salir sin credencial y volver como
 * `permission-denied`. Visto en un iPhone: el documento del cliente denegado, con su regla de
 * una línea, mientras la sesión estaba perfectamente viva.
 *
 * Reintenta cuatro veces, separándolas cada vez más, y reporta cada caída para que la
 * pantalla pueda decir qué pasó. Si vuelve, avisa que volvió. Después de eso se rinde: si la
 * regla de verdad deniega, reintentar para siempre no la va a convencer.
 */
function escuchar(
  origen: string,
  suscribir: (alLlegar: () => void, alFallar: (e: FirestoreError) => void) => () => void
): () => void {
  let intentos = 0;
  let vivo = true;
  let cancelar = () => {};
  const conectar = (): void => {
    cancelar = suscribir(
      () => reportarVuelta(origen),
      (error) => {
        reportarFallo(origen, error);
        if (!vivo || intentos >= 4) return;
        intentos += 1;
        // Un permiso denegado no se arregla insistiendo con la misma credencial: o está
        // vencida, o nunca llegó. Se renueva antes de volver a colgarse, y solo el primer
        // reintento paga ese viaje —si con credencial nueva sigue denegado, el problema es
        // la regla y no el token.
        const listo =
          error.code === "permission-denied" && intentos === 1
            ? renovarCredencial()
            : Promise.resolve(true);
        listo.then(() => setTimeout(() => vivo && conectar(), 400 * intentos));
      }
    );
  };
  conectar();
  return () => {
    vivo = false;
    cancelar();
  };
}

export function observarCliente(clienteId: string, alCambiar: (c: Cliente | null) => void) {
  return escuchar("cliente", (alLlegar, alFallar) =>
    onSnapshot(
      doc(db, "clientes", clienteId),
      (snap) => {
        alLlegar();
        alCambiar(snap.exists() ? (snap.data() as Cliente) : null);
      },
      alFallar
    )
  );
}

/**
 * La query filtra por clienteId porque las reglas validan documento por documento: sin el
 * filtro, Firestore rechaza la consulta entera en vez de devolver solo lo permitido.
 */
export function observarAsistencias(clienteId: string, alCambiar: (a: Asistencia[]) => void) {
  const consulta = query(collection(db, "asistencias"), where("clienteId", "==", clienteId));
  return escuchar("asistencias", (alLlegar, alFallar) =>
    onSnapshot(
      consulta,
      (snap) => {
        alLlegar();
        alCambiar(snap.docs.map((d) => d.data() as Asistencia));
      },
      alFallar
    )
  );
}

/**
 * Si el cliente ya avisó que hoy no viene. Se observa en vez de guardarse solo en memoria
 * para que el botón siga escondido si recarga la página o la abre en otro dispositivo: el
 * aviso es del día, no de la pestaña.
 */
export function observarAvisoFalta(
  clienteId: string,
  hoy: string,
  alCambiar: (yaAviso: boolean) => void
) {
  return escuchar("avisoFalta", (alLlegar, alFallar) =>
    onSnapshot(
      doc(db, "avisosFalta", `${clienteId}_${hoy}`),
      (snap) => {
        alLlegar();
        alCambiar(snap.exists());
      },
      alFallar
    )
  );
}

/**
 * Lo que ya se le otorgó, no el catálogo: el catálogo es solo del entrenador y ahí vive la
 * imagen original. Por eso `imagenUrl` viaja copiada dentro de cada otorgada, igual que el
 * nombre, y es opcional: lo otorgado antes de que existieran las insignias llega sin campo.
 */
export interface MedallaOtorgada {
  rangoInicio: string;
  medallaId: string;
  nombreMedalla: string;
  encabezadoRango: string;
  fueAjustadaManualmente: boolean;
  imagenUrl?: string | null;
}

export interface LogroPersonalOtorgado {
  id: string;
  rangoInicio: string;
  logroId: string;
  nombreLogro: string;
  mensaje: string;
  encabezadoRango: string;
  orden: number;
  imagenUrl?: string | null;
}

/**
 * El video de resumen de una quincena. Guarda la RUTA en Storage, no la URL: a diferencia
 * de las insignias, el video es personal, así que la URL de descarga se pide al SDK recién
 * al pintar (ver `tarjetaVideos`), y solo la sesión de esa clienta puede pedirla.
 */
export interface VideoResumen {
  rangoInicio: string;
  encabezadoRango: string;
  rutaStorage: string;
  duracionSegundos: number;
}

export function observarVideos(clienteId: string, alCambiar: (v: VideoResumen[]) => void) {
  return escuchar("videos", (alLlegar, alFallar) =>
    onSnapshot(
      collection(db, "clientes", clienteId, "videos"),
      (snap) => {
        alLlegar();
        alCambiar(snap.docs.map((d) => d.data() as VideoResumen));
      },
      alFallar
    )
  );
}

export function observarMedallas(clienteId: string, alCambiar: (m: MedallaOtorgada[]) => void) {
  return escuchar("medallas", (alLlegar, alFallar) =>
    onSnapshot(
      collection(db, "clientes", clienteId, "medallas"),
      (snap) => {
        alLlegar();
        alCambiar(snap.docs.map((d) => d.data() as MedallaOtorgada));
      },
      alFallar
    )
  );
}

export function observarLogrosPersonales(
  clienteId: string,
  alCambiar: (l: LogroPersonalOtorgado[]) => void
) {
  return escuchar("logrosPersonales", (alLlegar, alFallar) =>
    onSnapshot(
      collection(db, "clientes", clienteId, "logrosPersonales"),
      (snap) => {
        alLlegar();
        // El id no se guarda dentro del documento; se rellena al leer, como en la app.
        alCambiar(snap.docs.map((d) => ({ ...(d.data() as LogroPersonalOtorgado), id: d.id })));
      },
      alFallar
    )
  );
}
