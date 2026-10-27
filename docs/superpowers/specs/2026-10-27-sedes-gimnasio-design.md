# Sedes: el mismo peso en gimnasios con máquinas distintas

**Fecha:** 2026-10-27 · **Pedido por:** el entrenador · **Estado:** diseño, por aprobar

## El problema

Los estándares de fuerza de las máquinas se calibraron en **Focus Novum** (máquinas Relax
Fitness). Unos amigos del entrenador entrenan a distancia en **Smart Fit Barrancos** (máquinas
Life Fitness), y ahí la misma máquina no pesa lo mismo: en abductores marcan 109 kg cuando en
Focus un hombre fuerte hace 55–60, y el entrenador puede con toda su pila. En las poleas pasa al
revés: la estación de Focus es de polea doble y marca casi el doble de lo que se jala.

El peso libre (barras, mancuernas, discos, peso corporal) pesa lo mismo en todos lados y no
tiene este problema.

## La idea

Cada cliente tiene una **sede**. Cada sede trae un **factor por máquina**: cuánto vale 1 kg de
esa máquina en Focus. Al calcular su nivel, sus kilos de máquina se pasan a "kilos de Focus" y
de ahí todo sigue igual. Focus es la sede base: sin factores.

- La clienta **sigue anotando y viendo sus kilos reales** en Registro, su historial y sus
  estadísticas de volumen. El factor solo entra al calcular el **nivel**: el mapa de fuerza, el
  camino de la fuerza, Amigos (comparar) y las batallas.
- El ranking de rachas no cambia: no usa pesos.

## Los factores de Smart Fit Barrancos

Sacados el 2026-10-27 comparando los registros de Said (Focus) con los de Said Armando (Smart
Fit). En peso libre Said le lleva 1.2 niveles en promedio (press de banca, press de hombro e
inclinado con mancuernas, curls, laterales); en cada máquina el factor es el que deja a Said
Armando 1.2 niveles debajo, salvo en las cuatro donde el entrenador cree que van parejos o que
él le gana un poco (+0.3 niveles): curl femoral acostado y sentado, crunch y pantorrilla sentado.

| Máquina (id) | Said en Focus (1RM) | Said Armando en Smart Fit (1RM) | Factor |
|---|---|---|---|
| `abductores-maquina` | 59 kg | 109 kg | 0.45 |
| `aductores-maquina` | 64 kg | 109 kg | 0.5 |
| `press-militar-maquina` | 34 kg | 49 kg | 0.6 |
| `pantorrilla-sentado` | 51 kg | 84 kg | 1 (salía 0.7) |
| `press-pecho-maquina` | 59 kg | 75 kg | 0.7 |
| `remo-sentado-polea` | 68 kg | 79 kg | 1 (salía 0.8) |
| `crunch-maquina` | 51 kg | 69 kg | 0.85 |
| `curl-femoral-acostado` | 42 kg | 57.5 kg | 0.9 |
| `extension-cuadriceps` | 88 kg | 82 kg | 1.0 |
| `jalon-agarre-abierto` | 87 kg | 83 kg | 1.0 |
| `face-pull` | 54 kg | 44 kg | 1.0 |
| `curl-femoral-sentado` | 53 kg | 57.5 kg | 1.05 |
| `fondos-maquina` | — | 92 kg | 0.93 (2026-10-27: el entrenador lo quiere en Fuerte, salía en 7.0) |
| `patada-gluteo-maquina` | 81 kg | 53 kg | 1 (salía 1.4) |
| `pullover-polea` | 70 kg | 44 kg | 1 (salía 1.5) |
| `extension-triceps-trasnuca-polea` | 48 kg | 27 kg | 1 (salía 1.55) |
| `extension-triceps-polea` | 76 kg | 40 kg | 1 (salía 1.85) |
| `extension-triceps-cuerda` | 71 kg | 30 kg | 1 (salía 2.2) |

**Poleas en 1 por ahora (entrenador, 2026-10-27).** En tríceps y pullover Said mueve 2.4 veces lo
de Said Armando, cuando en peso libre le saca 1.1–1.3 veces. Una explicación es que la estación de
Focus es de polea doble (marca de más) y la de Smart Fit carga directo, pero no está verificado y el
face pull, también en polea, salió parejo. Quedan en 1 hasta que el entrenador lo compruebe en
Smart Fit (si tiene polea doble, o haciendo su tríceps con cuerda allá).

**También en 1 por ahora (entrenador, 2026-10-27):** pantorrilla sentado, remo sentado en polea y
patada de glúteo en máquina; no le convencen los factores calculados.

Lo que no está en la tabla va en 1 hasta tener datos de los dos gimnasios (pec deck, rear delt y
fondos en máquina solo los ha hecho Said Armando). Son de una persona por gimnasio: se afinan
cuando haya más registros.

## Datos

- `sedes/{id}`: `{ nombre, factores: { [ejercicioId]: number } }`. Lo escribe un script desde
  `docs/sedes/sedes.json` (como los estándares); lo leen todos los que tienen sesión, como el
  banco. Focus Novum (`focus-novum`) va sin factores.
- `clientes/{id}.sede`: id de la sede. Opcional: sin campo es Focus, así que nadie cambia hasta
  que el entrenador le asigne otra.
- Lo asigna el entrenador en la ficha del cliente (app), con un selector de sede. La clienta no
  lo ve ni lo cambia.

## Cómo se aplica

Una función gemela en web y en functions: `sesionesEnSede(sesiones, factores)` multiplica el
peso de cada serie por el factor de su ejercicio, y se llama justo antes de `fuerzaPorMusculo` /
`nivelesPorMusculo` y de los cálculos de la batalla. Así no se toca la fórmula del nivel, y cada
persona usa su propia sede: en una batalla Focus contra Smart Fit cada quien entra con la suya.

**Limitación:** la sede es del cliente, no de cada sesión. Si alguien se cambia de gimnasio, su
historial anterior se recalcula con la sede nueva. Para dos gimnasios fijos basta; si un día hace
falta, se le pone la sede a cada sesión.

## Aparte (no es de sedes)

Comparando las máquinas de Focus de Said con su peso libre, cuatro estándares de Focus parecen
muy exigentes: abductores, press militar en máquina, crunch en máquina y pantorrilla sentado
(sale entre 2.4 y 3.6 cuando en lo demás está en 6–7.5). Se revisan por separado, como la prensa
en máquina.
