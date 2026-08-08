# Onboarding

Tu primer día. Esta guía es el mapa: qué existe, por qué está separado como está, y cómo levantar el stack de
punta a punta. Cuando esto encaje, el resto de guías rellenan el detalle.

## Qué es Plitzi, en concreto

Un **space** es la unidad de todo. Es un árbol de elementos (su *schema*), un conjunto de estilos y los data
bindings entre ambos — versionado, con dueño, y compartible con colaboradores.

Cuatro superficies actúan sobre ese mismo space, y cada repositorio existe para servir a alguna:

| Superficie | Qué hace |
|---|---|
| **Builder** | Una persona edita el space visualmente |
| **SDK** | El space se renderiza en un navegador |
| **SSR** | El space se sirve público, renderizado en el servidor |
| **MCP** | Un agente de IA lee y edita el space |

Lo demás es fontanería. Cuando te pierdas en un stack trace, pregúntate en cuál de las cuatro estás.

## El mapa

Plitzi **no es un repositorio**. El monorepo que estás leyendo es el frontend y los servidores de páginas/IA; el
backend — la base de datos, la API y todas las credenciales — es un repo aparte. Esta es, con diferencia, la
mayor fuente de «¿dónde está este código?».

Clónalos como **hermanos en un mismo directorio** (ver [Portales](#portales-y-la-estructura-hermana) más abajo:
los enlaces entre ellos son rutas absolutas).

| Repositorio | De qué es dueño | Lo tocas cuando |
|---|---|---|
| **plitzi-workspace** (este) | Builder, SDK, servidor SSR/RSC, servidor MCP y los paquetes `sdk-*` | Edición, renderizado, elementos, estilos, interacciones |
| **plitzi-sdk-server** | API REST, GraphQL, el kernel de auth y el RBAC, Prisma/MySQL, MongoDB, Redis y el gateway de desarrollo | Persistencia, permisos, tokens, cualquier cosa que devuelva 401/403 |
| **plitzi-ui** | El design system con el que está construido el builder | Componentes de UI compartidos |
| **nexus** | El store de estado (`@plitzi/nexus`), en su propio repositorio | Interioridades del store, reactividad, rendimiento |
| **plitzi-cli** | Herramientas de línea de comandos | Scaffolding y flujos locales |
| **plitzi-plugin-template** | Punto de partida para un plugin de terceros | Escribir o depurar un plugin |
| **plitzi-platform** | Cluster (k3s + ArgoCD) y Terraform | Despliegues, configuración del cluster, secretos |

## Dentro del monorepo

```
apps/
  builder/   @plitzi/plitzi-builder   el editor visual
  sdk/       @plitzi/plitzi-sdk       el runtime que renderiza un space
  server/    @plitzi/sdk-server       servidor de páginas: SSR, RSC, plugins, conectores
  mcp/       @plitzi/sdk-mcp          la superficie de IA, construida sobre apps/server
packages/
  sdk-*                               librerías compartidas, consumidas por las apps y entre sí
```

`apps/mcp` se apoya en `apps/server`: un despliegue que solo renderiza páginas nunca lo instala. Esa separación
es deliberada — mantenla al añadir código.

Los paquetes se retienen mejor agrupados por **para qué sirven** que en orden alfabético:

| Grupo | Paquetes | De qué se ocupa |
|---|---|---|
| El space en sí | `sdk-schema`, `sdk-style`, `sdk-elements` | Qué *es* un space: su árbol, sus estilos, sus componentes |
| Comportamiento en runtime | `sdk-interactions`, `sdk-variables`, `sdk-navigation`, `sdk-auth` | Qué *hace* un space ya renderizado |
| Fontanería | `sdk-shared`, `sdk-plugins`, `sdk-event-bridge`, `sdk-dev-tools` | Tipos y utilidades, sistema de plugins, mensajería entre frames, depuración |

## Primer día

### Camino A — contribuidor

Si trabajas en UI, elementos o paquetes del SDK, **no** necesitas backend local: en modo dev las apps apuntan a
servidores de desarrollo compartidos. Sigue [Primeros pasos](./getting-started.md) y
[Configuración local](./local-setup.md), y para ahí.

### Camino B — stack local completo

Necesario para tocar persistencia, auth, la API o cualquier cosa que deba sobrevivir a un reload. Empieza por el
backend, porque es quien tiene las bases de datos y acuña las credenciales que el frontend necesita.

**1. Backend** — en [plitzi-sdk-server](https://github.com/plitzi/plitzi-sdk-server), sigue su README:
certificados con mkcert, entradas en `/etc/hosts`, `yarn db:up`, y después schema y datos de seed. Luego:

```bash
sudo yarn start          # gateway en :443, enrutando cada rol por sub-dominio
```

| URL | Rol |
|---|---|
| `https://server.plitzi.local` | GraphQL, subscriptions, WS de tiempo real — con quien habla el builder |
| `https://api.plitzi.local` | API REST |
| `https://mcp.plitzi.local` | MCP e IA |
| `https://ssr.plitzi.local` | SSR |

Escuchar en `:443` requiere privilegios; `GATEWAY_PORT=8443 yarn start` evita el `sudo` a cambio de arrastrar un
puerto en cada URL.

**2. Credenciales** — todavía en `plitzi-sdk-server`:

```bash
yarn token                     # lista los spaces, con el owner de cada uno
yarn token 1 --user admin      # imprime ambas credenciales del space 1
```

Pega los dos valores en `apps/builder/index.html` (`webKey` y `userKey`). Ver
[Las dos credenciales](#las-dos-credenciales).

**3. Frontend** — de vuelta en este repositorio:

```bash
yarn install
yarn start                     # Turborepo levanta todas las apps en paralelo
```

| URL | App |
|---|---|
| `https://app.plitzi.local:3000` | Builder |
| `https://app.plitzi.local:3001` | SDK |

## Las dos credenciales

El builder necesita dos, y responden a preguntas distintas:

- **`webKey`** es un *space token*. Dice **qué** space, y está atado a los dominios que declara. El token
  público de render es de solo lectura por construcción: va embebido en sitios publicados, así que no puede ser
  más fuerte.
- **`userKey`** es una *sesión*. Es el **actor**, y toda escritura pasa por `can(actor, space, permission)`. Con
  solo un `webKey`, el builder carga y no puede guardar nada.

Tres cosas que se llevan por delante a todo el mundo el primer día:

1. **El `--user` tiene que ser miembro del space.** Si no, la sesión autentica y luego toda escritura se refuta
   — y eso se lee como token roto, no como cuenta equivocada. `yarn token` imprime el owner de cada space al
   lado; emparéjalos.
2. **Primero sembrar, después acuñar.** El seed reescribe las filas de `space_token` solo con dominios de
   producción, así que un token acuñado antes de sembrar deja de funcionar desde `localhost`.
3. **Un token acuñado en un entorno se rechaza en otro.** Cada despliegue firma bajo su propio issuer. Es el
   diseño, no un fallo — ver la documentación de auth.

El modelo completo — los cinco tipos de credencial, RBAC, binding por dominio, iframes, entornos y
self-hosting — está en [RFC 0010](../rfc/0010-unified-auth-and-rbac.md) (en inglés) y, como lectura con
diagramas, en `docs/auth/ecosystem.html` del repo del servidor (ábrelo en el navegador; es autocontenido).

## Portales y la estructura hermana

Dentro de este monorepo los paquetes se resuelven con `workspace:*` de Yarn: editas un paquete y las apps lo ven
al instante.

**Entre repositorios es distinto.** `plitzi-sdk-server` consume todos los paquetes `sdk-*`, ambos servidores, el
SDK, el builder y `plitzi-ui` mediante **portales** de Yarn — enlaces directos a carpetas en disco, para no
tener que publicar mientras desarrollas. Dos consecuencias:

- Las rutas de los portales son **absolutas**. Mantén cada repositorio como hermano dentro de un mismo
  directorio padre, o edita el bloque `resolutions` de `plitzi-sdk-server/package.json` para que cuadre con tu
  estructura.
- Un portal enlaza el **build** del paquete, no su código fuente. Tras cambiar un paquete que consume
  `plitzi-sdk-server`, ejecuta `yarn build:dev` (en el monorepo) o el servidor seguirá corriendo el código
  viejo — unos minutos muy confusos la primera vez que pasa.

## Convenciones

El código y los comentarios se escriben en **inglés**; la conversación del equipo puede ser en español. La
documentación es en inglés por defecto, y los RFC siempre en inglés.

Las reglas que importan — formato, imports, estrictez de TypeScript, estructura de componentes — están en
[claude.md](../../claude.md) en la raíz del repositorio, resumidas en [Desarrollo](./development.md). Cada
repositorio lleva su propio `CLAUDE.md`: léelo antes de tu primer commit allí, porque las convenciones no son
idénticas (el servidor tiene sus propias reglas de espaciado y tipado).

Antes de abrir un PR: `yarn typecheck`, `yarn lint` y tests para el comportamiento que cambies.

## Qué leer después

| Cuando quieras | Lee |
|---|---|
| Ejecutar algo | [Primeros pasos](./getting-started.md) · [Configuración local](./local-setup.md) |
| La organización en detalle | [Estructura del repositorio](./repository-structure.md) |
| Comandos y estilo | [Desarrollo](./development.md) |
| Por qué la arquitectura es como es | [RFCs](../rfc/README.md) — los marcados *Implemented* describen el sistema tal como está hoy |
| Publicar un cambio | [Publicaciones](./releases.md) |
| Conectar un CMS externo | [Conectores y elementos de contenido](./connectors.md) |
| La API del servidor de páginas | [apps/server/README.md](../../apps/server/README.md) |
| La superficie de IA | [apps/mcp/README.md](../../apps/mcp/README.md) |

Empieza por los RFC implementados. El [0008](../rfc/0008-data-providers-and-collections-removal.md) explica cómo
llegan los datos a un space, el [0009](../rfc/0009-cms-presentation-elements.md) cómo se presentan, y el
[0010](../rfc/0010-unified-auth-and-rbac.md) quién tiene permiso para hacer nada de eso. Entre los tres cubren
casi todo lo que, si no, se aprende a base de sorpresas.
