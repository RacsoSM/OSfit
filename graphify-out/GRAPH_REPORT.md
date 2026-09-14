# Graph Report - OSfit  (2026-09-14)

## Corpus Check
- 188 files · ~180,780 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1587 nodes · 3067 edges · 108 communities (78 shown, 30 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 108 edges (avg confidence: 0.85)
- Token cost: 264,847 input · 0 output

## Community Hubs (Navigation)
- Tests de asignación de día
- Repositorios fake en memoria
- Pagos y videos publicados
- Backlog y planes de trabajo
- Récords personales y estadísticas
- Cliente, rutina y pagos
- Logros personales del cliente
- Dependencias npm de web y functions
- Editor de rutinas
- Historial de asistencia y Top
- Datos en vivo de la web
- Asistencias en Firestore
- Encaje de imágenes de insignias
- Tests de racha
- Timeline de escenas del video
- Tests de progreso de rutina
- Acciones del cliente en la web
- Configuración de video y paleta
- Rutas de navegación
- Repositorio de clientes
- Resumen del cliente (ViewModel)
- Tests del generador de video
- Render de frames del resumen
- Tests de paletas
- Plan del video de resumen
- Acceso web y contenedor de app
- Clientes en Firestore
- Cloud Functions de la web
- Codificador de video
- Cambio de día y motivos
- Contrato de asistencias
- Escenas del resumen animado
- Pantalla de medallas
- Cálculo del resumen del cliente
- Detalle del cliente y tipo de resumen
- Paleta web en Firestore
- Tests de falta que rompió la racha
- Diseño de medallas y logros
- Rankings y plan de medallas
- Racha y promedio en la web
- Repositorio de medallas
- Pantalla de calendario
- Tomar asistencia (ViewModel)
- Canción del cliente
- Configuración TypeScript de la web
- Tarjeta de insignias en la web
- Catálogo de medallas automáticas
- Ancla y progreso de rutina
- Generar y compartir el video
- Diseño de la web de clientes
- Fondo con blobs y rendimiento
- Configuración TypeScript de functions
- Calendario de la web
- Periodos quincenales
- Arranque y tema de la app
- Lista de clientes
- Imágenes de medallas
- Enlaces de WhatsApp
- Tests de periodos quincenales
- Autenticación del entrenador
- Tests de cupo de revives
- Tests de geometría de blobs
- Plan de paletas por periodo
- El historial de asistencias es la ley
- Medallas por cliente (pantalla)
- Sincronizador del día web
- Lista de clientes (ViewModel)
- Card de acciones web
- Sandbox y asignar día
- Navegación y pantallas de error
- Componentes de UI compartidos
- Paleta aplicada en la web
- Videos publicados (repositorio)
- Tests del calculador de medallas
- Pagos del cliente (pantalla)
- Tests de tiempo en el gym
- Diseño de configuración de video
- Día denormalizado en la web
- Inicialización de Firebase web
- Geometría de blobs
- Tests de máquina de escribir
- Avisos de falta desde la web
- Cambios de día desde la web
- Storage de insignias
- Cupo de revives
- Falta que rompió la racha
- Asistencia del cliente (ViewModel)
- Renderizador de fondo
- Diálogo de soborno
- Wrapper de Gradle
- Máquina de escribir
- Tests de enlaces de WhatsApp
- Tests de orden de secciones
- Config de video por periodo
- Ruta de asistencia del cliente
- Ruta de estadísticas
- Ruta de logros personales
- Ruta de medallas del cliente
- Ruta de paleta web
- Convención del backlog
- Stack técnico de OSfit
- Endpoint avisarFalta
- Regenerar el grafo de graphify

## God Nodes (most connected - your core abstractions)
1. `EscenarioRutina` - 66 edges
2. `Asistencia` - 58 edges
3. `Cliente` - 46 edges
4. `ClienteDetailViewModel` - 39 edges
5. `ResumenClienteCalculatorTest` - 37 edges
6. `ClienteRepository` - 36 edges
7. `AppContainer` - 34 edges
8. `arrancar()` - 33 edges
9. `AsistenciaRepository` - 31 edges
10. `MedallaCatalogo` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Plain id Field / No @DocumentId Decision` --rationale_for--> `Cliente`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Cliente.kt
- `Fondo SVG pintado (web/index.html)` --semantically_similar_to--> `FondoBlobRenderer`  [INFERRED] [semantically similar]
  web/index.html → docs/superpowers/plans/2026-08-27-resumen-cliente-video-animado.md
- `Disable Asistió Without Rutina Decision` --rationale_for--> `CalendarioViewModel`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/ui/calendario/CalendarioViewModel.kt
- `Plain id Field / No @DocumentId Decision` --rationale_for--> `Rutina`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Rutina.kt
- `Manual fechaProximoPago Entry Decision` --rationale_for--> `Pago`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Pago.kt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pipeline de generación del video de resumen** — docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenclientecalculator, docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenvideogenerator, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_timelineresumen, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_resumenframerenderer, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_fondoblobrenderer, docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenvideoencoder [EXTRACTED 1.00]
- **Flujo de acceso y sesión de la web del cliente** — docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_accesoweb, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_funcion_sesion, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_claim_clienteid, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_cambiardia, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_revivirracha, docs_backlog_revocar_acceso_no_corta_sesion [EXTRACTED 1.00]
- **Contrato del trío denormalizado app ↔ web** — docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_diadenormalizado, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_rutinaprogresscalculator_denormalizar, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_web_src_dia_ts, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_sincronizadordiaweb, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_trio_escrito_a_mano, docs_superpowers_plans_2026_09_11_web_clientes_etapa_2_gemelos_kotlin_typescript [EXTRACTED 1.00]
- **Pipeline de generacion del video de resumen** — docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenclientecalculator, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_escenaresumen, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_timelineresumen, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_resumenframerenderer, docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenvideoencoder, docs_superpowers_specs_2026_08_26_resumen_cliente_video_design_compartirvideo [EXTRACTED 1.00]
- **rangoInicio de la quincena como identificador compartido de periodo** — docs_superpowers_specs_2026_09_04_medallas_logros_design_medallaotorgada, docs_superpowers_plans_2026_09_07_logros_personales_logropersonalotorgado, docs_superpowers_specs_2026_09_09_configuracion_video_por_periodo_design_configvideoperiodo, docs_superpowers_specs_2026_09_10_web_clientes_design_videopublicado [EXTRACTED 1.00]
- **Flujo de acceso y acciones de la web del cliente** — docs_superpowers_specs_2026_09_10_web_clientes_design_accesoweb, docs_superpowers_specs_2026_09_10_web_clientes_design_endpoint_sesion, docs_superpowers_specs_2026_09_10_web_clientes_design_reglas_firestore, docs_superpowers_specs_2026_09_10_web_clientes_design_endpoint_cambiardia, docs_superpowers_specs_2026_09_10_web_clientes_design_endpoint_revivirracha, docs_superpowers_specs_2026_09_10_web_clientes_design_avisarfalta [EXTRACTED 1.00]
- **Bottom Navigation Screens (screensConBarraInferior)** — app_src_main_java_com_osfit_app_ui_navigation_screen_screen, app_src_main_java_com_osfit_app_ui_rutinas_rutinaslistscreen_rutinaslistscreen, app_src_main_java_com_osfit_app_ui_clientes_clienteslistscreen_clienteslistscreen, app_src_main_java_com_osfit_app_ui_calendario_calendarioscreen_calendarioscreen [EXTRACTED 1.00]
- **Unstated Spec Assumptions Filled by Plan** — docs_superpowers_plans_2026_08_18_osfit_implementation_decision_fechaproximopago, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_rutina_nested_no_documentid, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_asistio_sin_rutina, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_remarcar_asistencia, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_pinned_versions [EXTRACTED 1.00]
- **Firestore Repository Pattern via AppContainer** — app_src_main_java_com_osfit_app_data_appcontainer_appcontainer, app_src_main_java_com_osfit_app_data_repository_rutinarepository_rutinarepository, app_src_main_java_com_osfit_app_data_repository_clienterepository_clienterepository, app_src_main_java_com_osfit_app_data_repository_pagorepository_pagorepository, app_src_main_java_com_osfit_app_data_repository_asistenciarepository_asistenciarepository [INFERRED 0.85]

## Communities (108 total, 30 thin omitted)

### Community 0 - "Tests de asignación de día"
Cohesion: 0.05
Nodes (8): AsignarDiaInteraccionTest, AvanceDiaSecuenciaTest, CorregirDiaRealizadoTest, DiaDenormalizadoTest, EscenarioRutina, Asistencia, Cliente, SincronizadorDiaWebTest

### Community 1 - "Repositorios fake en memoria"
Cohesion: 0.07
Nodes (15): FakeAsistenciaRepository, Asistencia, Flow, FakeClienteRepository, Cliente, DiaDenormalizado, Flow, Timestamp (+7 more)

### Community 2 - "Pagos y videos publicados"
Cohesion: 0.06
Nodes (20): Pago, VideoPublicado, Flow, Timestamp, PagoRepository, RetencionVideos, ClienteDetailViewModel, Asistencia (+12 more)

### Community 3 - "Backlog y planes de trabajo"
Cohesion: 0.06
Nodes (47): Notificación FCM al entrenador por aviso de falta, Pantalla "Videos en la web" por clienta, Revocar acceso web no corta la sesión abierta, rutaStorage en blanco bloquea la retención de videos, Rutina y semana incompleta (no repetir pierna), U1. Terminar la verificación de la Etapa 2, OSfit Implementation Plan, AccesoWeb / AccesoWebRepository (link mágico) (+39 more)

### Community 4 - "Récords personales y estadísticas"
Cohesion: 0.07
Nodes (23): RecordPersonal, Flow, Timestamp, RecordPersonalRepository, Asistencia, RachaCalculator, EditarEjercicioFavoritoDialog(), EstadisticasScreen() (+15 more)

### Community 5 - "Cliente, rutina y pagos"
Cohesion: 0.07
Nodes (4): Cliente, PagoCalculator, RangoResumen, ResumenClienteCalculatorTest

### Community 6 - "Logros personales del cliente"
Cohesion: 0.08
Nodes (20): LogroPersonalCatalogo, Flow, LogroPersonalOtorgado, LogroPersonalRepository, ConfirmarLogrosDialog(), LogroPersonalOtorgado, LogroPersonalCard(), LogrosPersonalesClienteScreen() (+12 more)

### Community 7 - "Dependencias npm de web y functions"
Cohesion: 0.05
Nodes (42): firebase, firebase-admin, firebase-functions, author, dependencies, firebase-admin, firebase-functions, description (+34 more)

### Community 8 - "Editor de rutinas"
Cohesion: 0.10
Nodes (16): DiaRutina, Ejercicio, Rutina, Flow, RutinaRepository, EjercicioRow(), RutinaEditorScreen(), StateFlow (+8 more)

### Community 9 - "Historial de asistencia y Top"
Cohesion: 0.11
Nodes (30): ClienteAsistenciaScreen(), DetalleAsistenciaDialog(), formatearDuracion(), HistorialCalendarGrid(), Asistencia, Color, YearMonth, Leyenda() (+22 more)

### Community 10 - "Datos en vivo de la web"
Cohesion: 0.17
Nodes (23): DiaRutina, observarAsistencias(), observarAvisoFalta(), observarCliente(), observarLogrosPersonales(), observarMedallas(), observarVideos(), VideoResumen (+15 more)

### Community 11 - "Asistencias en Firestore"
Cohesion: 0.13
Nodes (14): FirestoreAsistenciaRepository, Asistencia, Flow, TiempoGymCalculator, ClienteAsistenciaRow(), ClienteRutinaRow(), CronometroRow(), formatearDuracion() (+6 more)

### Community 12 - "Encaje de imágenes de insignias"
Cohesion: 0.13
Nodes (9): BoundingBox, Encaje, EncajeInsignia, InsigniaImagenUtil, Bitmap, Context, Uri, EncajeInsigniaTest (+1 more)

### Community 13 - "Tests de racha"
Cohesion: 0.11
Nodes (3): Asistencia, ConteoDiaRutina, RachaCalculatorTest

### Community 14 - "Timeline de escenas del video"
Cohesion: 0.15
Nodes (3): TimelineResumen, TramoEscena, TimelineResumenTest

### Community 16 - "Acciones del cliente en la web"
Cohesion: 0.14
Nodes (17): avisarFalta, revivirRacha, disponiblesEnElMes(), gastadosEnElMes(), MAXIMO_POR_MES, esDiaHabil(), faltaQueRompioLaRacha(), fechasQueCuentan() (+9 more)

### Community 17 - "Configuración de video y paleta"
Cohesion: 0.17
Nodes (13): ConfigVideoRepository, Flow, Paleta, Paletas, StateFlow, ViewModel, PaletaWebClienteScreen(), PaletaWebClienteViewModel (+5 more)

### Community 18 - "Rutas de navegación"
Cohesion: 0.08
Nodes (16): Calendario, ClienteDetail, ClienteEditar, ClientePagos, Clientes, ConfigVideo, LogrosPersonales, Medallas (+8 more)

### Community 19 - "Repositorio de clientes"
Cohesion: 0.11
Nodes (6): DiaDenormalizado, ClienteRepository, Cliente, DiaDenormalizado, Flow, Timestamp

### Community 20 - "Resumen del cliente (ViewModel)"
Cohesion: 0.19
Nodes (9): LogroPersonalOtorgado, ResumenClienteData, Context, StateFlow, ViewModel, YearMonth, PreparacionResumenQuincenal, ResumenClienteViewModel (+1 more)

### Community 21 - "Tests del generador de video"
Cohesion: 0.19
Nodes (3): DesgloseEsfuerzo, PuntoTiempoDiario, ResumenVideoGeneratorTest

### Community 22 - "Render de frames del resumen"
Cohesion: 0.28
Nodes (5): Canvas, PosicionLogro, Resaltado, ResumenFrameRenderer, Paint

### Community 24 - "Plan del video de resumen"
Cohesion: 0.12
Nodes (22): Empates de ranking comparten puesto, Música de fondo resuelta por nombre en runtime, Plan: resumen semanal/mensual en video por cliente, RangoResumen / TipoResumen, ResumenCardRenderer, ResumenClienteCalculator, ResumenVideoGenerator, Crossfade de 600 ms entre escenas (+14 more)

### Community 25 - "Acceso web y contenedor de app"
Cohesion: 0.17
Nodes (9): AppContainer, AccesoWeb, AccesoWebRepository, Flow, AvisoFaltaWebRepository, CambioDiaWebRepository, ResumenStorageRepository, PagoRepository (+1 more)

### Community 26 - "Clientes en Firestore"
Cohesion: 0.12
Nodes (5): FirestoreClienteRepository, Cliente, DiaDenormalizado, Flow, Timestamp

### Community 27 - "Cloud Functions de la web"
Cohesion: 0.28
Nodes (14): avisarFalta, cambiarDia, clienteDeLaSesion(), db(), hoyEnMazatlan(), REGION, AsistenciaParaRacha, esDiaHabil() (+6 more)

### Community 28 - "Codificador de video"
Cohesion: 0.26
Nodes (7): AcumuladorPcm, Context, MuestraCodificada, Pcm, PistaCodificada, ResumenVideoEncoder, ShortArray

### Community 29 - "Cambio de día y motivos"
Cohesion: 0.20
Nodes (15): cambiarDia, horaEnMazatlan(), leTocaFragil(), Motivo, MOTIVOS, motivosPara(), NOMBRES_CON_FRAGIL, normalizar() (+7 more)

### Community 30 - "Contrato de asistencias"
Cohesion: 0.16
Nodes (7): AsistenciaRepository, Asistencia, Flow, calcularSiguienteDiaActualIndex, Upsert Attendance on Re-Mark Decision, Cloud Firestore Offline Cache & Multi-Device Sync, Last-Write-Wins Conflict Resolution

### Community 31 - "Escenas del resumen animado"
Cohesion: 0.12
Nodes (12): Asistencia, Despedida, DiaFavorito, EscenaResumen, Esfuerzo, LogroEnEscena, LogrosPersonales, Medalla (+4 more)

### Community 32 - "Pantalla de medallas"
Cohesion: 0.23
Nodes (9): MedallaCatalogo, ConfirmarMedallaDialog(), EditarMedallaDialog(), MedallaItem(), MedallasScreen(), Context, StateFlow, ViewModel (+1 more)

### Community 33 - "Cálculo del resumen del cliente"
Cohesion: 0.23
Nodes (4): Asistencia, Cliente, YearMonth, ResumenClienteCalculator

### Community 34 - "Detalle del cliente y tipo de resumen"
Cohesion: 0.23
Nodes (15): TipoResumen, MENSUAL, QUINCENAL, SEMANAL, AsignarRutinaDialog(), capitalizar(), ClienteDetailScreen(), ConfirmarActivoDialog() (+7 more)

### Community 35 - "Paleta web en Firestore"
Cohesion: 0.20
Nodes (5): Flow, PaletaWebRepository, aHexWeb(), camposFirestore(), PaletaWebFirestoreTest

### Community 37 - "Diseño de medallas y logros"
Cohesion: 0.16
Nodes (15): MedallaOtorgada (historial denormalizado), MedallaRepository / catálogo de medallas, Denormalización obligatoria de nombre y mensaje, Doc id compuesto <rangoInicio>_<logroId>, LogroPersonalCatalogo, LogroPersonalOtorgado, imagenUrl copiada en la medalla/logro otorgado, MedallaCatalogo (+7 more)

### Community 38 - "Rankings y plan de medallas"
Cohesion: 0.15
Nodes (15): Plan: medallas y logros por cliente, Rankings de Esfuerzo y Constancia, ResumenClienteData (rankings), Sólo el resumen quincenal otorga medalla, Plan: logros personales por cliente, Rename Screen.Logros → Screen.MedallasCliente, calcularRanking, RangoResumen (+7 more)

### Community 39 - "Racha y promedio en la web"
Cohesion: 0.25
Nodes (7): Asistencia, esDiaHabil(), fechasQueCuentan(), promedioMinutos(), rachaActual(), restarUnDia(), tarjetasStats()

### Community 40 - "Repositorio de medallas"
Cohesion: 0.22
Nodes (3): Flow, MedallaOtorgada, MedallaRepository

### Community 41 - "Pantalla de calendario"
Cohesion: 0.29
Nodes (11): calcularColoresPorFecha(), CalendarGrid(), CalendarHeader(), CalendarioScreen(), Color, YearMonth, CalendarioViewModel, StateFlow (+3 more)

### Community 42 - "Tomar asistencia (ViewModel)"
Cohesion: 0.24
Nodes (5): Asistencia, Cliente, StateFlow, ViewModel, TomarAsistenciaViewModel

### Community 43 - "Canción del cliente"
Cohesion: 0.30
Nodes (7): ClienteEditarScreen(), formatoMmSs(), Context, ReproductorCancionPreview(), CancionUtil, Context, Uri

### Community 44 - "Configuración TypeScript de la web"
Cohesion: 0.14
Nodes (13): DOM, ES2022, compilerOptions, lib, module, moduleResolution, noEmit, noUnusedLocals (+5 more)

### Community 45 - "Tarjeta de insignias en la web"
Cohesion: 0.32
Nodes (8): LogroPersonalOtorgado, MedallaOtorgada, escapar(), insignia(), porRangoDescendente(), seccionVacia(), tarjetaLogrosPersonales(), tarjetaMedallas()

### Community 46 - "Catálogo de medallas automáticas"
Cohesion: 0.18
Nodes (7): CategoriaMedallaAutomatica, ASISTENCIA, CONSTANCIA, ESFUERZO, RACHA, TIEMPO, MedallaCalculator

### Community 47 - "Ancla y progreso de rutina"
Cohesion: 0.32
Nodes (6): Ancla, Asistencia, Cliente, DiaDenormalizado, RutinaProgressCalculator, Routine Day Advancement Logic

### Community 48 - "Generar y compartir el video"
Cohesion: 0.26
Nodes (5): CompartirUtil, Context, Context, ResumenGenerado, ResumenVideoGenerator

### Community 49 - "Diseño de la web de clientes"
Cohesion: 0.17
Nodes (12): Retiro de diaPendienteIndex/diaPendienteFecha, Migracion por congelacion en FECHA_CORTE, AccesoWeb (link magico), Endpoint sesion, Reglas de Firestore por claim clienteId, La web no muestra los ejercicios, Web para clientes (solo consulta), Umbral de contraste WCAG 4.5:1 (+4 more)

### Community 50 - "Fondo con blobs y rendimiento"
Cohesion: 0.18
Nodes (11): Build debuggable hace el video 25× más lento, ResumenVideoEncoder, Blur con BlurMaskFilter sobre Canvas de software, FondoBlobRenderer, compartirVideo (WhatsApp + FileProvider), Blur con BlurMaskFilter (no RenderEffect), Resolucion fija 1080x1920, Blobs mas chicos y definidos (+3 more)

### Community 51 - "Configuración TypeScript de functions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict, target (+2 more)

### Community 52 - "Calendario de la web"
Cohesion: 0.25
Nodes (8): pintar(), resolverVideos(), hojaDeMotivosAbierta(), accionHoyNoPuedo(), calendario(), columnaDe(), moverMes(), NOMBRES_MES

### Community 53 - "Periodos quincenales"
Cohesion: 0.29
Nodes (5): PeriodosQuincenales, ConfigVideoViewModel, StateFlow, ViewModel, PeriodoConPaleta

### Community 54 - "Arranque y tema de la app"
Cohesion: 0.33
Nodes (7): MainActivity, OSfitApp(), OSfitTheme(), App Launcher Icon Foreground, Bundle, ComponentActivity, popUpTo Without saveState/restoreState Decision

### Community 55 - "Lista de clientes"
Cohesion: 0.33
Nodes (8): AvatarCliente(), ClienteItem(), ClientesListScreen(), EncabezadoSaludo(), Cliente, NuevoClienteDialog(), rememberFechaActual(), State

### Community 56 - "Imágenes de medallas"
Cohesion: 0.36
Nodes (4): Bitmap, Context, Uri, MedallaImagenUtil

### Community 59 - "Autenticación del entrenador"
Cohesion: 0.28
Nodes (7): AuthManager, AuthState, Error, StateFlow, Loading, Success, Silent Firebase Authentication

### Community 62 - "Plan de paletas por periodo"
Cohesion: 0.31
Nodes (9): Paleta de la web desde la app (backlog #7), aqua_noche como paleta por defecto retrocompatible, ConfigVideoRepository (configVideo/{rangoInicio}), PaletaVideo / PaletasVideo, Plan: configuración de video por periodo, Contraste mínimo 4.5:1 en las 15 paletas, Dos valores por defecto distintos (video aqua, web morado), paletas/Paleta.kt — catálogo único de 15 paletas (+1 more)

### Community 63 - "El historial de asistencias es la ley"
Cohesion: 0.25
Nodes (9): Ancla fechada (diaActualIndex + diaAnclaFecha), diaQueToca (regla de deduccion), El historial de asistencias es la ley, RutinaProgressCalculator, CambioDiaWeb, Dia denormalizado (ultimoDia / ultimoDiaFecha / ultimoDiaEsAncla), Endpoint cambiarDia, Motivos de cambio de dia (+1 more)

### Community 64 - "Medallas por cliente (pantalla)"
Cohesion: 0.32
Nodes (5): MedallaOtorgada, MedallaOtorgada, MedallaCard(), MedallasClienteScreen(), OtorgarMedallaDialog()

### Community 66 - "Lista de clientes (ViewModel)"
Cohesion: 0.32
Nodes (4): ClientesListViewModel, Cliente, StateFlow, ViewModel

### Community 67 - "Card de acciones web"
Cohesion: 0.43
Nodes (6): seccionesWeb(), SeccionWeb, WebClienteScreen(), AccionCard(), Modifier, ImageVector

### Community 68 - "Sandbox y asignar día"
Cohesion: 0.36
Nodes (6): AsignarDiaDialog(), Asistencia, Cliente, SandboxClienteCard(), SandboxScreen(), Dp

### Community 69 - "Navegación y pantallas de error"
Cohesion: 0.36
Nodes (4): Modifier, OSfitNavHost(), OSfitContent(), NavHostController

### Community 70 - "Componentes de UI compartidos"
Cohesion: 0.43
Nodes (6): Modifier, RachaBadge(), Modifier, TextoMaquinaEscribir(), TextStyle, TextUnit

### Community 71 - "Paleta aplicada en la web"
Cohesion: 0.32
Nodes (5): Cliente, aplicarPaleta(), PaletaWeb, OCEANO, VARIABLES

### Community 74 - "Pagos del cliente (pantalla)"
Cohesion: 0.57
Nodes (6): AsignarProximoPagoDialog(), ClientePagosScreen(), Pago, Timestamp, PagoCard(), RegistrarPagoDialog()

### Community 76 - "Diseño de configuración de video"
Cohesion: 0.29
Nodes (7): BlobsGeometria, La paleta viaja por parámetro, nunca como estado de un object, ConfigVideoPeriodo, ConfigVideoRepository, Pantalla Configuracion de video, PaletaVideo, MuestrasPaleta (componente compartido)

### Community 77 - "Día denormalizado en la web"
Cohesion: 0.48
Nodes (4): DiaDenormalizado, interpretar(), esFinDeSemana(), tarjetaDia()

### Community 78 - "Inicialización de Firebase web"
Cohesion: 0.29
Nodes (6): app, auth, db, firebaseConfig, iniciarSesion(), storage

### Community 79 - "Geometría de blobs"
Cohesion: 0.53
Nodes (3): BlobsGeometria, BlobSpec, Punto

### Community 86 - "Asistencia del cliente (ViewModel)"
Cohesion: 0.60
Nodes (4): ClienteAsistenciaViewModel, Asistencia, StateFlow, ViewModel

### Community 87 - "Renderizador de fondo"
Cohesion: 0.70
Nodes (3): Capa, FondoBlobRenderer, Canvas

### Community 88 - "Diálogo de soborno"
Cohesion: 0.83
Nodes (3): FaltaRow(), Asistencia, SobornoDialog()

### Community 89 - "Wrapper de Gradle"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

## Ambiguous Edges - Review These
- `Rutina y semana incompleta (no repetir pierna)` → `RutinaProgressCalculator.denormalizar / interpretar`  [AMBIGUOUS]
  docs/backlog.md · relation: conceptually_related_to

## Knowledge Gaps
- **125 isolated node(s):** `Routine Day Advancement Logic`, `calcularSiguienteDiaActualIndex`, `Cloud Firestore Offline Cache & Multi-Device Sync`, `OSfit Gym Manager Design Spec`, `OSfit Tech Stack` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Rutina y semana incompleta (no repetir pierna)` and `RutinaProgressCalculator.denormalizar / interpretar`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `FakeClienteRepository` connect `Repositorios fake en memoria` to `Tests de asignación de día`, `Repositorio de clientes`, `Cliente, rutina y pagos`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `ClienteRepository` connect `Repositorio de clientes` to `Repositorios fake en memoria`, `Sincronizador del día web`, `Pagos y videos publicados`, `Lista de clientes (ViewModel)`, `Cliente, rutina y pagos`, `Récords personales y estadísticas`, `Editor de rutinas`, `Pantalla de calendario`, `Tomar asistencia (ViewModel)`, `Historial de asistencia y Top`, `Resumen del cliente (ViewModel)`, `Acceso web y contenedor de app`, `Clientes en Firestore`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `AppContainer` connect `Acceso web y contenedor de app` to `Pagos y videos publicados`, `Récords personales y estadísticas`, `Logros personales del cliente`, `Editor de rutinas`, `Historial de asistencia y Top`, `Asistencias en Firestore`, `Configuración de video y paleta`, `Repositorio de clientes`, `Resumen del cliente (ViewModel)`, `Clientes en Firestore`, `Contrato de asistencias`, `Pantalla de medallas`, `Repositorio de medallas`, `Pantalla de calendario`, `Tomar asistencia (ViewModel)`, `Generar y compartir el video`, `Periodos quincenales`, `Sincronizador del día web`, `Lista de clientes (ViewModel)`, `Videos publicados (repositorio)`, `Storage de insignias`, `Asistencia del cliente (ViewModel)`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Are the 32 inferred relationships involving `EscenarioRutina` (e.g. with `.`asignar dia alinea el registro de hoy en Calendario-Rutina`()` and `.`asignar dia con el cronometro ya iniciado hoy tambien avanza manana`()`) actually correct?**
  _`EscenarioRutina` has 32 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `ClienteDetailViewModel` (e.g. with `ClienteDetailScreen()` and `ClienteEditarScreen()`) actually correct?**
  _`ClienteDetailViewModel` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Routine Day Advancement Logic`, `calcularSiguienteDiaActualIndex`, `Cloud Firestore Offline Cache & Multi-Device Sync` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._