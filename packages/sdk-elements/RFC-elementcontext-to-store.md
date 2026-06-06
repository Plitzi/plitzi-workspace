# RFC: Reemplazar `ElementContext` por `sdk-store`

- **Estado:** Draft
- **Fecha:** 2026-06-06
- **Autor:** Carlos Rodriguez
- **Paquetes afectados:** `sdk-elements` (hooks + HOC), `sdk-shared` (`ElementContext`, `useElement`)
- **Consumidores externos:** plugins que usan `useElement()` (`plitzi-plugin-lottie`, `plitzi-plugin-template`, …)
- **Relacionado:** RFC scoped-store / data-source migration (`StoreTypes.ts §4`)

---

## 1. Resumen

Unificar `sdk-elements` sobre `sdk-store`: eliminar progresivamente `ElementContext` y delegar
en el store las tres tareas que hoy hace el context (identidad, datos derivados y estado efímero).
El store ya gestiona el re-render de forma fina (suscripción por path con `useSyncExternalStore`),
así que mover el estado de elemento al store debería **reducir complejidad** y **mejorar el
rendimiento** (menos re-renders de subárbol, menos plumbing en el HOC).

La migración es **gradual y por tipo de elemento**, detrás de la API estable de `useElement()`,
sin romper plugins externos.

## 2. Motivación

Hoy [`ElementContext`](../sdk-shared/src/elements/ElementContext.tsx) es el puente entre el HOC
[`withElement`](src/Element/hocs/withElement.tsx) y todo el subárbol del elemento
([`RootElement`](src/Element/RootElement.tsx) + el componente del plugin vía
[`useElement()`](../sdk-shared/src/elements/hooks/useElement.ts)).

Problemas:

1. **Re-render de subárbol completo.** Cuando `setElementState` cambia, el `contextValue`
   memoizado se reconstruye y **todo** lo que consume el context vuelve a renderizar, aunque solo
   dependa de un campo. El store re-renderiza solo a quien se suscribe a ese path.
2. **Complejidad del HOC.** `withElement` memoiza un `contextValue` grande
   (`attributes/definition/style/elementState/setElementState`) y arrastra el tipado dual
   `'skipHOC' | 'full'`.
3. **Violación de reglas de hooks.** `withElement` y `RootElement` usan
   `eslint-disable rules-of-hooks` con `useMemo`/hooks dentro de `if` (rama `plitziJsxSkipHOC`).
4. **Doble fuente de verdad.** El schema crudo vive en el store (`schema.flat.${id}`); el estado
   resuelto vive en el context. Resolver desde un único lugar simplifica el modelo mental.

## 3. Objetivos / No-objetivos

**Objetivos**

- Que el estado de elemento (efímero + resuelto) se sirva desde `sdk-store` con suscripción fina.
- Eliminar `ElementContext` (o reducirlo a identidad mínima) sin romper `useElement()`.
- Reducir código y los `eslint-disable` del HOC/RootElement.
- Mantener el aislamiento de **replicas** (mismo `id` renderizado N veces) que hoy da el `useState` local.

**No-objetivos**

- No cambiar la firma pública de `useElement()` (sigue sin argumentos).
- No migrar el schema/document state ni la lógica de bindings/sources (ya está en el store).
- No tocar el sistema de interacciones más allá de su acoplamiento con `setElementState`.

## 4. Qué transporta `ElementContext` hoy

| Rol | Campos | ¿En el store hoy? |
|---|---|---|
| **1. Identidad** | `id`, `rootId`, `plitziElementLayout` | No — es posicional |
| **2. Datos derivados** | `attributes`, `definition`, `style`, `elementState` | No — los calcula `getProps` en cada render |
| **3. Setter local** | `setElementState` | No — es `useState` en `useElementState` |

`useElement()` devuelve ese shape completo y lo consumen elementos internos **y plugins externos**.
Cualquier diseño debe preservar ese contrato.

## 5. Diseño propuesto

### 5.0 Principio: sin `inherit` (plano), no anidado

`ElementContext` hoy son **islas aisladas, no conectadas a nada**: el HOC lee el store **global y
plano** (`schema.flat.${id}`, `runtime.sources.*`), resuelve, y mete el resultado + `elementState`
en un context aislado. La conexión al global ocurre a nivel del HOC, no en cadena.

Hay **dos razones** para no replicar esto con un scope anidado `inherit="live"`. En orden de peso:

**1. El eclipse del `StoreContext` (decisivo, arquitectónico).** `createStoreHook` resuelve **un único
`StoreContext` de módulo** ([`StoreContext.ts`](../sdk-store/src/StoreContext.ts) — un solo
`createContext`). Anidar un segundo store por elemento ahí **eclipsa** el global para todo el subárbol
y rompe las lecturas de `schema.flat`/`runtime.sources` que cada elemento hace. *Ese eclipse es la
única razón por la que `inherit="live"` haría falta* (heredar para no perder el global). El diseño
plano lo esquiva por completo: no hay segundo store, no hay nada que eclipsar.

**2. El coste de la cadena (secundario, ya amortizado pero no nulo).** El trabajo reciente de
rendimiento nested ([`createChainReads.ts`](../sdk-store/src/createStore/helpers/createChainReads.ts))
**cacheó** el fall-through: la lectura encadenada (`getPath`/`getState`) es O(depth) **la primera vez
tras una invalidación** y O(1) en repeticiones (memoizada, invalidada por los eventos de cambio que el
store ya emite). La cascada de escritura (`forwardParentChanges`) sigue siendo O(depth) **pero solo por
la rama suscrita** (lazy attachment: las ramas sin consumidores no se enganchan). Así que el coste ya
**no es O(depth) por render** como se temía; pero **no es gratis**: se paga O(depth) por scope **en cada
invalidación** —y una source compartida que cambia invalida el scope de *todos* los descendientes, que
es justo el caso común que dispara re-renders— más el coste de **mount** (`forwardParentChanges` por
scope) y de **memoria** (N stores + forwarder + caches retenidos por el padre).

**Conclusión: no anidar sobre el `StoreContext` compartido → no usar `inherit`.** El caso de uso del
elemento **no tiene forma de overlay heredable**: lee el global y guarda estado efímero privado — eso
es la forma keyeada-plana de `runtime.sources.*`, no la forma `inherit`, así que el nesting no aporta
nada aunque su coste de lectura esté ahora amortizado. El estado de elemento vive en el store global
bajo un namespace keyeado por instancia (plano, O(1)). La identidad mínima viaja en un context estable
que **nunca cambia de valor** (por eso no re-renderiza el subárbol, a diferencia del `ElementContext`
actual que carga datos).

### 5.1 Estado de elemento en `runtime.elements.${instanceKey}` (store global, sin nesting)

```
runtime
├─ sources   { variables, auth, … }      // compartido, por nombre
└─ elements
   └─ :r3:   { _id: 'el1', visibility: false, active: true }   // por instancia (useId)
```

- `instanceKey = useId()` en `withElement` → key única por montaje → **replicas aisladas** (paridad
  con el `useState` local de hoy), sin coordinar con `ReplicaProvider`.
- `id` solo se usa para leer el schema crudo compartido (`schema.flat.${id}`).
- `_id` dentro del valor como metadato de trazabilidad (dev-tools/history), no se lee para resolver.
- Lecturas/escrituras a `runtime.elements.${instanceKey}` son **planas O(1)** (un solo store), igual
  que `useElementDataSource` con `runtime.sources.${name}` (`subscribePath` fino → solo re-renderiza
  esa instancia cuando cambia su propio estado).

### 5.2 Identidad mínima en un context estable

`ElementContext` se reduce a `{ id, rootId, instanceKey }`: un objeto estable que **no cambia** entre
renders → no provoca re-render del subárbol. `useElement()` lo lee para saber qué `id`/`instanceKey`
consultar; todos los **datos** llegan por suscripción fina del store, no por el context.

> Alternativa equivalente sin context residual: store **aislado** por elemento
> (`StoreProvider inherit={undefined}`) alcanzado por **handle explícito** `useStore(path, { store })`
> — `StoreHookBaseOptions.store` lo soporta. Es plano (sin forwarder), con cleanup por GC, pero exige
> un context que cargue el handle y pasar `{ store }` en cada lectura local. Se descarta como
> principal por ergonomía y por N instancias de store; 5.1 (key en el global) es más simple y liviano.

### 5.3 La resolución es derivación, no almacenamiento

`getProps` (bindings + interpolación de variables + merge de estado + `parseStyleSelectors`) **no** se
escribe al store en cada render (generaría commits + notificaciones). Se expresa como `useDerived`
que lee `schema.flat.${id}` (crudo) + `runtime.elements.${instanceKey}` (estado), calculado
perezosamente. Los props resueltos (`attributes/definition/style`) quedan **suscribibles por path**,
de modo que un componente que solo lee `definition` no re-renderiza cuando cambia `elementState`.
**Solo el estado efímero se almacena; lo derivado se computa.**

> Pieza validada: [`createDerived`](../sdk-store/src/derived/createDerived.ts) es exactamente el
> primitivo necesario — recomputa **solo** cuando cambia uno de sus `deps` y notifica **solo** cuando
> cambia el *resultado* (una edición de dependencia que no afecta la salida no cuesta nada aguas abajo);
> sin suscriptores, invalida y recomputa perezosamente en el siguiente `get`. `useDerived` está
> exportado desde `sdk-store`.

### 5.4 `useElement()` se mantiene estable

```ts
// Internamente: identidad del context mínimo + selectores/useDerived del store global.
// El shape de retorno y la firma (sin argumentos) NO cambian → backward-compatible.
const useElement = () => useResolvedElementFromStore();
```

### 5.5 Bypass `plitziJsxSkipHOC`

Se preserva el fast-path sin resolución para componentes que renderizan en crudo.

### 5.6 Alternativa rechazada — scope anidado `inherit="live"`

Anidar un `StoreProvider inherit="live"` por elemento haría que el límite del scope *fuera* la
identidad (sin keyear por id, aislamiento y cleanup automáticos). **Rechazado** porque (ver §5.0 para
el desarrollo):

- **Eclipse del `StoreContext` único de módulo** (razón decisiva): el store anidado tapa el global y
  rompe las lecturas de schema/sources que el elemento necesita.
- **Coste de cadena, ya amortizado pero no nulo**: con el cache de `createChainReads`, el fall-through
  es O(1) en repeticiones pero O(depth) por scope **en cada invalidación** (una source compartida
  invalida a todos los descendientes); más mount (`forwardParentChanges` por scope) y memoria (N stores
  con su forwarder retenido por el padre). El caso de uso del elemento no es un overlay heredable, así
  que paga ese coste sin recibir nada a cambio.

5.1 obtiene la misma ganancia de re-render (~1/update vs ~N del context) sobre el store global plano,
sin eclipsar nada y con lecturas O(1) por instancia.

## 6. Impacto en API pública

- `useElement()`: **sin cambios** de firma ni de shape de retorno.
- Plugins externos: siguen funcionando mientras el `StoreProvider` (5.1) o el `ElementContext`
  mínimo (5.5) exista por encima, cosa que `withElement` garantiza.
- `ElementContext` exportado desde `sdk-shared`: se mantiene como export hasta el final de la
  migración (§8) para no romper imports; se marca `@deprecated` y se reduce a identidad.

## 7. Rendimiento: hipótesis y gate

**Hipótesis:** suscripción fina por path (`runtime.elements.${instanceKey}`, store global plano) <
re-render de subárbol por context al cambiar estado; la resolución vía `useDerived` ≈ coste actual de
`getProps`. La bench ya midió que el store hace **~1 re-render/update vs ~N del context** (401× menos
a depth 400) y que las lecturas/escrituras locales en un store plano son **O(1)**. El diseño plano
evita por completo el fall-through `inherit="live"` — que aun con el cache de `createChainReads` (O(1)
en repeticiones) re-paga O(depth) por scope en cada invalidación, además del eclipse del `StoreContext`
(la razón decisiva, §5.0/§5.6).

**Riesgo a vigilar:** que escribir el estado en el store global (en vez de `useState` local) y
resolver por `useDerived` no introduzca commits/notificaciones de más; mitigado escribiendo **solo**
el estado efímero y derivando lo demás.

**Gate (antes de migración masiva):** prototipo en `Text` y benchmark contra `main`:
- render inicial de N elementos (N = 100 / 1.000 / 5.000),
- memoria residente,
- re-render al cambiar una source compartida,
- re-render al cambiar el estado de un solo elemento (debe re-renderizar **solo** esa instancia).

Criterio: igualar o superar al context en re-render y no degradar > X% el render inicial / memoria
(X a definir).

## 8. Plan de migración (gradual)

- **Fase 0 — Red de tests (en curso).** Tests de los hooks puros ya añadidos
  (`useElementState`, `useElementInteractions`, `useInternalClassName`, `getInteractions`,
  `parseStyle`). **Falta:** tests de `withElement` + composición con
  [`ReplicaProvider`](src/Element/ReplicaProvider.tsx) que fijen el aislamiento de replicas
  **antes** de migrar.
- **Fase 1 — Prototipo + benchmark (§7).** `withElement` con `instanceKey=useId()` +
  `useElementState` escribiendo a `runtime.elements.${instanceKey}`, resolución vía `useDerived`, en
  `Text`. Validar el gate.
- **Fase 2 — `useElement()` sobre store.** Cambiar la implementación interna (identidad del context
  mínimo + selectores del store) manteniendo firma y shape; tests de plugins externos en verde.
- **Fase 3 — Migrar hooks.** `useElementState` → setter del store hacia
  `runtime.elements.${instanceKey}` + cleanup en unmount; `useElementInternal` (`getProps`) →
  `useDerived`.
- **Fase 4 — Reducir `ElementContext` a identidad.** `{ id, rootId, instanceKey }` estable. Quitar
  `eslint-disable rules-of-hooks` separando la rama `skipHOC`.
- **Fase 5 — Limpieza.** Excluir `runtime.elements.*` de `persist`/`history`. Borrar ramas muertas
  (p.ej. `typeof value === 'undefined'` inalcanzable en `useElementInteractions`), tipado dual
  `'skipHOC' | 'full'` si deja de aplicar, export deprecado.

Cada fase se mergea por separado, con la red de tests en verde y `yarn typecheck` + `yarn lint`
limpios.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Eclipse del `StoreContext` por nesting + coste de cadena | **Evitado por diseño** (§5.0/§5.6): store global plano, sin nesting — no hay segundo store que eclipse el global ni cadena que re-pague O(depth) por invalidación |
| Replicas comparten estado | `instanceKey=useId()` aísla por montaje; tests dedicados Fase 0 |
| Estado efímero sin limpiar → store crece al navegar | Cleanup en unmount (`setState(path, undefined)`) — Fase 3 |
| Estado efímero contaminando persist/history | `runtime.elements.*` excluido de esos middlewares — Fase 5 |
| SSR/RSC: hidratación del estado por instancia | Verificar con `ServerStaticShell`/`useInternalItems` (ya usan server/client snapshot) |
| Ruptura de plugins externos | `useElement()` estable; export `ElementContext` deprecado hasta Fase 4 |
| Convertir derivación en escritura (commits extra) | Resolución como `useDerived`, nunca `useStoreSync` por render |

## 10. Preguntas abiertas

- ¿Namespace del valor: `runtime.elements.${instanceKey}` plano o con sub-clave `state`?
- ¿`getProps` como `useDerived` memoizado por `id` o por `instanceKey`?
- ¿Umbral exacto del gate de rendimiento (X%)?
- ¿`setElementState` como `useStoreSetter` (escribe sin suscribir) para no re-renderizar al setear?
- ¿Vale la pena cachear el owner resuelto por path / índice plano en el store (idea de la bench) o el
  diseño plano de §5.1 lo hace innecesario para este caso?
- Ahora que `createChainReads` cachea el fall-through (O(1) en repeticiones), ¿hay **algún** escenario
  donde `inherit="live"` sea aceptable para elementos? Respuesta actual: no, porque el rechazo ya no
  descansa en el coste de lectura (amortizado) sino en el **eclipse del `StoreContext` único de módulo**
  (§5.0), que es arquitectónico. Solo cambiaría si el store de elemento viviera en un context dedicado
  separado del global — complejidad que §5.1 no necesita.

## 11. Estrategia de tests

- **Pre-migración:** `withElement` + `ReplicaProvider` (aislamiento de replicas: dos montajes del
  mismo `id` no comparten `elementState`), composición `useElement()` con el estado en
  `runtime.elements.${instanceKey}`.
- **Por fase:** los tests existentes de hooks deben seguir verdes (red de regresión).
- **Plugins externos:** smoke test de `plitzi-plugin-template` montado bajo el nuevo HOC.
- **Rendimiento:** benchmark reproducible (§7) versionado junto al prototipo.
