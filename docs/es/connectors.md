# Conectores y elementos de presentación de contenido

Guía práctica para entender y usar los **conectores** de Plitzi: la vía declarativa para leer (y opcionalmente
escribir) en un CMS externo, más los elementos que convierten esos datos en páginas publicables.

Cubre lo que se introdujo en los commits *"removed collections completely in favor to external CMS"* y
*"added Space Connector and more changes"*, y lo desarrollado en los RFCs
[0008](../../rfc/0008-data-providers-and-collections-removal.md) y
[0009](../../rfc/0009-cms-presentation-elements.md).

---

## 1. Por qué existen los conectores

Plitzi es la **capa de presentación** de un CMS headless. No guarda, modela ni edita contenido: eso es trabajo del
CMS. Lo que sí hace es conectarse a él, traer sus registros y renderizarlos.

El problema que resuelven los conectores:

- Antes existía **Collections**, un backend propio de contenido. Se eliminó por completo (commit `de367118`) porque
  duplicaba el trabajo de un CMS.
- Quedaba un solo camino de datos: un elemento *provider* resuelto en el **servidor** por un **manifest declarativo**
  de conector.

La idea central:

> **Un conector es *data*, no código.** Todo lo que se necesita para hablar con un CMS (endpoint, auth, forma de la
> respuesta, filtros, paginación, escritura) está declarado en un documento JSON que interpreta un *engine* genérico.
> Conectar un CMS nuevo — o arreglar uno que cambió su API — es editar un documento, nunca desplegar código.

---

## 2. El manifest: qué es y para qué sirve

El `ConnectorManifest` (`apps/server/src/modules/connectors/types.ts`) es el contrato declarativo que describe cómo
hablar con un backend concreto. El *engine* (`engine.ts`) no sabe nada de Strapi ni de WordPress: lee el manifest,
resuelve plantillas y construye la petición.

Campos principales:

| Campo | Finalidad |
|-------|-----------|
| `id` | Identifier del conector (lo referencia el elemento `ApiContainer`). **No se autora**: lo estampa el adapter al leer la fila |
| `credential` | Identifier de la credencial a resolver. El secreto **nunca** forma parte del manifest |
| `baseUrl` | Origen de la API |
| `auth` | Esquema de autenticación: `in` (`header`\|`query`), `name`, `value` (plantilla, p. ej. `Bearer {{credential.token}}`) |
| `headers` | Cabeceras estáticas con valores plantilla |
| `endpoints.list` | Cómo se leen registros: `path`, `query`, `itemsPath`, `totalPath`, `idPath`, `valuesPath` |
| `endpoints.write` | Operaciones de escritura declaradas (`create`/`update`/`delete`). **Ausente = read-only** |
| `pagination` | `offset` \| `page` \| `cursor` |
| `operators` | Plantillas de filtro por operador, p. ej. `eq: 'filters[{{field}}][$eq]={{value}}'` |
| `media` | `baseUrl` para rebasear URLs de media relativas (`/uploads/x.jpg` → absolutas) |
| `fields` | Nombres y tipos de campo; la **única** parte del manifest que ve el navegador (alimenta bindings tipados) |
| `projection` | `'full'` como escape: sirve el slice completo sin proyectar |

### Por qué es seguro

- El manifest es **estado del servidor**: nombra endpoints y esquemas de auth y nunca llega al navegador.
- Al cliente solo le baja el `identifier` del conector y sus `fields`.
- La credencial se referencia por identifier pero se resuelve en el servidor.
- Un conector es read-only hasta que su manifest declara `write`; una acción no declarada se **rechaza**, no se adivina.

### Por qué las llamadas van bajo `endpoints`

`list` y `write` describen **peticiones**; `auth`, `headers`, `operators` y `media` describen la **conexión** y
aplican a todas. En plano las dos clases se leen como iguales y no hay sitio evidente donde añadir la siguiente
operación, así que las peticiones viven agrupadas bajo `endpoints`.

Los manifests escritos antes de ese cambio (con `list`/`write` en la raíz) se siguen leyendo: `normalizeManifest`
(`packages/sdk-shared/src/connectors/`) los sube a `endpoints` al leerlos, y el builder guarda ya la forma nueva, así
que el arreglo se apaga solo.

### Presets

El builder trae documentos de partida (`apps/builder/src/modules/Connectors/presets.ts`): **Strapi v5**, **WordPress
REST**, **Directus**, **Contentful CDA** y **Blank**. Son documentos, no adaptadores: rellenan el editor y cada campo
sigue siendo editable. Un preset obsoleto se corrige editando una fila, nunca con un release.

---

## 3. Arquitectura: las piezas

```
                       ┌─────────────────────────── B U I L D E R ───────────────────────────┐
                       │  Panel "Connectors"  ──  presets  ──  editor JSON del manifest     │
                       │  Credenciales (CMS / Custom API) ── SpaceCredentialForm            │
                       └───────────────┬─────────────────────────────────────────────────────┘
                                       │  GraphQL: SpaceConnectors + add/update/remove
                                       ▼
                       ┌──────────────────────────── S E R V E R ────────────────────────────┐
                       │  engine.ts ── fetchConnectorRecords / writeConnectorRecord           │
                       │  resolver.ts ── puente del elemento hacia el engine                  │
                       │  projection.ts ── recorta el slice a lo que la página bindea         │
                       │  resolveRscData.ts ── resuelve cada elemento runtime:"server"        │
                       │  rsc/handler.ts ── /_rsc (refresh, ?location=)                       │
                       │  actions/handler.ts ── POST /_action (escrituras)                    │
                       └───────────────┬─────────────────────────────────────────────────────┘
                                       │  payload RSC (serverData) / respuestas
                                       ▼
                       ┌────────────────────────────── S D K ───────────────────────────────┐
                       │  ApiContainer (provider) ── publica el slice como fuente de bindings│
                       │    ├─ List (source: controlled) ── itera records                     │
                       │    ├─ Pagination ── UI sobre pageInfo                                │
                       │    └─ RichText ── cuerpo del CMS saneado                             │
                       └─────────────────────────────────────────────────────────────────────┘
```

### Servidor — `apps/server/src/modules/connectors/`

- **`engine.ts`**
  - `fetchConnectorRecords`: construye la URL resolviendo plantillas (Twig) con `credential`, `resource`,
    `routeParams`, `queryParams`, `limit/offset/page/cursor`; aplica filtros vía plantillas de operadores;
    normaliza la respuesta a `{ records, pageInfo }`; hace `rebaseMedia` de rutas relativas.
  - `writeConnectorRecord`: create/update/delete **solo si** el manifest declara la acción.
- **`resolver.ts`** — `createConnectorResolver`: lee los atributos del elemento (`connector`, `resource`,
  `singleRecord`, `filters`, `pagination`, `pageParam`…), resuelve manifest + credencial en el servidor y devuelve el
  slice que el elemento publicará. Un elemento sin conector resuelve a `undefined` (es un borrador, no un error).
- **`projection.ts`** — `collectBoundPaths` + `projectSlice`: reduce el slice a los caminos que la página realmente
  lee (privacidad y tamaño). `pageInfo`, `isEmpty`, `hasError` y `errorMessage` se conservan siempre.
- **`resolveRscData.ts`** — matchea la URL contra `schema.pages` (mismo matcher que el router cliente), extrae
  `routeParams` y resuelve en paralelo cada elemento `runtime: 'server'` del subtree, con timeout por elemento y
  aislamiento de fallos.
- **`rsc/handler.ts`** — `GET /_rsc`: reescribe la petición con `?location=` para resolver la página correcta en los
  refrescos cliente.
- **`actions/handler.ts`** — `POST /_action`: el navegador envía `{ elementId, action, recordId, values }`; el
  servidor valida que el elemento sea `runtime: 'server'`, tenga conector y que el conector declare la acción.

### Builder — `apps/builder/src/modules/Connectors/`

- **`Connectors.tsx`** — panel de gestión (listado + formulario + confirmación de borrado). Avisa cuando el space no
  tiene despliegue con SSR: un conector se resuelve en el servidor, y sin servidor no se resuelve en ningún sitio.
- **`ConnectorsContextProvider.tsx`** — carga `SpaceConnectors` vía SWR y sincroniza al store del builder (para que el
  inspector de elementos vea los conectores y sus operadores). Cada mutación revalida la query, así que el panel no
  puede quedarse mostrando otra cosa. También publica `hasServerRendering`, derivado de si algún `SpaceDeployment`
  usa credencial `ssr`.
- **`components/ConnectorForm/`** — nombre + preset + dos modos sobre el **mismo documento**:
  - **Basic** (`ConnectorBasicEditor`): formulario por secciones — conexión, autenticación, lectura, paginación,
    filtros, media, escrituras — con una línea de explicación por campo (`helpers/manifestDoc.ts`).
  - **Advanced** (`ConnectorAdvancedEditor`): el JSON tal cual se guarda, para el proveedor que no encaja.
  Cambiar de modo no convierte nada; se valida al guardar (`helpers/validateManifest.ts`).
- **`components/TokenInput/`** — campo de una línea con autocompletado de los tokens del engine
  (`getConnectorTokens`, en sdk-shared). Es la parte que un autor no puede adivinar: `{{offset}}` vs `{{page}}`
  decide si la paginación funciona.
- **Credencial**: se elige con `SpaceCredentialSelectorModal` filtrado a `custom`; el manifest solo guarda su
  identifier.
- GraphQL: `SpaceConnectorsQuery`, `SpaceAddConnectorMutation`, `SpaceUpdateConnectorMutation`,
  `SpaceRemoveConnectorMutation`.

### Builder — `apps/builder/src/modules/Credentials/`

Panel propio (icono llave) para crear, listar y borrar credenciales sin pasar por el modal de otra cosa. Un conector
necesita ese orden: el token del CMS tiene que existir **antes** de que haya un manifest que lo referencie.

### Elementos SDK

- **`ApiContainer`** — el *provider*. Ver sección 4.
- **`List`** (source `controlled`) — el repetidor: una plantilla por registro bajo scope `item`. No hay repeater
  nuevo; este ya es.
- **`Pagination`** — UI pura sobre cualquier `pageInfo`. Ver sección 5.
- **`RichText`** — cuerpo de CMS. Ver sección 5.

---

## 4. Cómo funciona el ApiContainer

Es el elemento que obtiene datos y los publica como fuente de bindings para sus descendientes. **Un elemento, dos
modos**, elegidos en Settings con **Data Source** (`definition.runtime`):

| Data Source | Dónde se resuelve | Uso típico |
|-------------|-------------------|------------|
| `Browser request` (`client`) | Fetch en el navegador | APIs públicas, JSON genérico, mocks |
| `Connector (server-side)` (`server`) | En el servidor vía conector + credencial | CMS autenticados, secretos, SSR |

### Ciclo de vida en runtime (`ApiContainer.tsx`)

1. **Identidad** — `useElement()` da `id`, `idRef`, `runtime`. El nombre de fuente es `apiContainer_<idRef>`;
   todo lo que bindean los hijos cuelga de ahí.
2. **Obtención del dato**
   - **Server**: `useRscData()` lee `serverData[id]` de `RscContext` (payload del SSR o de un refresh `/_rsc`).
     El dato ya viene resuelto por el servidor (manifest + credencial + filtros + routeParams + paginación +
     proyección).
   - **Client**: `queryCompiled` resuelve la plantilla con `routeParams`/`queryParams` y `useApi` hace el fetch.
3. **El slice publicado (el contrato)**

   ```jsonc
   {
     "records": [ { "id": "1", "values": { … } } ],   // modo list
     "record":  { "id": "1", "values": { … } },       // modo singleRecord
     "pageInfo": { "hasNextPage": true, "hasPrevPage": false, "from": 0, "to": 10,
                   "total": 42, "page": 1, "pageCount": 5, "nextCursor": "", "prevCursor": "" },
     "isLoading": false,
     "isEmpty": false,
     "hasError": false,
     "errorMessage": ""
   }
   ```

   Se monta con un `StoreProvider` (`{ runtime: { sources: { apiContainer_<idRef>: slice } } }`) y
   `useRegisterSource` publica los `SourceField`s para el autocomplete de bindings. `isEmpty`/`hasError`/`isLoading`
   existen para autorar estados vacíos con bindings normales — sin slot mechanism.
4. **Paginación** — `useProviderPagination` maneja los modos `url`/`append`/`none` (ver sección 6).
5. **Interacciones** — callbacks `performQuery`, `loadMore`, `goToPage`; en modo server también `createRecord`,
   `updateRecord`, `removeRecord` (que hacen `POST /_action`). Triggers `onApiSuccess` / `onApiError`.
6. **Render** — `<RootElement tag={subType}>` envuelve un `<StoreProvider>` con los children.

### Cómo sabe que debe esperar el RSC

1. **El flag compartido.** El autor pone `runtime: 'server'` en Settings. Ese mismo flag usa el servidor
   (`resolveRscData`) para decidir qué elementos resolver, y el elemento (`serverMode = runtime === 'server'`) para
   decidir qué leer. No hay "espera": `useRscData` siempre lee `RscContext` y re-renderiza cuando `serverData` cambia.
2. **La forma del payload distingue los casos** (`ApiContainer.tsx:178-204`):
   - `serverData === undefined` → RSC nunca cargó (builder o `schema.rsc.enabled` false) → **mock**.
   - `serverData` es objeto pero el `id` no está → el payload **sí** llegó pero este elemento no resolvió
     (provider caído/mal configurado) → `emptyObject` + `hasError = true` (a propósito **no** mock: no se disfraza
     una caída de producción como contenido).
   - `id in serverData` → el slice del servidor.

### Seguridad

- En modo server el navegador nunca ve la URL del backend ni el secreto: el dato llega ya resuelto en el payload RSC.
- Una escritura viaja como `{ elementId, action, ... }`; el servidor resuelve el destino desde el schema publicado y
  rechaza lo que el conector no declara. El endpoint no es un proxy genérico.

---

## 5. Elementos relacionados

### Pagination (`structure`)

UI pura sobre cualquier `pageInfo`. **Nunca habla con el provider directamente** — por eso funciona también sobre
fuentes de plugins.

| Prop | Valores | Nota |
|------|---------|------|
| `pageInfo` | bind `{{apiContainer_x.pageInfo}}` | De ahí sale todo |
| `mode` | `pages` \| `loadMore` | Pager numerado o botón "cargar más" |
| `target` | `url` \| `interaction` | Navega solo, o solo emite `onPageChange` |
| `pageParam` | string | Debe coincidir con el del provider |
| `windowSize` | número | Páginas alrededor de la actual |

Emite el trigger `onPageChange`. En el builder (sin datos) renderiza los controles deshabilitados, para que el
elemento se pueda estilizar al seleccionarlo.

### RichText (`basic`)

Renderiza el cuerpo de un CMS. **No** es `BlockHtml` (que ejecuta `<script>` a propósito, correcto para embeds
autoral y inaceptable para contenido de terceros).

- `content` — el body, bind desde el provider.
- `format` — `html` \| `markdown` \| `text` (Strapi devuelve HTML o markdown según el editor; Contentful y Ghost
  HTML; otros son texto).
- `mediaBaseUrl` — prefijo para `src`/`href` relativos dentro del cuerpo (el conector rebasea campos de registro,
  pero el markup dentro de un body le es opaco).

Sanea: quita `<script>`, manejadores de eventos y URLs `javascript:`, y rebasea media relativa.

---

## 6. Paginación: URL vs append

Ambos modos comparten **un solo camino en el servidor**: el parámetro de página se lee del query string de la
petición.

| Modo | Comportamiento | Indexable | Uso |
|------|----------------|-----------|-----|
| `url` | El pager escribe `?<pageParam>=N` (por defecto `page`); el servidor resuelve esa ventana en SSR | Sí | Índices de blog, listados |
| `append` | El `ApiContainer` acumula en estado del navegador y pide solo el siguiente slice al servidor | No | "Load more" / infinito |

Detalles:

- Dos listas en una página usan `pageParam` distintos para paginar independientemente.
- `useProviderPagination` clavea la acumulación por la página que **reporta el servidor**, no por un contador local:
  un refresh completo vuelve a la página 1 y resetea la lista, que es lo que hace que navegar y volver se comporte.
- Un proveedor de tipo `cursor` no puede direccionar una ventana por ordinal: el cliente reenvía el token bajo el
  parámetro propio del elemento (`<pageParam>Cursor`) en lugar de reutilizar el número de página.

---

## 7. Página detalle `/posts/:id` y precargado SSR

El caso de uso que une todas las piezas: una URL como `/posts/123` que, **al cargar por primera vez, ya trae el post
resuelto** — sin spinner ni fetch inicial. El precargado ocurre en el servidor durante el SSR: el dato entra en el
HTML y el cliente solo hace *hydrate*.

### 7.1 Autoría

1. Crear una página con slug `posts/:id` (o en una carpeta `posts` con slug `:id`). El parámetro de ruta se llama
   `id`.
2. Dentro, un **ApiContainer** en modo server (**Data Source = Connector (server-side)**) con:
   - `connector` — el conector del CMS.
   - `resource` — el tipo de contenido, p. ej. `posts`.
   - **Single record ON** — publica `record` en vez de `records`; el resolver fuerza `limit=1` y página 1.
   - Filtro: campo `id`, operador `eq`, valor `{{routeParams.id}}`. El Settings autocompleta el token porque lo
     extrae del slug (`Settings.tsx:116-121`).
   - Paginación: `none`.
3. Binds dentro de la página: título `{{apiContainer_<idRef>.record.values.title}}`, imagen
   `record.values.cover.url`, y el cuerpo en un **RichText** con `content` = `{{apiContainer_<idRef>.record.values.body}}`
   y el `format` que devuelva el CMS.

### 7.2 Qué ocurre al cargar (el preload)

1. Llega `GET /posts/123` al server SSR (`plitzi-sdk-server`).
2. `buildServerInfo` (`apps/server/src/helpers/buildServerInfo.ts:71`) llama a `config.adapters.getRscData(req, …)`,
   que invoca `resolveRscData`.
3. `resolveRscData` (`apps/server/src/modules/rsc/resolveRscData.ts`):
   - `getPaths` produce `/posts/:id` (el slug se parsea: `{{id}}` → `:id`).
   - `matchRoutePath` matchea `/posts/123` contra `/posts/:id` y extrae `routeParams = { id: '123' }`
     (`matchPath.ts` es un clon de react-router; el mismo matcher que usa el router cliente).
   - Recoge el subtree de la página y filtra los elementos `runtime === 'server'` → tu ApiContainer.
4. El resolver (`apps/server/src/modules/connectors/resolver.ts`):
   - Lee los atributos del elemento (connector, resource, singleRecord, filtros).
   - `getConnector` → manifest, `getCredential` → secreto (**nunca** salen del server).
   - Llama a `fetchConnectorRecords` pasándole `routeParams`.
   - `resolveFilters` (`engine.ts:76`) renderiza el valor del filtro: `{{routeParams.id}}` → `'123'`; después la
     plantilla de operador produce `filters[id][$eq]=123`.
   - Fetch al CMS → normaliza → `singleRecord` publica `{ record, pageInfo, isEmpty, ... }` → `projectSlice` lo
     recorta a los caminos que bindeaste.
5. Ese slice entra en `serverData[elementId]` y se **incrusta en el HTML** como `server.rscData`.
6. Cliente: `Sdk.tsx:128` hace `<RscProvider rscData={server?.rscData}>`, así que `serverData` existe **desde el
   primer render**. El ApiContainer server encuentra `elementData` y pinta el post al instante — no hay fetch ni
   estado de carga inicial.

### 7.3 Navegación posterior

Si el visitante navega en SPA a `/posts/456`, `RscProvider` (navigationKey = `currentPageId`) hace
`GET /_rsc?location=/posts/456`; el handler reescribe la petición a esa página (`rsc/handler.ts`), se repite toda la
resolución y el slice nuevo se **fusiona** en `serverData`.

### 7.4 Casos borde

- **Post inexistente**: `singleRecord` sin registro → `isEmpty: true`, pero la respuesta es **HTTP 200** (el flag
  `notFoundStatus` del RFC 0009 §3.4 aún no está implementado en el resolver). El autor puede bindear la visibilidad
  de un bloque "no encontrado" a `{{apiContainer_<idRef>.isEmpty}}`.
- **Filtro sin resolver**: si `{{routeParams.id}}` no resuelve, `resolveFilters` marca `unresolved` y se devuelve una
  ventana vacía — mejor que devolver la colección entera.
- **Seguridad**: ni la URL del CMS ni la credencial bajan al navegador; el cliente solo ve el slice proyectado.

---

## 8. Flujo de uso paso a paso

### 0. Prerrequisito

El espacio se sirve con SSR/RSC activado. El servidor (`plitzi-sdk-server`) debe inyectar los lookups
`getConnector` / `getCredential` (`createConnectorResolver`).

### 1. Crear la credencial (el secreto)

Panel lateral **Credentials** → *New Credential*. Provider **CMS / Custom API** (`SpaceCredentialForm.tsx`): nombre +
JSON con las llaves que usará el manifest, p. ej. `{ "token": "…" }`. Queda guardada con un `identifier`, cifrada en
reposo (`SpaceCredential.encryptedFields`). El secreto no baja al navegador ni entra nunca en el manifest.

### 2. Crear el conector

Panel lateral **Connectors** (aparece en `AppContainer.tsx` cuando el popup activo es `connectors`):

1. **New Connector**.
2. Elegir preset (**Strapi v5**, **WordPress REST**, **Directus**, **Contentful CDA**, **Blank**).
3. En **Basic**: `baseUrl`, credencial (botón *Choose*), autenticación, ruta y paths de lectura, paginación,
   operadores, media y — si hace falta — las escrituras permitidas. Cada campo lleva su explicación debajo y los
   campos de plantilla autocompletan tokens.
4. En **Advanced** está el mismo documento en JSON, para lo que el formulario no cubra.
5. Guardar (mutation `SpaceAddConnector`). Se valida antes: base URL, ruta de lectura, y que no se referencie
   `{{credential.…}}` sin credencial elegida — que si no autentica como nadie y la página lo ve como "el CMS nos
   rechazó".

### 3. Página índice (listado)

1. Arrastrar **ApiContainer**.
2. Settings (`ApiContainer/Settings.tsx`): **Data Source = Connector (server-side)**, elegir connector, `resource`
   (`posts`), `limit`, **Pagination = URL (indexable)**.
3. Dentro, un **List** (source `controlled`) con una card por registro: heading bind
   `{{apiContainer_<idRef>.records.item.title}}`, imagen a `cover.url`, etc.
4. Añadir **Pagination** bind `{{apiContainer_<idRef>.pageInfo}}`, mode `pages`, target `url`. Al clicar navega a
   `?page=N`; el servidor resuelve esa ventana (SSR, indexable, botón atrás correcto).

### 4. Página detalle

Paso a paso completo con precarga SSR en la **sección 7** (página `/posts/:id`). Resumen: página con slug
parametrizado, **ApiContainer** con **Single record ON** + filtro `slug eq {{routeParams.slug}}` (el filtro es
plantilla; se resuelve en el servidor — es todo el mecanismo del detalle), **RichText** bind al body, y visibilidad
"no encontrado" bindeada a `isEmpty`.

### 5. Escrituras (opcional)

Si el manifest declara `write`, el `ApiContainer` server expone callbacks `createRecord` / `updateRecord` /
`removeRecord`. Conéctalos desde un botón o formulario vía interacciones. El navegador hace `POST /_action` y el
servidor valida toda la cadena.

### 6. Publicar

`resolveRscData` matchea la URL → `routeParams` → resuelve cada elemento `runtime: 'server'` (timeout por elemento)
→ slice proyectado solo a lo bindeado → HTML + store. El cliente solo refresca con `/_rsc?location=…&page=N`.

### Variante "load more"

En el `ApiContainer`, **Pagination = Load more**; añade un `Pagination` en modo `loadMore` con target
`interaction`, y conecta su trigger `onPageChange` al callback `loadMore` del provider (acumula en cliente, no
indexable).

---

## 9. Referencia rápida de rutas de código

| Pieza | Ruta |
|-------|------|
| Tipos del manifest | `apps/server/src/modules/connectors/types.ts` |
| Engine (lectura/escritura) | `apps/server/src/modules/connectors/engine.ts` |
| Resolver (puente RSC) | `apps/server/src/modules/connectors/resolver.ts` |
| Proyección del slice | `apps/server/src/modules/connectors/projection.ts` |
| Resolución RSC | `apps/server/src/modules/rsc/resolveRscData.ts` |
| Inyección de `rscData` en SSR | `apps/server/src/helpers/buildServerInfo.ts` |
| Matcher de rutas (cliente/servidor) | `packages/sdk-shared/src/navigation/matchPath.ts` + `routes.ts` |
| Endpoint `/_rsc` | `apps/server/src/modules/rsc/handler.ts` |
| Endpoint `/_action` | `apps/server/src/modules/actions/handler.ts` |
| Panel del builder | `apps/builder/src/modules/Connectors/` |
| Presets | `apps/builder/src/modules/Connectors/presets.ts` |
| Credencial CMS | `apps/builder/src/modules/Space/Models/SpaceCredentialForm.tsx` |
| Elemento provider | `packages/sdk-elements/src/elements/provider/ApiContainer/ApiContainer.tsx` |
| Settings del provider | `packages/sdk-elements/src/elements/provider/ApiContainer/Settings.tsx` |
| Paginación del provider | `packages/sdk-elements/src/elements/provider/ApiContainer/hooks/useProviderPagination.ts` |
| Escritura del provider | `packages/sdk-elements/src/elements/provider/ApiContainer/hooks/useProviderWrite.ts` |
| Elemento Pagination | `packages/sdk-elements/src/elements/structure/Pagination/Pagination.tsx` |
| Elemento RichText | `packages/sdk-elements/src/elements/basic/RichText/RichText.tsx` |
| Refresh RSC (cliente) | `packages/sdk-shared/src/server/rsc/RscProvider.tsx` |
| Fuente de interacciones | `packages/sdk-interactions/src/InteractionsSourcesProvider.tsx` |

---

## 10. Conceptos clave en una frase

- **Manifest** → el único documento que hay que tocar para conectar un CMS o arreglar uno que cambió su API.
- **Slice** → el objeto que publica el provider; es el contrato que bindean List, Pagination y RichText.
- **`runtime: 'server'`** → el flag compartido entre el servidor (qué resolver) y el elemento (qué esperar).
- **Proyección** → el servidor solo envía lo que la página bindea.
- **`/_action`** → el navegador nombra un *elemento*, nunca una URL ni una credencial; el servidor decide.
- **`/_rsc`** → el refresco cliente viaja con `?location=` para que el servidor sepa en qué página está el visitante.
