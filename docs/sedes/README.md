# Sedes

Los gimnasios donde entrenan las clientas y cuánto vale 1 kg de cada máquina suya en
**Focus Novum**, el gimnasio donde se calibraron los estándares de fuerza. Diseño:
`docs/superpowers/specs/2026-10-27-sedes-gimnasio-design.md`.

- `sedes.json`: id de la sede → `{ nombre, factores: { [ejercicioId]: factor } }`. Una máquina
  que no está en `factores` vale lo mismo que en Focus (×1). Solo cuentan los ejercicios de peso.
- Se carga a Firestore (`sedes/{id}`) con `node scripts/cargarSedes.mjs` desde `functions/`
  (`--prueba` solo valida). Reemplaza los factores de cada sede: lo que se quite del archivo se
  quita del banco.
- A cada cliente se le asigna la sede en su ficha de la app (`clientes/{id}.sede`); sin sede
  cuenta como Focus Novum.

## Smart Fit Barrancos: la estación de poleas

Los 15 ejercicios de la estación de poleas (los de `POLEA_DOBLE` en
`docs/estandares-fuerza/proponer.py`: extensiones de tríceps, face pull, curl en polea, cruce y
aperturas en polea, pullover, crunch y giro en polea, etc.) llevan ×1.384: 1 kg de esa polea vale
1.384 kg de la de Focus, que es doble. Se tomó de Said Armando (82 kg, 22): con 35 kg × 8 en face
pull queda justo al inicio de Avanzado (entrenador, 2026-10-28; antes ×1.863, que ponía a Bogue a
media banda de Fuerte). Los jalones y el remo sentado en polea no cuentan como esa estación.
