# Store Library — Summary

## Stack
- TypeScript + React + Vitest
- Vite (`import.meta.env.MODE === 'test'` para detectar test mode)
- `@testing-library/react` con `renderHook` + `act`

---

## Arquitectura

### Archivos clave
```
src/store/
  createStore.ts          — crea el store y exporta createStoreHook
  StoreProvider.tsx       — contexto React (StoreContext)
  StoreTypes.ts           — todos los tipos públicos
  hooks/
    useStore.ts           — hook principal
    useStoreSync.ts       — hook de sincronización
  helpers/
    getByPath.ts
    setByPath.ts
    isPathAffected.ts     — optimización de notificaciones
    shallowEqual.ts       — comparación shallow para selectores
```

### Tipos en StoreTypes.ts
```ts
export type SyncMode = 'mount' | 'sync';
export type Listener = () => void;
export type Path = string;
export type Primitive = string | number | boolean | null | undefined | symbol | bigint;
export type PathOf<T, Seen = never>   // genera todos los paths posibles
export type PathValue<T, P>           // tipo del valor en un path
export type SetState<T>               // setState con overloads
export type GetState<T>
export type StoreApi<T>
export type StoreApiInternal<T>       // solo para tests: expone listeners y pathListeners
export type CommonState / BuilderState / SdkState  // estados propios del proyecto
```

---

## API pública

### createStore
```ts
const store = createStore<MyState>(() => ({ ... }))
// store: StoreApi<TState> — getState, setState, subscribe, subscribePath
```

### createStoreHook
```ts
const { useStore, useStoreSync, useStoreGetter } = createStoreHook<MyState>()
// Fija TState una sola vez; los args infieren el resto
```

### useStore overloads
```ts
useStore()                                           // → [TState, setState]
useStore('user.name')                                // → [string, setName]
useStore(`schema.flat.${id}` as PathOf<T>)           // → dynamic path (cast required)
useStore(s => s.count)                               // → [number, setState] — shallowEqual default
useStore(['user.name', 'count'])                     // → [[name, count], setName, setCount]
useStore('user.name', { enabled: false })            // → desuscrito, retorna último valor
useStore('user.name', { equalityFn: deepEqual })     // → custom equality
useStore('user.name', { defaultValue: 'home' })      // → [NonNullable<string|undefined> | 'home', setter]
useStore('selector', { defaultValue: undefined })    // → [string | undefined, setter]
```

**defaultValue rule:** return type becomes `NonNullable<PathValue<TState, P>> | D`. Setter is always `PathValue<TState, P>` — never uses the defaultValue type. Multi-path `PathValues` already handles this correctly; single-path overload 3 was fixed to match.

### useStoreGetter
```ts
const { getValue } = useStoreGetter()            // full store access
getValue()                                        // → TState
getValue('schema.flat')                           // → PathValue<TState, 'schema.flat'>

const { getValue } = useStoreGetter('schema.flat') // scoped to base path
getValue()                                        // → PathValue<TState, 'schema.flat'>
getValue('element1')                              // → sub-path value
```
Passive hook — no subscriptions, no re-renders. `getValue` reads `store.getState()` at call time.
Stable reference: only re-created when the store instance or base path changes.

### useStoreSync overloads
```ts
useStoreSync('schema', schema)                           // sync en cada render
useStoreSync('schema', schema, { mode: 'mount' })        // sync solo al montar
useStoreSync('schema', schema, { enabled: false })       // desactivado
useStoreSync(undefined, fullState)                       // sync estado completo
useStoreSync(undefined, fullState, { mode: 'mount' })
```

---

## Detalles de implementación importantes

### isPathAffected
```ts
// Evita llamar getByPath en paths no relacionados
const isPathAffected = (changed: Path, candidate: Path): boolean =>
  typeof changed !== 'string' ||  // guard para arrays/runtime
  changed === candidate ||
  changed.startsWith(candidate + '.') ||
  candidate.startsWith(changed + '.');
```

### useSingleStore
- `getSnapshot` y `subscribe` con `useCallback`/`useMemo` — estables entre renders
- `lastRef` para bail-out sin re-render cuando `equalityFn` retorna `true`
- **Selector** → `shallowEqual` por defecto
- **Path string** → `Object.is` por defecto
- **`enabled: false`** → `subscribe` retorna `() => {}`, snapshot retorna `lastRef.current`

### useMultiStore
- `pathsKey = paths.join('|')` como dep estable en lugar del array
- `lastRef` inicializa en `null`, compara path por path con `Object.is` antes de crear objeto nuevo
- Retorna la misma referencia si nada cambió — crítico para evitar loop infinito en `useSyncExternalStore`
- Cada path se suscribe individualmente con `subscribePath`

### useStoreSync
- Escribe al store **durante el render** (no en efecto) — seguro porque `setState` es síncrono
- `mountedRef` para distinguir primer render de rerenders
- `enabled` en deps de `subscribe` → React re-suscribe automáticamente al cambiar
- `undefined` path → `shallowEqual` default + `store.subscribe` (estado completo)

### StoreApiInternal (solo tests)
```ts
if (import.meta.env.MODE === 'test') {
  (api as StoreApiInternal<TState>).listeners = listeners;
  (api as StoreApiInternal<TState>).pathListeners = pathListeners;
}
```

---

## Overloads en createStoreHook — regla clave
Los overloads dentro de `createStoreHook` duplican intencionalmente los de `useStore.ts`/`useStoreSync.ts`.
TypeScript no permite instanciar un tipo genérico con typeof, por lo que deben re-declararse para fijar TState.

La firma de implementación es compacta — el eslint-disable cubre el argumento `any`:
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
function useStore(arg?: any, options?: any): unknown {
  return useStoreBase(arg, options);
}
```
Orden de overloads: `()` → `(path)` → `(selector)` → `(paths[])` — el array va último para evitar solapamiento con string generics.

---

## Tests — estructura y convenciones
- Idioma: **descripciones e inglés, conversación en español**
- `renderCount()` helper: `const { fn, count } = renderCount()`
- `makeStore()` + `makeWrapper(store)` por cada describe
- `act()` para cualquier setState
- Memoria verificada via `StoreApiInternal` con `store.listeners.size`
- Tests de memoria usan `subscribe/subscribePath` directamente, no hooks (jsdom no expone los listeners de `useSyncExternalStore`)
- El test de selector inestable (objeto nuevo) **no** puede probar loop infinito — reemplazar por primitivo derivado

## Preferencias de trabajo
- Código en inglés, conversación en español
- Sin `any` en API pública — solo en cuerpos de implementación con eslint-disable
- Sin comentarios innecesarios — el código debe explicarse solo
- Cambios incrementales: compartir archivo → yo lo analizo → propongo → implemento
- Siempre confirmar el API antes de implementar cambios de interfaz
- No modificar nada que no sea el objetivo del cambio
- Al terminar siempre actualizar memoria y CLAUDE.md con aprendizajes
- Tests exhaustivos: edge cases, re-renders, memory leaks, performance — siguiendo patrones de store.test.tsx