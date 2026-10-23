# Ejercicios por agregar al banco

Lista que va armando el entrenador: ejercicios que eligió del dataset de Gym visual
(`hasaneyldrm/exercises-dataset`, el commit fijado en `DATASET` de
`functions/scripts/bancoEjercicios.mjs`) para darlos de alta después, todos juntos.

Por cada uno, al procesar la lista (como se hizo con `fondos-maquina`, 2026-10-22):

1. Agregarlo a `functions/semilla/ejercicios.json` (`gifOrigen` = el número de la tabla).
2. Si es de placas, a `MAQUINAS_DE_BARRAS` en `web/src/barras.ts`.
3. Darle estándares en `docs/estandares-fuerza/proponer.py` y volver a correrlo.
4. Cargar: `cargarBancoEjercicios.mjs <id>` y `cargarEstandares.mjs`.
5. Video HD con el camino 1 (`camino1.md` §6: generar, revisar, subir, verificar).
6. Desplegar la web si cambió `barras.ts`.
7. Quitarlo de esta lista y anotarlo en el estado de `camino1.md`.

Los id, nombres, alias y músculos son una propuesta: se ajustan al procesar.

## Pendientes

| GIF | id propuesto | Nombre | Grupo | Músculos | Alias propuestos | Notas |
|---|---|---|---|---|---|---|
| 0743 | `sentadilla-hack-maquina` | Sentadilla hack en máquina | cuadriceps | cuadriceps 1, gluteo 0.5 | hack en maquina, sentadilla hack maquina, sentadilla hack en maquina, maquina hack, hack squat maquina | Elegida el 2026-10-23. Ejercicio aparte: `sentadilla-hack` (GIF 0046, con barra) se queda como está. Casi siempre es de discos, así que no va en barras (como `sentadilla-hack`). |
| 0624 | `sentadilla-isometrica` | Sentadilla isométrica en pared | cuadriceps | cuadriceps 1, gluteo 0.5 | sentadilla isometrica, sentadilla en pared, isometrica en pared, sentadilla isometrica con marcha, silla en pared, wall sit | Elegida el 2026-10-23. Tipo `tiempo` (segundos, como la plancha): sin estándares, no pinta el mapa. El dataset no trae la wall sit quieta; el GIF ("march sit (wall)") sube una rodilla y luego la otra. |
| 0740 | `prensa-pies-abiertos` | Prensa con pies abiertos | gluteo | gluteo 1, cuadriceps 1, isquiotibiales 0.5 | prensa abierta, prensa pies abiertos, prensa sumo, prensa para gluteo, prensa 45 pies abiertos, prensa con piernas abiertas | Elegida el 2026-10-23. Prensa de 45° (la misma máquina que `prensa`, GIF 0739) con los pies separados: más glúteo. De discos, no va en barras (como `prensa`). Estándares: la familia `prensa`, cerca de ×1.00. |
