# REGLA DE ORO — Contexto del proyecto vía graphify
Siempre que necesites investigar el contexto de este proyecto (arquitectura, dónde está algo, qué llama a qué, cómo funciona X, relaciones entre archivos, etc.), tu PRIMERA opción es el grafo de graphify, antes de usar Grep, Glob, Read, Explore o cualquier otra búsqueda.

1. El grafo está en `graphify-out/graph.json`.
2. Consulta el grafo primero (`graphify query "<pregunta>"`, o los comandos query/path/explain del skill graphify) y apóyate en ese resultado.
3. Solo si el grafo no cubre lo que necesitas o parece desactualizado, recurre a la búsqueda tradicional en el código. En ese caso di que el grafo no bastó y, si conviene, sugiere regenerarlo con `/graphify . --update`.
4. Nunca empieces explorando archivos a ciegas.
