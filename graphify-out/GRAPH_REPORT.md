# Graph Report - OSfit  (2026-09-23)

## Corpus Check
- 133 files · ~282,313 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2013 nodes · 3940 edges · 121 communities (72 shown, 49 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 136 edges (avg confidence: 0.85)
- Token cost: 239,692 input · 0 output

## Community Hubs (Navigation)
- Editor de rutinas y variaciones
- Resumen del cliente (ViewModel)
- Render de frames del resumen
- Logros personales del cliente
- Configuración de video y paleta
- Pantalla de medallas
- Detalle del cliente y tipo de resumen
- Repositorios fake en memoria
- Cloud Functions de la web
- Contrato de asistencias
- Dependencias npm de web y functions
- Interfaz de la ruleta (web)
- Pagos y videos publicados
- Sesion y Firebase (web)
- Rutas de navegación
- Récords personales y estadísticas
- Historial de asistencia y Top
- Dia denormalizado y pesos propios (web)
- Datos en vivo de la web
- Docs y conceptos: rutinas, ruleta y reinicio semanal
- Cliente, rutina y pagos
- Cliente, rutina y pagos
- Acciones del cliente en la web
- Repositorio de clientes
- Tests de progreso de rutina
- Backlog y planes de trabajo
- Clientes en Firestore
- Datos en vivo de la web
- Tests del generador de video
- Tests de paletas
- Cambio de día y motivos
- Racha y promedio en la web
- Tests de racha
- Tests de asignación de día
- Cálculo del resumen del cliente
- Ancla y progreso de rutina
- Codificador de video
- Timeline de escenas del video
- Tests de asignación de día
- Animacion de medalla (tests)
- Contenedor de dependencias y repos de la app
- Tomar asistencia (ViewModel)
- Calculadora de variacion del dia (tests)
- Autenticación del entrenador
- Encaje de imágenes de insignias
- Tests de falta que rompió la racha
- Editor de rutinas
- Arranque y tema de la app
- Tests de asignación de día
- Configuración TypeScript de la web
- Lista de clientes (ViewModel)
- Asistencias en Firestore
- Tests de cupo de revives
- Configuración TypeScript de functions
- Sandbox y asignar día
- Fondo con blobs y rendimiento
- Diseño de medallas y logros
- Tests de asignación de día
- Reinicio semanal de rutina (tests)
- Tests de asignación de día
- Plan del video de resumen
- Plan del video de resumen
- Pagos y videos publicados
- Storage de insignias
- Tests de periodos quincenales
- Diseño de medallas y logros
- Acceso web y contenedor de app
- Canción del cliente
- Timeline de escenas del video
- Semana de rutina (tests)
- Card de acciones web
- Descarga atomica de archivos (tests)
- Texto de entradas relativas (tests)
- Plan del video de resumen
- Rankings y plan de medallas
- Acciones del cliente en la web
- Restaurador de archivos locales
- Pagos del cliente (pantalla)
- Tests de asignación de día
- Tests de tiempo en el gym
- El historial de asistencias es la ley
- Paleta aplicada en la web
- Avisos de falta desde la web
- Cambios de día desde la web
- Logro personal por defecto y archivos que faltan
- Tests del calculador de medallas
- Tests de máquina de escribir
- Repositorio de la ruleta y tirada
- Sincronizador del día web
- Cupo de revives
- Falta que rompió la racha
- Servicio de mensajeria push (FCM)
- Diseño de configuración de video
- Semana de rutina
- Calculadora de variacion del dia
- Wrapper de Gradle
- Lista de clientes
- Máquina de escribir
- Tests de enlaces de WhatsApp
- Tests de orden de secciones
- Config de video por periodo
- Repositorio de clientes
- Stack técnico de OSfit
- Repositorios fake en memoria
- Repositorio de clientes
- Clientes en Firestore
- Ancla y progreso de rutina
- Pagos y videos publicados
- Pagos y videos publicados
- Pagos y videos publicados
- Navegación y pantallas de error
- Render de frames del resumen
- Backlog y planes de trabajo
- Backlog y planes de trabajo
- Acceso web y contenedor de app

## God Nodes (most connected - your core abstractions)
1. `EscenarioRutina` - 81 edges
2. `Asistencia` - 60 edges
3. `Cliente` - 55 edges
4. `ClienteDetailViewModel` - 50 edges
5. `ClienteRepository` - 40 edges
6. `ResumenClienteCalculatorTest` - 38 edges
7. `AppContainer` - 36 edges
8. `FakeClienteRepository` - 31 edges
9. `DiaRutina` - 31 edges
10. `AsistenciaRepository` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Manual fechaProximoPago Entry Decision` --rationale_for--> `Pago`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Pago.kt
- `Manual fechaProximoPago Entry Decision` --rationale_for--> `PagoRepository`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/repository/PagoRepository.kt
- `Disable Asistió Without Rutina Decision` --rationale_for--> `CalendarioViewModel`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/ui/calendario/CalendarioViewModel.kt
- `Silent Firebase Authentication` --references--> `AuthManager`  [EXTRACTED]
  docs/superpowers/specs/2026-08-18-osfit-gym-manager-design.md → app/src/main/java/com/osfit/app/auth/AuthManager.kt
- `Disable Asistió Without Rutina Decision` --rationale_for--> `CalendarioScreen()`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/ui/calendario/CalendarioScreen.kt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GEMELO twin implementations kept in sync across Kotlin and TypeScript** — concept_gemelo_pattern, concept_dia_que_toca, concept_variacion_calculator, concept_cupo_revives_calculator, concept_semana_de_rutina [INFERRED 0.85]
- **Web-para-clientes feature family: incremental features built on the client web page spec** — spec_web_clientes, plan_rutinas_web, plan_ruleta_revivir_racha, plan_reinicio_semanal_rutina, spec_rutinas_web [INFERRED 0.85]
- **Palette-from-app feature: shared catalog, plan, and web CSS variable consumption** — concept_paleta_paletas, plan_paleta_web_cliente, web_index_html, docs_backlog_entry7_paleta_web [INFERRED 0.85]
- **Bottom Navigation Screens (screensConBarraInferior)** — app_src_main_java_com_osfit_app_ui_navigation_screen_screen, app_src_main_java_com_osfit_app_ui_rutinas_rutinaslistscreen_rutinaslistscreen, app_src_main_java_com_osfit_app_ui_clientes_clienteslistscreen_clienteslistscreen, app_src_main_java_com_osfit_app_ui_calendario_calendarioscreen_calendarioscreen [EXTRACTED 1.00]
- **Contrato del trío denormalizado app ↔ web** — docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_diadenormalizado, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_rutinaprogresscalculator_denormalizar, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_web_src_dia_ts, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_sincronizadordiaweb, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_trio_escrito_a_mano, docs_superpowers_plans_2026_09_11_web_clientes_etapa_2_gemelos_kotlin_typescript [EXTRACTED 1.00]
- **Flujo de acceso y sesión de la web del cliente** — docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_accesoweb, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_funcion_sesion, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_claim_clienteid, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_cambiardia, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_revivirracha [EXTRACTED 1.00]
- **rangoInicio de la quincena como identificador compartido de periodo** — docs_superpowers_specs_2026_09_04_medallas_logros_design_medallaotorgada, docs_superpowers_plans_2026_09_07_logros_personales_logropersonalotorgado, docs_superpowers_specs_2026_09_09_configuracion_video_por_periodo_design_configvideoperiodo [EXTRACTED 1.00]
- **Pipeline de generacion del video de resumen** — docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenclientecalculator, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_escenaresumen, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_timelineresumen, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_resumenframerenderer, docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenvideoencoder, docs_superpowers_specs_2026_08_26_resumen_cliente_video_design_compartirvideo [EXTRACTED 1.00]
- **Unstated Spec Assumptions Filled by Plan** — docs_superpowers_plans_2026_08_18_osfit_implementation_decision_fechaproximopago, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_rutina_nested_no_documentid, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_asistio_sin_rutina, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_remarcar_asistencia, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_pinned_versions [EXTRACTED 1.00]
- **Firestore Repository Pattern via AppContainer** — app_src_main_java_com_osfit_app_data_appcontainer_appcontainer, app_src_main_java_com_osfit_app_data_repository_rutinarepository_rutinarepository, app_src_main_java_com_osfit_app_data_repository_clienterepository_clienterepository, app_src_main_java_com_osfit_app_data_repository_pagorepository_pagorepository, app_src_main_java_com_osfit_app_data_repository_asistenciarepository_asistenciarepository [INFERRED 0.85]

## Communities (121 total, 49 thin omitted)

### Community 0 - "Editor de rutinas y variaciones"
Cohesion: 0.05
Nodes (40): DiaRutina, Ejercicio, VariacionDia, conVariacionNueva(), ejerciciosDe(), etiquetaVariacion(), DiaRutina, sinLaUltimaVariacion() (+32 more)

### Community 1 - "Resumen del cliente (ViewModel)"
Cohesion: 0.05
Nodes (27): VideoPublicado, ResumenStorageRepository, Flow, VideoPublicadoRepository, ResumenClienteData, RetencionVideos, Context, StateFlow (+19 more)

### Community 2 - "Render de frames del resumen"
Cohesion: 0.08
Nodes (25): InsigniaImagenUtil, Bitmap, Context, Uri, Asistencia, Despedida, DiaFavorito, EscenaResumen (+17 more)

### Community 3 - "Logros personales del cliente"
Cohesion: 0.05
Nodes (26): LogroPersonalCatalogo, LogroPersonalOtorgado, Flow, LogroPersonalOtorgado, LogroPersonalRepository, ArchivoEsperado, ArchivosQueFaltan, Cliente (+18 more)

### Community 4 - "Configuración de video y paleta"
Cohesion: 0.05
Nodes (27): ConfigVideoRepository, Flow, Flow, PaletaWebRepository, PeriodosQuincenales, Paleta, Paletas, aHexWeb() (+19 more)

### Community 5 - "Pantalla de medallas"
Cohesion: 0.06
Nodes (28): CategoriaMedallaAutomatica, ASISTENCIA, CONSTANCIA, ESFUERZO, RACHA, TIEMPO, MedallaCatalogo, MedallaOtorgada (+20 more)

### Community 6 - "Detalle del cliente y tipo de resumen"
Cohesion: 0.06
Nodes (42): TipoResumen, MENSUAL, QUINCENAL, SEMANAL, ClienteAsistenciaScreen(), DetalleAsistenciaDialog(), formatearDuracion(), HistorialCalendarGrid() (+34 more)

### Community 7 - "Repositorios fake en memoria"
Cohesion: 0.07
Nodes (13): FakeAsistenciaRepository, Asistencia, Flow, FakeClienteRepository, Cliente, Flow, Rutina, Timestamp (+5 more)

### Community 8 - "Cloud Functions de la web"
Cohesion: 0.10
Nodes (36): avisarFalta, notificarAlEntrenador(), cambiarDia, clienteDeLaSesion(), db(), hoyEnMazatlan(), REGION, contarEntrada() (+28 more)

### Community 9 - "Contrato de asistencias"
Cohesion: 0.07
Nodes (22): AsistenciaRepository, Asistencia, Flow, FirestoreAsistenciaRepository, Asistencia, Flow, calcularSiguienteDiaActualIndex, calcularColoresPorFecha() (+14 more)

### Community 10 - "Dependencias npm de web y functions"
Cohesion: 0.04
Nodes (44): firebase, firebase-admin, firebase-functions, author, dependencies, firebase-admin, firebase-functions, description (+36 more)

### Community 11 - "Interfaz de la ruleta (web)"
Cohesion: 0.11
Nodes (36): pintarRuleta(), abrirRuleta(), acuse(), cerrarRuleta(), conectarRuleta(), elegirColor(), Estado, Fase (+28 more)

### Community 12 - "Pagos y videos publicados"
Cohesion: 0.08
Nodes (13): totalVariaciones(), ClienteDetailViewModel, Asistencia, Cliente, Flow, MedallaCatalogo, Rutina, StateFlow (+5 more)

### Community 13 - "Sesion y Firebase (web)"
Cohesion: 0.10
Nodes (26): app, auth, canjear(), credencialLista(), db, esFalloDeRed(), firebaseConfig, functions (+18 more)

### Community 14 - "Rutas de navegación"
Cohesion: 0.06
Nodes (22): Calendario, ClienteAsistencia, ClienteDetail, ClienteEditar, ClientePagos, Clientes, ConfigVideo, Estadisticas (+14 more)

### Community 15 - "Récords personales y estadísticas"
Cohesion: 0.10
Nodes (21): RecordPersonal, Flow, Timestamp, RecordPersonalRepository, EditarEjercicioFavoritoDialog(), EstadisticasScreen(), Modifier, Timestamp (+13 more)

### Community 16 - "Historial de asistencia y Top"
Cohesion: 0.11
Nodes (22): Asistencia, RachaCalculator, BrilloPuesto(), CardGigante(), CategoriaTop, ASISTENCIA, RACHA, ColumnaPodio() (+14 more)

### Community 17 - "Dia denormalizado y pesos propios (web)"
Cohesion: 0.13
Nodes (18): Cliente, DiaRutina, Ejercicio, DESCANSO, DiaDenormalizado, DiaQueToca, domingoAnterior(), interpretar() (+10 more)

### Community 18 - "Datos en vivo de la web"
Cohesion: 0.15
Nodes (20): LogroPersonalOtorgado, MedallaOtorgada, VideoResumen, mostrarSinConexion(), actualizarNombre(), conectarSaludo(), saludo(), escapar() (+12 more)

### Community 19 - "Docs y conceptos: rutinas, ruleta y reinicio semanal"
Cohesion: 0.10
Nodes (30): CupoRevivesCalculator / cupo.ts twin, Denormalización del día (ultimoDia/ultimoDiaFecha/ultimoDiaEsAncla), DiaQueToca sealed type (day-of-cycle result), GEMELO pattern: duplicated Kotlin/TypeScript pure logic kept in sync, jugarRuleta Cloud Function, Paleta / Paletas catalog (shared video+web colors), RutinaProgressCalculator (day-of-cycle domain logic), SemanaDeRutina week arithmetic helper (+22 more)

### Community 21 - "Cliente, rutina y pagos"
Cohesion: 0.12
Nodes (5): Cliente, Rutina, PagoCalculator, RangoResumen, Plain id Field / No @DocumentId Decision

### Community 22 - "Acciones del cliente en la web"
Cohesion: 0.13
Nodes (16): avisarFalta, jugarRuleta, revivirRacha, disponiblesEnElMes(), gastadosEnElMes(), MAXIMO_POR_MES, castigoDelMes(), mesAnterior() (+8 more)

### Community 23 - "Repositorio de clientes"
Cohesion: 0.09
Nodes (7): ClienteRepository, Cliente, Flow, Rutina, Timestamp, AsignarDiaManual, SincronizadorDiaWeb

### Community 25 - "Backlog y planes de trabajo"
Cohesion: 0.09
Nodes (25): AccesoWeb / AccesoWebRepository (link mágico), Custom claim clienteId, DiaDenormalizado (el trío dia/fecha/esAncla), Cloud Function sesion (canje de token), Plan: Web para clientes — Etapa 1 (acceso y lectura), RutinaProgressCalculator.denormalizar / interpretar, SincronizadorDiaWeb, web/src/dia.ts (gemelo TS del intérprete) (+17 more)

### Community 26 - "Clientes en Firestore"
Cohesion: 0.11
Nodes (5): FirestoreClienteRepository, Cliente, Flow, Rutina, Timestamp

### Community 27 - "Datos en vivo de la web"
Cohesion: 0.17
Nodes (22): alFallarDatos(), alVolverDatos(), escuchar(), observarAsistencias(), observarAvisoFalta(), observarCliente(), observarLogrosPersonales(), observarMedallas() (+14 more)

### Community 30 - "Cambio de día y motivos"
Cohesion: 0.16
Nodes (18): cambiarDia, horaEnMazatlan(), hoyEnMazatlan(), leTocaFragil(), Motivo, MOTIVOS, motivosPara(), NOMBRES_CON_FRAGIL (+10 more)

### Community 31 - "Racha y promedio en la web"
Cohesion: 0.16
Nodes (11): Asistencia, esDiaHabil(), fechasQueCuentan(), promedioMinutos(), rachaActual(), restarUnDia(), calendario(), columnaDe() (+3 more)

### Community 34 - "Cálculo del resumen del cliente"
Cohesion: 0.19
Nodes (6): Asistencia, Cliente, YearMonth, PuntoTiempoDiario, RankingResultado, ResumenClienteCalculator

### Community 35 - "Ancla y progreso de rutina"
Cohesion: 0.19
Nodes (12): Ancla, Asistencia, Cliente, DiaQueToca, RutinaProgressCalculator, AvatarCliente(), ClienteItem(), ClientesListScreen() (+4 more)

### Community 36 - "Codificador de video"
Cohesion: 0.26
Nodes (7): AcumuladorPcm, Context, MuestraCodificada, Pcm, PistaCodificada, ResumenVideoEncoder, ShortArray

### Community 40 - "Contenedor de dependencias y repos de la app"
Cohesion: 0.23
Nodes (12): AppContainer, SincronizadorDiaWeb, CancionStorageRepository, AvisoFaltaWebRepository, CambioDiaWebRepository, ConfigVideoRepository, LogroPersonalRepository, MedallaRepository (+4 more)

### Community 41 - "Tomar asistencia (ViewModel)"
Cohesion: 0.24
Nodes (6): Asistencia, Cliente, DiaQueToca, StateFlow, ViewModel, TomarAsistenciaViewModel

### Community 43 - "Autenticación del entrenador"
Cohesion: 0.18
Nodes (10): AuthManager, AuthState, Error, StateFlow, Loading, Success, OSfitApp(), OSfitContent() (+2 more)

### Community 44 - "Encaje de imágenes de insignias"
Cohesion: 0.16
Nodes (5): BoundingBox, Encaje, EncajeInsignia, EncajeInsigniaTest, IntArray

### Community 46 - "Editor de rutinas"
Cohesion: 0.23
Nodes (6): Flow, Rutina, RutinaRepository, StateFlow, ViewModel, RutinasViewModel

### Community 47 - "Arranque y tema de la app"
Cohesion: 0.19
Nodes (7): MainActivity, Context, Notificaciones, OSfitTheme(), App Launcher Icon Foreground, Bundle, ComponentActivity

### Community 49 - "Configuración TypeScript de la web"
Cohesion: 0.14
Nodes (13): DOM, ES2022, compilerOptions, lib, module, moduleResolution, noEmit, noUnusedLocals (+5 more)

### Community 50 - "Lista de clientes (ViewModel)"
Cohesion: 0.18
Nodes (8): Descanso, Dia, DiaQueToca, SinRutina, ClientesListViewModel, Cliente, StateFlow, ViewModel

### Community 51 - "Asistencias en Firestore"
Cohesion: 0.26
Nodes (10): TiempoGymCalculator, ClienteAsistenciaRow(), ClienteRutinaRow(), CronometroRow(), formatearDuracion(), Asistencia, Cliente, SegmentoAsistencia() (+2 more)

### Community 53 - "Configuración TypeScript de functions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict, target (+4 more)

### Community 54 - "Sandbox y asignar día"
Cohesion: 0.24
Nodes (9): FaltaRow(), Asistencia, SobornoDialog(), AsignarDiaDialog(), Asistencia, Cliente, SandboxClienteCard(), SandboxScreen() (+1 more)

### Community 55 - "Fondo con blobs y rendimiento"
Cohesion: 0.17
Nodes (12): BlobsGeometria, Blur con BlurMaskFilter sobre Canvas de software, FondoBlobRenderer, La paleta viaja por parámetro, nunca como estado de un object, Blur con BlurMaskFilter (no RenderEffect), Blobs mas chicos y definidos, PaletaVideo, Umbral de contraste WCAG 4.5:1 (+4 more)

### Community 56 - "Diseño de medallas y logros"
Cohesion: 0.17
Nodes (12): Plan: medallas y logros por cliente, LogroPersonalCatalogo, Plan: logros personales por cliente, Rename Screen.Logros → Screen.MedallasCliente, MedallaCatalogo, MedallaImagenUtil, MedallaOtorgada, MedallaRepository (+4 more)

### Community 57 - "Tests de asignación de día"
Cohesion: 0.20
Nodes (3): Asistencia, Cliente, DiaQueToca

### Community 60 - "Plan del video de resumen"
Cohesion: 0.20
Nodes (11): Música de fondo resuelta por nombre en runtime, ResumenCardRenderer, ResumenVideoEncoder, ResumenVideoGenerator, personalizarMensaje ($nombrePersona), Insignias por URL de descarga; videos por ruta, Retención automática de los 6 videos más recientes, VideoPublicado (rutaStorage) (+3 more)

### Community 61 - "Plan del video de resumen"
Cohesion: 0.22
Nodes (11): RangoResumen / TipoResumen, Crossfade de 600 ms entre escenas, EscenaResumen, MaquinaEscribir (efecto máquina de escribir), ResumenFrameRenderer, TimelineResumen, EscenaResumen.LogrosPersonales (máximo 3 por escena), MaquinaEscribir (+3 more)

### Community 62 - "Pagos y videos publicados"
Cohesion: 0.38
Nodes (5): Pago, Flow, Timestamp, PagoRepository, Manual fechaProximoPago Entry Decision

### Community 65 - "Diseño de medallas y logros"
Cohesion: 0.22
Nodes (10): MedallaOtorgada (historial denormalizado), MedallaRepository / catálogo de medallas, Denormalización obligatoria de nombre y mensaje, Doc id compuesto <rangoInicio>_<logroId>, LogroPersonalOtorgado, aqua_noche como paleta por defecto retrocompatible, ConfigVideoRepository (configVideo/{rangoInicio}), PaletaVideo / PaletasVideo (+2 more)

### Community 66 - "Acceso web y contenedor de app"
Cohesion: 0.33
Nodes (3): AccesoWeb, AccesoWebRepository, Flow

### Community 67 - "Canción del cliente"
Cohesion: 0.39
Nodes (7): ClienteEditarScreen(), formatoMmSs(), Context, ReproductorCancionPreview(), OSfitNavHost(), Modifier, NavHostController

### Community 70 - "Card de acciones web"
Cohesion: 0.43
Nodes (6): seccionesWeb(), SeccionWeb, WebClienteScreen(), AccionCard(), Modifier, ImageVector

### Community 73 - "Plan del video de resumen"
Cohesion: 0.25
Nodes (8): Empates de ranking comparten puesto, Plan: resumen semanal/mensual en video por cliente, ResumenClienteCalculator, Plan: resumen de cliente en video animado, Rankings de Esfuerzo y Constancia, ResumenClienteData (rankings), diaFavoritoEnRango, leyendaPorPuesto

### Community 74 - "Rankings y plan de medallas"
Cohesion: 0.32
Nodes (8): Sólo el resumen quincenal otorga medalla, calcularRanking, RankingResultado, ResumenClienteData, ConfirmarMedallaDialog, MedallaCalculator, ConfirmarLogrosDialog, PreparacionResumenQuincenal

### Community 75 - "Acciones del cliente en la web"
Cohesion: 0.39
Nodes (4): esDiaHabil(), faltaQueRompioLaRacha(), fechasQueCuentan(), restarUnDia()

### Community 76 - "Restaurador de archivos locales"
Cohesion: 0.48
Nodes (3): Context, RestauradorDeArchivos, T

### Community 77 - "Pagos del cliente (pantalla)"
Cohesion: 0.57
Nodes (6): AsignarProximoPagoDialog(), ClientePagosScreen(), Pago, Timestamp, PagoCard(), RegistrarPagoDialog()

### Community 80 - "El historial de asistencias es la ley"
Cohesion: 0.29
Nodes (7): Ancla fechada (diaActualIndex + diaAnclaFecha), Retiro de diaPendienteIndex/diaPendienteFecha, diaQueToca (regla de deduccion), El historial de asistencias es la ley, Migracion por congelacion en FECHA_CORTE, RutinaProgressCalculator, Dos paletas por defecto (video y web)

### Community 81 - "Paleta aplicada en la web"
Cohesion: 0.38
Nodes (4): aplicarPaleta(), PaletaWeb, OCEANO, VARIABLES

### Community 82 - "Avisos de falta desde la web"
Cohesion: 0.47
Nodes (3): AvisoFaltaWeb, AvisoFaltaWebRepository, Flow

### Community 83 - "Cambios de día desde la web"
Cohesion: 0.47
Nodes (3): CambioDiaWeb, CambioDiaWebRepository, Flow

### Community 84 - "Logro personal por defecto y archivos que faltan"
Cohesion: 0.47
Nodes (6): logro_personal_default.png (app medal icon, purple star medal), ArchivosQueFaltan (pure missing-file decision logic), RestauradorDeArchivos (startup file restore), Plan: Archivos locales en la nube, Spec: Que los archivos locales sobrevivan a una desinstalación, logroPersonalDefault.png (web medal icon, purple star medal)

### Community 87 - "Repositorio de la ruleta y tirada"
Cohesion: 0.60
Nodes (3): Flow, RuletaRepository, Tirada

### Community 91 - "Servicio de mensajeria push (FCM)"
Cohesion: 0.60
Nodes (3): OSfitMessagingService, FirebaseMessagingService, RemoteMessage

### Community 92 - "Diseño de configuración de video"
Cohesion: 0.40
Nodes (5): RangoResumen, ConfigVideoPeriodo, ConfigVideoRepository, Pantalla Configuracion de video, MuestrasPaleta (componente compartido)

### Community 95 - "Wrapper de Gradle"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

## Knowledge Gaps
- **143 isolated node(s):** `DiaDenormalizado`, `MuestraCodificada`, `Motivo`, `Estado`, `Error` (+138 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cliente` connect `Cliente, rutina y pagos` to `Editor de rutinas y variaciones`, `Logros personales del cliente`, `Pantalla de medallas`, `Detalle del cliente y tipo de resumen`, `Repositorios fake en memoria`, `Contrato de asistencias`, `Pagos y videos publicados`, `Récords personales y estadísticas`, `Cliente, rutina y pagos`, `Repositorio de clientes`, `Tests de progreso de rutina`, `Tests del generador de video`, `Tests de racha`, `Cálculo del resumen del cliente`, `Ancla y progreso de rutina`, `Contenedor de dependencias y repos de la app`, `Lista de clientes (ViewModel)`, `Asistencias en Firestore`, `Sandbox y asignar día`, `Pagos y videos publicados`, `Tests del calculador de medallas`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `Asistencia` connect `Tests de racha` to `Pantalla de medallas`, `Detalle del cliente y tipo de resumen`, `Repositorios fake en memoria`, `Contrato de asistencias`, `Pagos y videos publicados`, `Récords personales y estadísticas`, `Historial de asistencia y Top`, `Cliente, rutina y pagos`, `Cliente, rutina y pagos`, `Tests de progreso de rutina`, `Cálculo del resumen del cliente`, `Contenedor de dependencias y repos de la app`, `Calculadora de variacion del dia (tests)`, `Tests de falta que rompió la racha`, `Asistencias en Firestore`, `Tests de cupo de revives`, `Sandbox y asignar día`, `Cupo de revives`, `Falta que rompió la racha`, `Calculadora de variacion del dia`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `LogroPersonalCatalogo` connect `Logros personales del cliente` to `Resumen del cliente (ViewModel)`, `Pagos y videos publicados`, `Pantalla de medallas`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Are the 42 inferred relationships involving `EscenarioRutina` (e.g. with `.`asignar dia alinea el registro de hoy en Calendario-Rutina`()` and `.`asignar dia con el cronometro ya iniciado hoy tambien avanza manana`()`) actually correct?**
  _`EscenarioRutina` has 42 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `ClienteDetailViewModel` (e.g. with `ClienteDetailScreen()` and `ClienteEditarScreen()`) actually correct?**
  _`ClienteDetailViewModel` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DiaDenormalizado`, `MuestraCodificada`, `Motivo` to the rest of the system?**
  _143 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Editor de rutinas y variaciones` be split into smaller, more focused modules?**
  _Cohesion score 0.05303030303030303 - nodes in this community are weakly interconnected._