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
