# Últimas entradas a la web, con hora y teléfono

**Aprobado por el entrenador (2026-10-10).** Plan: `docs/superpowers/plans/2026-10-10-ultimas-entradas.md`.

> "desde mi app de administrador, quiero además de poder ver la última vez que cada cliente
> abrió la web, quiero poder ver las últimas 5 y desde que dispositivo se hizo, es decir con
> que diga iPhone o android me basta [...] y la hora exacta"

## Contexto y problema

Hoy la tarjeta "Acceso web" de la ficha muestra "14 entradas · ayer" (`TextoEntradas.resumen`).
Los dos datos (`entradas` y `ultimoAcceso` en `accesosWeb/{token}`) los anota la función
`sesion` con `contarEntrada` **al canjear el link**.

Desde el punto 5 del backlog (2026-10-10), la página instalada en el inicio ya no canjea:
entra con su sesión guardada. Esas aperturas **ya no se anotan**, así que el contador cuenta
de menos para quien la tiene instalada. Armar las últimas 5 sobre el canje tendría el mismo
hueco.

## Objetivo

En la ficha de cada clienta, las **últimas 5 veces que abrió su página**, cada una con la
**hora exacta** (horario de Mazatlán) y el **teléfono** (iPhone o Android). El contador y la
"última vez" que ya existen pasan a contar todas las aperturas, también las de la página
instalada.

Decidido por el entrenador: **no** se distingue si la abrió desde el ícono instalado o desde el
navegador.

## Diseño

### 1. La página avisa al abrirse

En `main.ts`, en cuanto la sesión está lista (después de `credencialLista()`), la web llama
**una vez por carga** a la callable nueva `registrarEntrada` con
`{ plataforma: plataforma(navigator.userAgent) }` (la misma función que ya usa el registro de
teléfonos para notificaciones: `"ios"`, `"android"` u `"otro"`).

- **Sin esperarla:** no bloquea nada de lo que ve la clienta. Si falla (sin señal, función
  dormida), no se le muestra nada; esa apertura simplemente no queda anotada.
- La callable se declara en `acciones.ts`, como las demás.

### 2. Función `registrarEntrada`

Callable en `REGION` (`us-west1`). El cliente sale de `clienteDeLaSesion` (así una sesión
revocada no anota nada). Busca su `accesosWeb` por `clienteId` y, en una transacción:

- `entradas` + 1 y `ultimoAcceso` = ahora (como hacía `contarEntrada`);
- agrega al principio de `ultimasEntradas` un `{ cuando, plataforma }` y deja solo las 5 más
  recientes.

`cuando` es la hora del servidor (`Timestamp.now()` dentro de la transacción), no la del
teléfono: así es exacta aunque el reloj del teléfono esté mal. `plataforma` se valida: lo que
no sea `"ios"` o `"android"` se guarda como `"otro"`.

Lo puro (agregar y recortar a 5, validar la plataforma) vive en una función aparte con tests.

### 3. `sesion` deja de contar

Si `sesion` siguiera contando al canjear, una apertura desde WhatsApp contaría dos veces (el
canje y el aviso de la página). Así que `sesion` deja de llamar a `contarEntrada`, y
`registrarEntrada` pasa a ser el único que cuenta. Bonus: `sesion` responde un poco antes,
porque ya no espera esa escritura (era una de las ideas pendientes del punto 5).

`contador.ts` se reemplaza por la lógica nueva (o se queda solo con lo que se reutilice).

### 4. Datos

En `accesosWeb/{token}`, campo nuevo:

```
ultimasEntradas: [{ cuando: Timestamp, plataforma: "ios" | "android" | "otro" }]  // máx. 5, la más reciente primero
```

Sin cambios en reglas: `accesosWeb` solo lo lee el entrenador y lo escribe el Admin SDK.

En la app, `AccesoWeb` agrega `ultimasEntradas: List<EntradaWeb> = emptyList()`, con
`EntradaWeb(cuando: Timestamp?, plataforma: String)` y valores por defecto, por la regla de
siempre de Firestore.

### 5. La ficha en la app

En la tarjeta "Acceso web", debajo de "14 entradas · hoy", un bloque **"Últimas entradas"**:

```
Últimas entradas
10 oct, 7:42 pm · iPhone
10 oct, 9:15 am · iPhone
9 oct, 8:03 pm · Android
```

- Hora en `SincronizadorDiaWeb.ZONA` (Mazatlán), formato de 12 horas.
- `"otro"` se muestra como "Otro dispositivo" (una computadora, por ejemplo).
- Sin entradas registradas todavía, el bloque no aparece.
- El texto de cada renglón sale de una función pura en `TextoEntradas`, con test JVM.

## Lo que hay que saber

- **Lo pasado no se recupera:** la lista empieza vacía y se llena desde que se publique.
- **Una recarga cuenta como otra entrada**, igual que hoy con el canje.
- **El contador cambia de significado:** antes contaba canjes del link; ahora cuenta aperturas
  de la página. Hay que actualizar los comentarios de `AccesoWeb.entradas`,
  `TextoEntradas` y `contador.ts`, que explican lo de los canjes.
- **Costo:** una llamada a función y una escritura por apertura. Muy dentro de la capa gratuita.

## Orden de despliegue

1. Función `registrarEntrada` (por nombre).
2. Web (empieza a avisar).
3. `sesion` sin contar (por nombre). Hasta este paso, una apertura desde WhatsApp cuenta doble
   unos minutos; no importa.
4. App con el bloque "Últimas entradas".

## Fuera de alcance

- Distinguir página instalada de navegador (decisión del entrenador).
- Modelo exacto del teléfono o versión del sistema.
- Historial completo de entradas: solo las últimas 5.
