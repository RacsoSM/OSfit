# Últimas entradas a la web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la ficha de cada clienta muestre sus últimas 5 aperturas de la página con hora exacta (Mazatlán) e iPhone/Android, y que el contador de entradas cuente todas las aperturas, también las de la página instalada.

**Architecture:** La web llama una vez por carga a la callable nueva `registrarEntrada` con la plataforma. La función, en una transacción sobre `accesosWeb/{token}`, suma la entrada, pone `ultimoAcceso` y guarda `ultimasEntradas` (máx. 5, la más reciente primero). `sesion` deja de contar. La app lee el campo nuevo y lo pinta en la tarjeta "Acceso web".

**Tech Stack:** Cloud Functions v2 (TypeScript, vitest), web Vite + TypeScript (vitest), Android Kotlin + Compose (JUnit para lo puro).

**Spec:** `docs/superpowers/specs/2026-10-10-ultimas-entradas-design.md`. Léelo antes de empezar.

## Global Constraints

- La hora es la del servidor, nunca la del teléfono.
- Plataforma: solo `"ios"`, `"android"` u `"otro"`; cualquier otra cosa se guarda como `"otro"`.
- La web no espera a `registrarEntrada` ni muestra nada si falla. Una vez por carga.
- `sesion` deja de llamar a `contarEntrada`; `registrarEntrada` es el único que cuenta.
- Sin cambios en reglas.
- Funciones: desplegar por nombre (por `guardarEstilo`).
- Commits en inglés con prefijo y `Co-Authored-By:`. Un commit por task.
- **Desplegar requiere confirmación del entrenador.**

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `functions/src/entradas.ts` (+ test) | Crear | Puro: `plataformaValida`, `conNuevaEntrada` (agrega y recorta a 5). |
| `functions/src/registrarEntrada.ts` | Crear | La callable, con transacción. |
| `functions/src/contador.ts` (+ test) | Borrar | Lo reemplaza `registrarEntrada`. |
| `functions/src/sesion.ts` | Modificar | Ya no cuenta. |
| `functions/src/index.ts` | Modificar | Exportar `registrarEntrada`. |
| `web/src/acciones.ts` | Modificar | `registrarEntrada`. |
| `web/src/main.ts` | Modificar | Llamarla una vez por carga, sin esperar. |
| `app/.../data/model/AccesoWeb.kt` | Modificar | `ultimasEntradas: List<EntradaWeb>`. |
| `app/.../util/TextoEntradas.kt` (+ test) | Modificar | `entrada(cuando, plataforma, zona)`. |
| `app/.../ui/clientes/ClienteDetailScreen.kt` | Modificar | Bloque "Últimas entradas". |

### Task 1: Funciones

- [ ] Tests de `entradas.ts`: plataforma válida e inválida; agregar a una lista vacía; la nueva va primero; con 5 se descarta la más vieja; una lista que no es arreglo (dato viejo o roto) se trata como vacía.
- [ ] `entradas.ts`, `registrarEntrada.ts` (`clienteDeLaSesion`, query `accesosWeb` por `clienteId`, transacción con `entradas` + 1, `ultimoAcceso` y `ultimasEntradas`), export en `index.ts`.
- [ ] `sesion.ts` sin `contarEntrada`; borrar `contador.ts` y su test.
- [ ] `npm --prefix functions test` y `run build` en verde. Commit.

### Task 2: Web

- [ ] `registrarEntrada` en `acciones.ts`; en `main.ts`, después de `credencialLista()`, `registrarEntrada({ plataforma: plataforma(navigator.userAgent) }).catch(() => {})`.
- [ ] `npm --prefix web test`, `tsc` y build en verde. Commit.

### Task 3: App

- [ ] Test de `TextoEntradas.entrada`: "10 oct, 7:42 pm · iPhone" en zona Mazatlán; Android; "Otro dispositivo"; sin hora.
- [ ] `EntradaWeb` y `AccesoWeb.ultimasEntradas`; comentarios de `entradas` actualizados (ahora cuenta aperturas, no canjes).
- [ ] Bloque "Últimas entradas" en la tarjeta "Acceso web" (solo si hay entradas).
- [ ] `./gradlew testDebugUnitTest assembleDebug` en verde. Commit.

### Task 4: Despliegue (con confirmación)

- [ ] `firebase deploy --only functions:registrarEntrada`, luego hosting, luego `--only functions:sesion`.
- [ ] Abrir la página de una clienta y ver que `ultimasEntradas` se llena con la plataforma correcta.
- [ ] APK al entrenador. Marcar el punto 9 del backlog.

## Registro de verificación

(Se llena en Task 4.)
