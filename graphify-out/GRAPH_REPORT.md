# Graph Report - OSfit  (2026-09-24)

## Corpus Check
- 279 files · ~293,829 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2081 nodes · 4240 edges · 136 communities (96 shown, 40 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 148 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c90e8507`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DiaRutina
- ResumenClienteViewModel.kt
- ResumenFrameRenderer
- LogroPersonalCatalogo
- Paleta
- MedallaRepository
- ClienteDetailScreen.kt
- FakeClienteRepository
- jugarRuleta.ts
- AsistenciaRepository
- functions/package.json
- ruleta.ts
- ClienteDetailViewModel
- web/src/sesion.ts
- Screen
- EstadisticasViewModel.kt
- TopScreen.kt
- tarjetaDia.ts
- escapar
- OSfit Backlog
- ResumenClienteCalculatorTest
- Cliente
- accionFalta.ts
- ClienteRepository
- RutinaProgressCalculatorTest
- Plan: Web para clientes — Etapa 2 (las dos acciones)
- FirestoreClienteRepository
- main.ts
- .resumen
- PaletasTest
- accionDia.ts
- racha.ts
- Asistencia
- EscenarioRutina
- ResumenClienteCalculator
- RutinaProgressCalculator
- ResumenVideoEncoder
- TimelineResumenTest
- DiaDenormalizadoTest
- MedallaAnimacionTest
- ventanas.ts
- TomarAsistenciaViewModel
- VariacionCalculatorTest
- AuthManager
- InsigniaImagenUtil
- FaltaQueRompioLaRachaTest
- RutinaRepository
- MainActivity.kt
- AvanceDiaSecuenciaTest
- compilerOptions
- ClientesListViewModel.kt
- web/package.json
- CupoRevivesCalculatorTest
- compilerOptions
- Dp
- ResumenFrameRenderer
- Plan: medallas y logros por cliente
- .estado
- ReinicioSemanalTest
- SincronizadorDiaWebTest
- ResumenVideoGenerator
- navegacion.ts
- Pago
- InsigniaStorageRepository
- PeriodosQuincenalesTest
- LogroPersonalOtorgado
- AccesoWebRepository
- CancionUtil
- EscenaResumen
- SemanaDeRutinaTest
- AccionCard
- DescargaAtomicaTest
- TextoEntradasTest
- ResumenClienteCalculator
- MedallaCatalogo
- menuLateral.ts
- ArchivosQueFaltanTest
- ClientePagosScreen.kt
- CorregirDiaRealizadoTest
- TiempoGymCalculatorTest
- Paleta (catalogo compartido video+web)
- paleta.ts
- AppContainer
- VideoPublicado
- RestauradorDeArchivos (startup file restore)
- MedallaCalculatorTest
- MaquinaEscribirTest
- ClienteDetailViewModel.kt
- SincronizadorDiaWeb
- CupoRevivesCalculator
- FaltaQueRompioLaRacha
- OSfitMessagingService.kt
- FirestoreAsistenciaRepository
- SemanaDeRutina
- camposFirestore
- gradlew
- ClientesListScreen.kt
- MaquinaEscribir
- WhatsAppUtilTest
- ordenSecciones.test.ts
- ConfigVideoPeriodo.kt
- LogroPersonalRepository
- Pinned Dependency Versions Decision
- Menú lateral y ventanas en la web del cliente
- ResumenVideoGenerator.kt
- WhatsAppUtil
- ConfigVideoViewModel.kt
- EstadisticasScreen.kt
- LogroPersonalImagenUtil
- MedallaImagenUtil
- OSfitNavHost
- CalendarioViewModel
- El cupo de revives se cuenta, no se guarda
- avisosFalta ("Hoy no voy a poder ir")
- BlobsGeometriaTest
- Review Focus
- CalendarioScreen.kt
- TextoMaquinaEscribir
- Cloud Function cambiarDia
- RetencionVideosTest
- BlobsGeometria.kt
- .dibujarFrame
- Notificaciones
- RachaBadge
- SobornoDialog.kt
- TextoEntradas
- ClienteDetail
- WebCliente
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `EscenarioRutina` - 81 edges
2. `Asistencia` - 58 edges
3. `Cliente` - 53 edges
4. `ClienteDetailViewModel` - 52 edges
5. `arrancar()` - 48 edges
6. `ClienteRepository` - 40 edges
7. `ResumenClienteCalculatorTest` - 38 edges
8. `AppContainer` - 35 edges
9. `MedallaCatalogo` - 34 edges
10. `FakeClienteRepository` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Disable Asistió Without Rutina Decision` --rationale_for--> `CalendarioScreen()`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/ui/calendario/CalendarioScreen.kt
- `Silent Firebase Authentication` --references--> `AuthManager`  [EXTRACTED]
  docs/superpowers/specs/2026-08-18-osfit-gym-manager-design.md → app/src/main/java/com/osfit/app/auth/AuthManager.kt
- `Plain id Field / No @DocumentId Decision` --rationale_for--> `Cliente`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Cliente.kt
- `Manual fechaProximoPago Entry Decision` --rationale_for--> `Pago`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Pago.kt
- `Plain id Field / No @DocumentId Decision` --rationale_for--> `Rutina`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Rutina.kt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Bottom Navigation Screens (screensConBarraInferior)** — app_src_main_java_com_osfit_app_ui_navigation_screen_screen, app_src_main_java_com_osfit_app_ui_rutinas_rutinaslistscreen_rutinaslistscreen, app_src_main_java_com_osfit_app_ui_clientes_clienteslistscreen_clienteslistscreen, app_src_main_java_com_osfit_app_ui_calendario_calendarioscreen_calendarioscreen [EXTRACTED 1.00]
- **Contrato del trío denormalizado app ↔ web** — docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_diadenormalizado, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_rutinaprogresscalculator_denormalizar, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_web_src_dia_ts, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_sincronizadordiaweb, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_trio_escrito_a_mano, docs_superpowers_plans_2026_09_11_web_clientes_etapa_2_gemelos_kotlin_typescript [EXTRACTED 1.00]
- **Flujo de acceso y sesión de la web del cliente** — docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_accesoweb, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_funcion_sesion, docs_superpowers_plans_2026_09_10_web_clientes_etapa_1_claim_clienteid, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_cambiardia, docs_superpowers_plans_2026_09_12_web_clientes_etapa_2_revivirracha [EXTRACTED 1.00]
- **rangoInicio de la quincena como identificador compartido de periodo** — docs_superpowers_specs_2026_09_04_medallas_logros_design_medallaotorgada, docs_superpowers_plans_2026_09_07_logros_personales_logropersonalotorgado, docs_superpowers_specs_2026_09_09_configuracion_video_por_periodo_design_configvideoperiodo [EXTRACTED 1.00]
- **Pipeline de generacion del video de resumen** — docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenclientecalculator, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_escenaresumen, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_timelineresumen, docs_superpowers_plans_2026_08_27_resumen_cliente_video_animado_resumenframerenderer, docs_superpowers_plans_2026_08_26_resumen_cliente_video_resumenvideoencoder, docs_superpowers_specs_2026_08_26_resumen_cliente_video_design_compartirvideo [EXTRACTED 1.00]
- **Unstated Spec Assumptions Filled by Plan** — docs_superpowers_plans_2026_08_18_osfit_implementation_decision_fechaproximopago, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_rutina_nested_no_documentid, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_asistio_sin_rutina, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_remarcar_asistencia, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_pinned_versions [EXTRACTED 1.00]
- **Firestore Repository Pattern via AppContainer** — app_src_main_java_com_osfit_app_data_appcontainer_appcontainer, app_src_main_java_com_osfit_app_data_repository_rutinarepository_rutinarepository, app_src_main_java_com_osfit_app_data_repository_clienterepository_clienterepository, app_src_main_java_com_osfit_app_data_repository_pagorepository_pagorepository, app_src_main_java_com_osfit_app_data_repository_asistenciarepository_asistenciarepository [INFERRED 0.85]
- **GEMELO twin implementations kept in sync across Kotlin and TypeScript** — concept_gemelo_pattern, concept_dia_que_toca, concept_variacion_calculator, concept_cupo_revives_calculator, concept_semana_de_rutina [INFERRED 0.85]
- **Palette-from-app feature: shared catalog, plan, and web CSS variable consumption** — concept_paleta_paletas, plan_paleta_web_cliente, web_index_html, docs_backlog_entry7_paleta_web [INFERRED 0.85]
- **Web-para-clientes feature family: incremental features built on the client web page spec** — spec_web_clientes, plan_rutinas_web, plan_ruleta_revivir_racha, plan_reinicio_semanal_rutina, spec_rutinas_web [INFERRED 0.85]

## Communities (136 total, 40 thin omitted)

### Community 0 - "DiaRutina"
Cohesion: 0.05
Nodes (46): DiaRutina, Ejercicio, VariacionDia, conVariacionNueva(), ejerciciosDe(), etiquetaVariacion(), DiaRutina, Ejercicio (+38 more)

### Community 1 - "ResumenClienteViewModel.kt"
Cohesion: 0.22
Nodes (8): ResumenClienteData, Context, StateFlow, ViewModel, YearMonth, PreparacionResumenQuincenal, ResumenClienteViewModel, VideoQuincenalListo

### Community 2 - "ResumenFrameRenderer"
Cohesion: 0.21
Nodes (6): BloqueTexto, Canvas, PosicionLogro, Resaltado, ResumenFrameRenderer, Paint

### Community 3 - "LogroPersonalCatalogo"
Cohesion: 0.16
Nodes (13): LogroPersonalCatalogo, ConfirmarLogrosDialog(), LogroPersonalOtorgado, LogroPersonalCard(), LogrosPersonalesClienteScreen(), OtorgarLogroPersonalDialog(), EditarLogroDialog(), LogroItem() (+5 more)

### Community 4 - "Paleta"
Cohesion: 0.17
Nodes (13): ConfigVideoRepository, Flow, Paleta, Paletas, StateFlow, ViewModel, PaletaWebClienteScreen(), PaletaWebClienteViewModel (+5 more)

### Community 5 - "MedallaRepository"
Cohesion: 0.10
Nodes (11): CategoriaMedallaAutomatica, ASISTENCIA, CONSTANCIA, ESFUERZO, RACHA, TIEMPO, MedallaOtorgada, Flow (+3 more)

### Community 6 - "ClienteDetailScreen.kt"
Cohesion: 0.21
Nodes (16): TipoResumen, MENSUAL, QUINCENAL, SEMANAL, AsignarRutinaDialog(), capitalizar(), ClienteDetailScreen(), ConfirmarActivoDialog() (+8 more)

### Community 7 - "FakeClienteRepository"
Cohesion: 0.07
Nodes (15): FakeAsistenciaRepository, Asistencia, Flow, FakeClienteRepository, Cliente, DiaDenormalizado, Ejercicio, Flow (+7 more)

### Community 8 - "jugarRuleta.ts"
Cohesion: 0.11
Nodes (36): avisarFalta, notificarAlEntrenador(), cambiarDia, clienteDeLaSesion(), db(), hoyEnMazatlan(), REGION, contarEntrada() (+28 more)

### Community 9 - "AsistenciaRepository"
Cohesion: 0.16
Nodes (7): AsistenciaRepository, Asistencia, Flow, calcularSiguienteDiaActualIndex, Upsert Attendance on Re-Mark Decision, Cloud Firestore Offline Cache & Multi-Device Sync, Last-Write-Wins Conflict Resolution

### Community 10 - "functions/package.json"
Cohesion: 0.08
Nodes (24): firebase-admin, firebase-functions, author, dependencies, firebase-admin, firebase-functions, description, devDependencies (+16 more)

### Community 11 - "ruleta.ts"
Cohesion: 0.11
Nodes (35): abrirRuleta(), acuse(), cerrarRuleta(), conectarRuleta(), elegirColor(), Estado, Fase, girando() (+27 more)

### Community 12 - "ClienteDetailViewModel"
Cohesion: 0.10
Nodes (8): totalVariaciones(), ClienteDetailViewModel, Asistencia, Cliente, LogroPersonalOtorgado, MedallaOtorgada, Rutina, Tirada

### Community 13 - "web/src/sesion.ts"
Cohesion: 0.17
Nodes (13): alcanzar(), EntornoSesion, lecturaDelStatus(), LLAVE_TOKEN, memoriaToken, MotivoSinAcceso, resolverSesion(), ResultadoSesion (+5 more)

### Community 14 - "Screen"
Cohesion: 0.06
Nodes (20): Calendario, ClienteAsistencia, ClienteEditar, ClientePagos, Clientes, ConfigVideo, Estadisticas, LogrosPersonales (+12 more)

### Community 15 - "EstadisticasViewModel.kt"
Cohesion: 0.09
Nodes (14): RecordPersonal, Flow, Timestamp, RecordPersonalRepository, Asistencia, RachaCalculator, EstadisticasUiState, EstadisticasViewModel (+6 more)

### Community 16 - "TopScreen.kt"
Cohesion: 0.09
Nodes (34): ClienteAsistenciaScreen(), DetalleAsistenciaDialog(), formatearDuracion(), HistorialCalendarGrid(), Asistencia, Color, YearMonth, Leyenda() (+26 more)

### Community 17 - "tarjetaDia.ts"
Cohesion: 0.16
Nodes (17): Cliente, DiaRutina, Ejercicio, DESCANSO, DiaDenormalizado, DiaQueToca, domingoAnterior(), interpretar() (+9 more)

### Community 18 - "escapar"
Cohesion: 0.16
Nodes (16): MedallaOtorgada, VideoResumen, pintarVideos(), escapar(), insignia(), porRangoDescendente(), seccionVacia(), tarjetaLogrosPersonales() (+8 more)

### Community 19 - "OSfit Backlog"
Cohesion: 0.10
Nodes (30): CupoRevivesCalculator / cupo.ts twin, Denormalización del día (ultimoDia/ultimoDiaFecha/ultimoDiaEsAncla), DiaQueToca sealed type (day-of-cycle result), GEMELO pattern: duplicated Kotlin/TypeScript pure logic kept in sync, jugarRuleta Cloud Function, Paleta / Paletas catalog (shared video+web colors), RutinaProgressCalculator (day-of-cycle domain logic), SemanaDeRutina week arithmetic helper (+22 more)

### Community 21 - "Cliente"
Cohesion: 0.13
Nodes (5): Cliente, DiaDenormalizado, Rutina, RangoResumen, Plain id Field / No @DocumentId Decision

### Community 22 - "accionFalta.ts"
Cohesion: 0.10
Nodes (21): avisarFalta, jugarRuleta, revivirRacha, disponiblesEnElMes(), gastadosEnElMes(), MAXIMO_POR_MES, esDiaHabil(), faltaQueRompioLaRacha() (+13 more)

### Community 23 - "ClienteRepository"
Cohesion: 0.10
Nodes (6): ClienteRepository, Cliente, DiaDenormalizado, Flow, Rutina, Timestamp

### Community 25 - "Plan: Web para clientes — Etapa 2 (las dos acciones)"
Cohesion: 0.17
Nodes (13): DiaDenormalizado (el trío dia/fecha/esAncla), RutinaProgressCalculator.denormalizar / interpretar, SincronizadorDiaWeb, web/src/dia.ts (gemelo TS del intérprete), Zona horaria America/Mazatlan para "hoy", Convención de gemelos Kotlin ↔ TypeScript, MotivosCambioDia, Plan (borrador 09-11): Web clientes Etapa 2 — las dos acciones (+5 more)

### Community 26 - "FirestoreClienteRepository"
Cohesion: 0.10
Nodes (6): FirestoreClienteRepository, Cliente, DiaDenormalizado, Flow, Rutina, Timestamp

### Community 27 - "main.ts"
Cohesion: 0.11
Nodes (40): alFallarDatos(), alVolverDatos(), escuchar(), observarAsistencias(), observarAvisoFalta(), observarCliente(), observarLogrosPersonales(), observarMedallas() (+32 more)

### Community 28 - ".resumen"
Cohesion: 0.16
Nodes (4): DesgloseEsfuerzo, PuntoTiempoDiario, RankingResultado, ResumenVideoGeneratorTest

### Community 30 - "accionDia.ts"
Cohesion: 0.18
Nodes (16): cambiarDia, horaEnMazatlan(), hoyEnMazatlan(), leTocaFragil(), Motivo, MOTIVOS, motivosPara(), NOMBRES_CON_FRAGIL (+8 more)

### Community 31 - "racha.ts"
Cohesion: 0.25
Nodes (6): esDiaHabil(), fechasQueCuentan(), promedioMinutos(), rachaActual(), restarUnDia(), tarjetasStats()

### Community 34 - "ResumenClienteCalculator"
Cohesion: 0.24
Nodes (4): Asistencia, Cliente, YearMonth, ResumenClienteCalculator

### Community 35 - "RutinaProgressCalculator"
Cohesion: 0.30
Nodes (7): Ancla, Asistencia, Cliente, DiaDenormalizado, DiaQueToca, RutinaProgressCalculator, Routine Day Advancement Logic

### Community 36 - "ResumenVideoEncoder"
Cohesion: 0.26
Nodes (7): AcumuladorPcm, Context, MuestraCodificada, Pcm, PistaCodificada, ResumenVideoEncoder, ShortArray

### Community 37 - "TimelineResumenTest"
Cohesion: 0.15
Nodes (3): TimelineResumen, TramoEscena, TimelineResumenTest

### Community 40 - "ventanas.ts"
Cohesion: 0.13
Nodes (16): Asistencia, LogroPersonalOtorgado, hojaDeMotivosAbierta(), accionHoyNoPuedo(), calendario(), columnaDe(), moverMes(), NOMBRES_MES (+8 more)

### Community 41 - "TomarAsistenciaViewModel"
Cohesion: 0.09
Nodes (22): Descanso, Dia, DiaQueToca, SinRutina, TiempoGymCalculator, Asistencia, VariacionCalculator, ClienteAsistenciaRow() (+14 more)

### Community 43 - "AuthManager"
Cohesion: 0.28
Nodes (7): AuthManager, AuthState, Error, StateFlow, Loading, Success, Silent Firebase Authentication

### Community 44 - "InsigniaImagenUtil"
Cohesion: 0.13
Nodes (9): BoundingBox, Encaje, EncajeInsignia, InsigniaImagenUtil, Bitmap, Context, Uri, EncajeInsigniaTest (+1 more)

### Community 46 - "RutinaRepository"
Cohesion: 0.21
Nodes (7): Flow, Rutina, RutinaRepository, Rutina, StateFlow, ViewModel, RutinasViewModel

### Community 47 - "MainActivity.kt"
Cohesion: 0.36
Nodes (5): MainActivity, OSfitTheme(), App Launcher Icon Foreground, Bundle, ComponentActivity

### Community 49 - "compilerOptions"
Cohesion: 0.14
Nodes (13): DOM, ES2022, compilerOptions, lib, module, moduleResolution, noEmit, noUnusedLocals (+5 more)

### Community 50 - "ClientesListViewModel.kt"
Cohesion: 0.32
Nodes (4): ClientesListViewModel, Cliente, StateFlow, ViewModel

### Community 51 - "web/package.json"
Cohesion: 0.09
Nodes (22): firebase, vite, author, dependencies, firebase, description, devDependencies, typescript (+14 more)

### Community 53 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict, target (+4 more)

### Community 54 - "Dp"
Cohesion: 0.27
Nodes (7): ConfirmarMedallaDialog(), AsignarDiaDialog(), Asistencia, Cliente, SandboxClienteCard(), SandboxScreen(), Dp

### Community 55 - "ResumenFrameRenderer"
Cohesion: 0.20
Nodes (11): BlobsGeometria, Blur con BlurMaskFilter sobre Canvas de software, FondoBlobRenderer, MaquinaEscribir (efecto máquina de escribir), ResumenFrameRenderer, La paleta viaja por parámetro, nunca como estado de un object, Blur con BlurMaskFilter (no RenderEffect), MaquinaEscribir (+3 more)

### Community 56 - "Plan: medallas y logros por cliente"
Cohesion: 0.25
Nodes (8): Plan: medallas y logros por cliente, Plan: logros personales por cliente, Rename Screen.Logros → Screen.MedallasCliente, Plan: Web para clientes — Etapa 1 (acceso y lectura), Ciclo TDD test→fail→implement→pass→commit, Convenciones del repo OSfit, Logros personales como espejo del sistema de medallas, Instrucciones para Gemini — OSfit

### Community 57 - ".estado"
Cohesion: 0.20
Nodes (3): Asistencia, Cliente, DiaQueToca

### Community 60 - "ResumenVideoGenerator"
Cohesion: 0.14
Nodes (18): Música de fondo resuelta por nombre en runtime, RangoResumen / TipoResumen, ResumenCardRenderer, ResumenVideoEncoder, ResumenVideoGenerator, Crossfade de 600 ms entre escenas, EscenaResumen, TimelineResumen (+10 more)

### Community 61 - "navegacion.ts"
Cohesion: 0.24
Nodes (13): pintarMenu(), abrirMenu(), abrirVentana(), alRetroceder(), avisar(), cerrarMenu(), Historial, historialDelNavegador() (+5 more)

### Community 62 - "Pago"
Cohesion: 0.38
Nodes (5): Pago, Flow, Timestamp, PagoRepository, Manual fechaProximoPago Entry Decision

### Community 65 - "LogroPersonalOtorgado"
Cohesion: 0.11
Nodes (22): MedallaOtorgada (historial denormalizado), MedallaRepository / catálogo de medallas, Denormalización obligatoria de nombre y mensaje, Doc id compuesto <rangoInicio>_<logroId>, LogroPersonalCatalogo, LogroPersonalOtorgado, aqua_noche como paleta por defecto retrocompatible, ConfigVideoRepository (configVideo/{rangoInicio}) (+14 more)

### Community 66 - "AccesoWebRepository"
Cohesion: 0.33
Nodes (3): AccesoWeb, AccesoWebRepository, Flow

### Community 67 - "CancionUtil"
Cohesion: 0.30
Nodes (7): ClienteEditarScreen(), formatoMmSs(), Context, ReproductorCancionPreview(), CancionUtil, Context, Uri

### Community 68 - "EscenaResumen"
Cohesion: 0.13
Nodes (11): Asistencia, Despedida, DiaFavorito, EscenaResumen, Esfuerzo, LogroEnEscena, LogrosPersonales, Medalla (+3 more)

### Community 70 - "AccionCard"
Cohesion: 0.46
Nodes (6): seccionesWeb(), SeccionWeb, WebClienteScreen(), AccionCard(), Modifier, ImageVector

### Community 73 - "ResumenClienteCalculator"
Cohesion: 0.14
Nodes (17): Empates de ranking comparten puesto, Plan: resumen semanal/mensual en video por cliente, ResumenClienteCalculator, Plan: resumen de cliente en video animado, Rankings de Esfuerzo y Constancia, ResumenClienteData (rankings), Sólo el resumen quincenal otorga medalla, calcularRanking (+9 more)

### Community 74 - "MedallaCatalogo"
Cohesion: 0.19
Nodes (12): MedallaCatalogo, MedallaOtorgada, MedallaCard(), MedallasClienteScreen(), OtorgarMedallaDialog(), EditarMedallaDialog(), MedallaItem(), MedallasScreen() (+4 more)

### Community 75 - "menuLateral.ts"
Cohesion: 0.17
Nodes (10): actualizarCabecera(), aplicarMenuAbierto(), BotonOpcion, conectarMenu(), marcarVentanaActiva(), opcion(), panelMenu(), toggle() (+2 more)

### Community 76 - "ArchivosQueFaltanTest"
Cohesion: 0.12
Nodes (7): Context, RestauradorDeArchivos, ArchivoEsperado, ArchivosQueFaltan, Cliente, ArchivosQueFaltanTest, T

### Community 77 - "ClientePagosScreen.kt"
Cohesion: 0.31
Nodes (7): Cliente, PagoCalculator, AsignarProximoPagoDialog(), ClientePagosScreen(), Timestamp, PagoCard(), RegistrarPagoDialog()

### Community 80 - "Paleta (catalogo compartido video+web)"
Cohesion: 0.17
Nodes (12): Ancla fechada (diaActualIndex + diaAnclaFecha), Retiro de diaPendienteIndex/diaPendienteFecha, diaQueToca (regla de deduccion), El historial de asistencias es la ley, Migracion por congelacion en FECHA_CORTE, RutinaProgressCalculator, Umbral de contraste WCAG 4.5:1, Dos paletas por defecto (video y web) (+4 more)

### Community 81 - "paleta.ts"
Cohesion: 0.38
Nodes (4): aplicarPaleta(), PaletaWeb, OCEANO, VARIABLES

### Community 82 - "AppContainer"
Cohesion: 0.13
Nodes (9): AppContainer, AvisoFaltaWeb, CambioDiaWeb, AvisoFaltaWebRepository, Flow, CambioDiaWebRepository, Flow, CancionStorageRepository (+1 more)

### Community 83 - "VideoPublicado"
Cohesion: 0.19
Nodes (7): VideoPublicado, Flow, VideoPublicadoRepository, RetencionVideos, duracionEnMinutosYSegundos(), VideoPublicadoCard(), VideosWebClienteScreen()

### Community 84 - "RestauradorDeArchivos (startup file restore)"
Cohesion: 0.47
Nodes (6): logro_personal_default.png (app medal icon, purple star medal), ArchivosQueFaltan (pure missing-file decision logic), RestauradorDeArchivos (startup file restore), Plan: Archivos locales en la nube, Spec: Que los archivos locales sobrevivan a una desinstalación, logroPersonalDefault.png (web medal icon, purple star medal)

### Community 87 - "ClienteDetailViewModel.kt"
Cohesion: 0.21
Nodes (7): Flow, RuletaRepository, Tirada, Flow, StateFlow, Timestamp, ViewModel

### Community 91 - "OSfitMessagingService.kt"
Cohesion: 0.60
Nodes (3): OSfitMessagingService, FirebaseMessagingService, RemoteMessage

### Community 92 - "FirestoreAsistenciaRepository"
Cohesion: 0.26
Nodes (4): FirestoreAsistenciaRepository, Asistencia, Flow, DocumentReference

### Community 94 - "camposFirestore"
Cohesion: 0.20
Nodes (5): Flow, PaletaWebRepository, aHexWeb(), camposFirestore(), PaletaWebFirestoreTest

### Community 95 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 96 - "ClientesListScreen.kt"
Cohesion: 0.33
Nodes (8): AvatarCliente(), ClienteItem(), ClientesListScreen(), EncabezadoSaludo(), Cliente, NuevoClienteDialog(), rememberFechaActual(), State

### Community 101 - "LogroPersonalRepository"
Cohesion: 0.21
Nodes (4): LogroPersonalOtorgado, Flow, LogroPersonalOtorgado, LogroPersonalRepository

### Community 105 - "Menú lateral y ventanas en la web del cliente"
Cohesion: 0.14
Nodes (13): Arquitectura del código, Cambios en `main.ts`, Contexto y objetivo, El menú lateral, Esqueleto de carga, Menú lateral y ventanas en la web del cliente, Navegación y "atrás", Pruebas (+5 more)

### Community 106 - "ResumenVideoGenerator.kt"
Cohesion: 0.26
Nodes (5): CompartirUtil, Context, Context, ResumenGenerado, ResumenVideoGenerator

### Community 107 - "WhatsAppUtil"
Cohesion: 0.35
Nodes (4): DiaRutina, Ejercicio, Uri, WhatsAppUtil

### Community 108 - "ConfigVideoViewModel.kt"
Cohesion: 0.29
Nodes (5): PeriodosQuincenales, ConfigVideoViewModel, StateFlow, ViewModel, PeriodoConPaleta

### Community 109 - "EstadisticasScreen.kt"
Cohesion: 0.38
Nodes (9): EditarEjercicioFavoritoDialog(), EstadisticasScreen(), Modifier, Timestamp, RecordCard(), RegistrarRecordDialog(), SeleccionarDiaFavoritoDialog(), SeleccionarFechaDialog() (+1 more)

### Community 110 - "LogroPersonalImagenUtil"
Cohesion: 0.36
Nodes (4): Bitmap, Context, Uri, LogroPersonalImagenUtil

### Community 111 - "MedallaImagenUtil"
Cohesion: 0.36
Nodes (4): Bitmap, Context, Uri, MedallaImagenUtil

### Community 112 - "OSfitNavHost"
Cohesion: 0.33
Nodes (7): ErrorScreen(), Modifier, OSfitNavHost(), OSfitApp(), OSfitContent(), popUpTo Without saveState/restoreState Decision, NavHostController

### Community 113 - "CalendarioViewModel"
Cohesion: 0.33
Nodes (7): CalendarioViewModel, Asistencia, Cliente, StateFlow, ViewModel, YearMonth, Disable Asistió Without Rutina Decision

### Community 121 - "Review Focus"
Cohesion: 0.22
Nodes (8): Global Constraints, Menú lateral y ventanas — Implementation Plan, Review Focus, Task 1: Registro de ventanas, Task 2: Navegación con "atrás", Task 3: Cabecera y panel del menú, Task 4: Cablear las ventanas en `main.ts`, Task 5: Verificación en el navegador

### Community 122 - "CalendarioScreen.kt"
Cohesion: 0.54
Nodes (7): calcularColoresPorFecha(), CalendarGrid(), CalendarHeader(), CalendarioScreen(), Asistencia, Color, YearMonth

### Community 123 - "TextoMaquinaEscribir"
Cohesion: 0.39
Nodes (6): Modifier, TextStyle, TextoMaquinaEscribir(), Rutina, RutinaItem(), RutinasListScreen()

### Community 124 - "Cloud Function cambiarDia"
Cohesion: 0.29
Nodes (8): AccesoWeb / AccesoWebRepository (link mágico), Custom claim clienteId, Cloud Function sesion (canje de token), Cloud Function cambiarDia, CambioDiaWeb / colección cambiosDia, Decisión: cambiarDia y revivirRacha son onCall, Firebase Storage y sus reglas por claim clienteId, ResumenStorageRepository (subir / borrar)

### Community 126 - "BlobsGeometria.kt"
Cohesion: 0.53
Nodes (3): BlobsGeometria, BlobSpec, Punto

### Community 127 - ".dibujarFrame"
Cohesion: 0.53
Nodes (3): Capa, FondoBlobRenderer, Canvas

### Community 129 - "RachaBadge"
Cohesion: 0.70
Nodes (4): Modifier, TextStyle, RachaBadge(), TextUnit

### Community 130 - "SobornoDialog.kt"
Cohesion: 0.83
Nodes (3): FaltaRow(), Asistencia, SobornoDialog()

## Knowledge Gaps
- **166 isolated node(s):** `Loading`, `Success`, `Error`, `ConfigVideoPeriodo`, `ASISTENCIA` (+161 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppContainer` connect `AppContainer` to `DiaRutina`, `ResumenClienteViewModel.kt`, `LogroPersonalCatalogo`, `Paleta`, `MedallaRepository`, `AsistenciaRepository`, `EstadisticasViewModel.kt`, `TopScreen.kt`, `ClienteRepository`, `FirestoreClienteRepository`, `TomarAsistenciaViewModel`, `RutinaRepository`, `MainActivity.kt`, `ClientesListViewModel.kt`, `Pago`, `InsigniaStorageRepository`, `AccesoWebRepository`, `MedallaCatalogo`, `ArchivosQueFaltanTest`, `VideoPublicado`, `ClienteDetailViewModel.kt`, `SincronizadorDiaWeb`, `FirestoreAsistenciaRepository`, `LogroPersonalRepository`, `ResumenVideoGenerator.kt`, `ConfigVideoViewModel.kt`, `CalendarioViewModel`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `Asistencia` connect `Asistencia` to `SobornoDialog.kt`, `MedallaRepository`, `FakeClienteRepository`, `AsistenciaRepository`, `EstadisticasViewModel.kt`, `TopScreen.kt`, `ResumenClienteCalculatorTest`, `Cliente`, `RutinaProgressCalculatorTest`, `.resumen`, `TomarAsistenciaViewModel`, `VariacionCalculatorTest`, `FaltaQueRompioLaRachaTest`, `CupoRevivesCalculatorTest`, `Dp`, `ClienteDetailViewModel.kt`, `CupoRevivesCalculator`, `FaltaQueRompioLaRacha`, `FirestoreAsistenciaRepository`, `CalendarioViewModel`, `CalendarioScreen.kt`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `Cliente` connect `Cliente` to `DiaRutina`, `MedallaRepository`, `ClienteDetailScreen.kt`, `FakeClienteRepository`, `EstadisticasViewModel.kt`, `ResumenClienteCalculatorTest`, `ClienteRepository`, `RutinaProgressCalculatorTest`, `.resumen`, `Asistencia`, `TomarAsistenciaViewModel`, `ClientesListViewModel.kt`, `Dp`, `Pago`, `ArchivosQueFaltanTest`, `ClientePagosScreen.kt`, `MedallaCalculatorTest`, `ClienteDetailViewModel.kt`, `ClientesListScreen.kt`, `CalendarioViewModel`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 42 inferred relationships involving `EscenarioRutina` (e.g. with `.`asignar dia alinea el registro de hoy en Calendario-Rutina`()` and `.`asignar dia con el cronometro ya iniciado hoy tambien avanza manana`()`) actually correct?**
  _`EscenarioRutina` has 42 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `ClienteDetailViewModel` (e.g. with `ClienteDetailScreen()` and `ClienteEditarScreen()`) actually correct?**
  _`ClienteDetailViewModel` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Loading`, `Success`, `Error` to the rest of the system?**
  _166 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DiaRutina` be split into smaller, more focused modules?**
  _Cohesion score 0.05078929306794784 - nodes in this community are weakly interconnected._