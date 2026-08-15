# Pruebas

Dos runners, con una línea clara entre ellos.

| | Runner | Dónde | Para qué sirve |
|---|---|---|---|
| Unitarias / integración | Vitest | junto al código que prueban | Una función, un hook, un componente, un handler de servidor — todo lo que se decide sin navegador |
| End to end | Playwright | [`e2e/`](../../e2e) | Lo que una persona abre: los examples, el SDK renderizando dentro de ellos, el builder |

```bash
yarn test          # la suite de Vitest de cada paquete
yarn e2e           # la suite de navegador, para todo el monorepo
```

## Unitarias — Vitest

Co-localizadas con el código (`Component.test.tsx` junto a `Component.tsx`), con `@testing-library/react` para
todo lo que renderiza. La suite de un solo paquete: `yarn workspace @plitzi/<nombre> test`.

Cubre casos límite, re-renders, fugas y rendimiento — no solo el camino feliz.

## End to end — Playwright

Una sola suite en la raíz del repositorio, porque lo que prueba es el repositorio y no una app concreta. El
detalle completo está en [`e2e/README.md`](../../e2e/README.md); la versión corta:

```bash
yarn e2e:install               # descarga el navegador, una vez tras clonar
yarn e2e                       # corre todo — los servidores se levantan solos
yarn e2e --project=server      # una app, y solo los servidores que necesita
yarn e2e:ui                    # verlo ocurrir, y retroceder por cada acción
yarn e2e:report                # abre el último informe
```

### Categorías

**Una categoría por app, y sub-categorías dentro** — una lista plana de cada feature deja de ser legible mucho
antes de estar completa.

| Categoría | App | Sub-categorías |
|---|---|---|
| `sdk` | `@plitzi/plitzi-sdk` | `rendering`, `viewports` |
| `server` | `@plitzi/sdk-server` | `ssr`, `rsc`, `preview`, `auth` |
| `mcp` | `@plitzi/sdk-mcp` | `endpoint` |
| `builder` | `@plitzi/plitzi-builder` | `boot` (con gate) |
| `cross` | más de una app | `parity`, `agent`, `auth` |
| `examples` | — | una por example |

Los dos niveles se direccionan: `yarn e2e --project=server` para la app, `yarn e2e tests/server/rsc` para una parte.

Todas salvo `examples` corren contra **superficies propias de la suite**: un harness de navegador que renderiza
cualquier schema, un servidor de páginas con pages, RSC, preview y MCP encendidos a la vez, y un segundo con
cuentas y sesiones. Los examples no son esas superficies — están escritos para una persona, una decisión de
cableado cada uno, y torcer uno para que un test sea posible rompe justo lo que ese example existe para enseñar.

**La categoría `examples` tiene su propio trabajo.** Un example al que se manda a un usuario nuevo es una promesa,
y una promesa que nadie comprueba es una promesa que se rompe. Cada uno tiene un spec que afirma lo que dice su
README, así que un cambio que rompa en silencio lo primero que ejecuta un usuario nuevo falla aquí y no en su
terminal.

### Verlo ocurrir

`yarn e2e:ui` es el que hay que usar: eliges tests, los ves correr y retrocedes por cada acción con el DOM tal
como estaba en ese instante. `yarn e2e:headed` corre en una ventana visible, `yarn e2e:debug` abre el Inspector y
`yarn e2e:codegen` convierte tus clics en código de spec.

Ábrelo acotado — `yarn e2e:ui --project=server` — porque el filtro de proyectos de Playwright arranca sobre uno
solo, y una ventana sin acotar parece vacía en vez de filtrada.

### Lo que solo se ve en un navegador

Más allá de "el texto correcto está en la página", cada spec comprueba propiedades que solo tiene un documento ya
maquetado: imágenes que de verdad cargaron, ausencia de desbordamiento horizontal, texto que no está pintado del
color de lo que tiene detrás, ningún elemento con contenido colapsado a cero — y falla ante cualquier error de
consola o rechazo no capturado, porque React convierte un efecto que falla en un error de consola y deja en
pantalla el último árbol bueno.

**No hay baselines de screenshot en git.** Las capturas se escriben en `e2e/.artifacts/screenshots/` para
mirarlas; lo que decide si un run pasa son las aserciones que significan lo mismo en cualquier máquina.

Una regla que conviene saber antes de escribir un spec: **afirma sobre clases, nunca sobre `data-id`.** Esos
atributos son solo de servidor — existen para que la hidratación encuentre lo que renderizó el servidor — así que
una comprobación escrita contra ellos pasa en SSR y parece un renderer roto en todo lo demás.

### Renderizar un schema cualquiera

`e2e/harness` es una página que renderiza el `{ schema, style }` que se le pase, sin backend y sin cuenta:

```bash
yarn workspace @plitzi/e2e start    # http://127.0.0.1:4100
```

Úsalo para reproducir un schema reportado o para mirar una variante sin tocar un example — modificar un example
para responder una pregunta rompe justo lo que ese example existe para demostrar.

## Antes de abrir un PR

```bash
yarn typecheck
yarn lint
yarn test
yarn e2e
```

## Ver también

- [Desarrollo](./development.md) — stack, comandos, flujo de contribución
- [`e2e/README.md`](../../e2e/README.md) — targets, gates, fixtures, cómo añadir un spec
- [`examples/README.md`](../../examples/README.md) — los examples que la suite comprueba
