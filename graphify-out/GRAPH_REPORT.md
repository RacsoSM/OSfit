# Graph Report - OSfit  (2026-08-20)

## Corpus Check
- Corpus is ~22,415 words - fits in a single context window. You may not need a graph.

## Summary
- 242 nodes · 443 edges · 17 communities (15 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.82)
- Token cost: 0 input · 131,548 output

## Community Hubs (Navigation)
- Client & Attendance Core Logic
- Attendance Calendar & Sync
- App Shell & Auth
- Client Detail & Routine Assignment
- Routine Editor
- Navigation Routes
- Client Detail & Payments UI
- Routine Progress Tests
- Client & Routine List UI
- Payments Domain
- Attendance History UI
- Gradle Wrapper Script
- Project Documentation
- Tech Stack Decisions

## God Nodes (most connected - your core abstractions)
1. `Cliente` - 29 edges
2. `Rutina` - 23 edges
3. `ClienteRepository` - 20 edges
4. `ClienteDetailViewModel` - 18 edges
5. `Asistencia` - 16 edges
6. `OSfitNavHost()` - 16 edges
7. `AsistenciaRepository` - 15 edges
8. `RutinaRepository` - 14 edges
9. `Screen` - 14 edges
10. `RutinaEditorViewModel` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Plain id Field / No @DocumentId Decision` --rationale_for--> `Rutina`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Rutina.kt
- `Silent Firebase Authentication` --references--> `AuthManager`  [EXTRACTED]
  docs/superpowers/specs/2026-08-18-osfit-gym-manager-design.md → app/src/main/java/com/osfit/app/auth/AuthManager.kt
- `Plain id Field / No @DocumentId Decision` --rationale_for--> `Cliente`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Cliente.kt
- `Manual fechaProximoPago Entry Decision` --rationale_for--> `Pago`  [EXTRACTED]
  docs/superpowers/plans/2026-08-18-osfit-implementation.md → app/src/main/java/com/osfit/app/data/model/Pago.kt
- `AsistenciaRepository` --calls--> `calcularSiguienteDiaActualIndex`  [EXTRACTED]
  app/src/main/java/com/osfit/app/data/repository/AsistenciaRepository.kt → docs/superpowers/plans/2026-08-18-osfit-implementation.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Firestore Repository Pattern via AppContainer** — app_src_main_java_com_osfit_app_data_appcontainer_appcontainer, app_src_main_java_com_osfit_app_data_repository_rutinarepository_rutinarepository, app_src_main_java_com_osfit_app_data_repository_clienterepository_clienterepository, app_src_main_java_com_osfit_app_data_repository_pagorepository_pagorepository, app_src_main_java_com_osfit_app_data_repository_asistenciarepository_asistenciarepository [INFERRED 0.85]
- **Bottom Navigation Screens (screensConBarraInferior)** — app_src_main_java_com_osfit_app_ui_navigation_screen_screen, app_src_main_java_com_osfit_app_ui_rutinas_rutinaslistscreen_rutinaslistscreen, app_src_main_java_com_osfit_app_ui_clientes_clienteslistscreen_clienteslistscreen, app_src_main_java_com_osfit_app_ui_calendario_calendarioscreen_calendarioscreen [EXTRACTED 1.00]
- **Unstated Spec Assumptions Filled by Plan** — docs_superpowers_plans_2026_08_18_osfit_implementation_decision_fechaproximopago, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_rutina_nested_no_documentid, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_asistio_sin_rutina, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_remarcar_asistencia, docs_superpowers_plans_2026_08_18_osfit_implementation_decision_pinned_versions [EXTRACTED 1.00]

## Communities (17 total, 2 thin omitted)

### Community 0 - "Client & Attendance Core Logic"
Cohesion: 0.08
Nodes (19): Cliente, ClienteRepository, Flow, Timestamp, PagoCalculator, RutinaProgressCalculator, ClienteAsistenciaRow(), ClienteRutinaRow() (+11 more)

### Community 1 - "Attendance Calendar & Sync"
Cohesion: 0.12
Nodes (21): Asistencia, AsistenciaRepository, Flow, calcularSiguienteDiaActualIndex, calcularColoresPorFecha(), CalendarGrid(), CalendarHeader(), CalendarioScreen() (+13 more)

### Community 2 - "App Shell & Auth"
Cohesion: 0.11
Nodes (20): AuthManager, AuthState, Error, StateFlow, Loading, Success, MainActivity, ErrorScreen() (+12 more)

### Community 3 - "Client Detail & Routine Assignment"
Cohesion: 0.13
Nodes (11): AppContainer, Rutina, Flow, RutinaRepository, ClienteDetailViewModel, StateFlow, Timestamp, ViewModel (+3 more)

### Community 4 - "Routine Editor"
Cohesion: 0.16
Nodes (7): DiaRutina, Ejercicio, EjercicioRow(), RutinaEditorScreen(), StateFlow, ViewModel, RutinaEditorViewModel

### Community 5 - "Navigation Routes"
Cohesion: 0.12
Nodes (11): Calendario, ClienteAsistencia, ClienteDetail, ClientePagos, Clientes, Estadisticas, RutinaEditor, Rutinas (+3 more)

### Community 6 - "Client Detail & Payments UI"
Cohesion: 0.23
Nodes (13): AsignarDiaDialog(), AsignarRutinaDialog(), ClienteDetailScreen(), ConfirmarActivoDialog(), ConfirmarEliminarDialog(), AsignarProximoPagoDialog(), ClientePagosScreen(), Timestamp (+5 more)

### Community 8 - "Client & Routine List UI"
Cohesion: 0.27
Nodes (10): AvatarCliente(), ClienteItem(), ClientesListScreen(), EncabezadoSaludo(), NuevoClienteDialog(), Modifier, TextoMaquinaEscribir(), RutinaItem() (+2 more)

### Community 9 - "Payments Domain"
Cohesion: 0.38
Nodes (5): Pago, Flow, Timestamp, PagoRepository, Manual fechaProximoPago Entry Decision

### Community 10 - "Attendance History UI"
Cohesion: 0.39
Nodes (7): ClienteAsistenciaScreen(), HistorialCalendarGrid(), Color, YearMonth, Leyenda(), YearMonth, MonthCalendarHeader()

### Community 11 - "Gradle Wrapper Script"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 12 - "Project Documentation"
Cohesion: 1.00
Nodes (3): OSfit Implementation Plan, OSfit Gym Manager Design Spec, OSfit README

## Knowledge Gaps
- **14 isolated node(s):** `Loading`, `Success`, `Error`, `Clientes`, `Calendario` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OSfitNavHost()` connect `App Shell & Auth` to `Client & Attendance Core Logic`, `Attendance Calendar & Sync`, `Routine Editor`, `Navigation Routes`, `Client Detail & Payments UI`, `Client & Routine List UI`, `Attendance History UI`?**
  _High betweenness centrality (0.324) - this node is a cross-community bridge._
- **Why does `Cliente` connect `Client & Attendance Core Logic` to `Client & Routine List UI`, `Attendance Calendar & Sync`, `Client Detail & Routine Assignment`, `Payments Domain`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Why does `Rutina` connect `Client Detail & Routine Assignment` to `Client & Attendance Core Logic`, `Client & Routine List UI`, `Routine Editor`, `Client Detail & Payments UI`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `ClienteDetailViewModel` (e.g. with `ClienteDetailScreen()` and `ClientePagosScreen()`) actually correct?**
  _`ClienteDetailViewModel` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Loading`, `Success`, `Error` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Client & Attendance Core Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.07751937984496124 - nodes in this community are weakly interconnected._
- **Should `Attendance Calendar & Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.12298387096774194 - nodes in this community are weakly interconnected._