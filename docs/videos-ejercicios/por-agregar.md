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

## Procesados

- **2026-10-23:** los 11 de la primera lista, dados de alta con su video (ver el estado de
  `camino1.md`). `0155` ("Aperturas en polea") se descartó: es el mismo GIF de `cruce-poleas`, que
  ya tiene el alias "aperturas en polea".
