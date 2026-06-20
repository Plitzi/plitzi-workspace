# Nexus — Mass Adoption Upgrade Report

## Implementation Plan for Repository + Website

Este documento describe cambios concretos para evolucionar Nexus desde una librería avanzada de state management hacia un producto de adopción masiva.

---

# 1. REFACTOR DEL REPOSITORIO (CORE + API DESIGN)

## Objetivo

Convertir Nexus en:

> A path-first reactive state system with a single mental model

Reducir superficie pública, simplificar arquitectura percibida y consolidar APIs.

## 1.1 Unificación de API pública

### Nueva API principal

```ts
const store = createStore(initialState)

store.get(path)
store.set(path, value)
store.watch(path, callback)
store.derive(path, fn)
store.query(path)
```

### Eliminación de superficie pública

Mantener internamente:

- PathTrie
- writeByPath
- Subscribers
- Derived graph
- Middleware system

Mover a plugins:

- entities
- async
- history
- persistence
- redux devtools

## 1.2 Reorganización del repo

```txt
src/
  core/
    store/
    path/
    subscriptions/
    write/
    trie/

  react/
    hooks/
    provider/

  graph/
    derived/

  plugins/
    middleware/
    history/
    persist/
    async/
    entities/

  index.ts
```

## 1.3 Core simplification rules

### Regla 1

Core completamente agnóstico a React.

### Regla 2

Todo update debe pasar por:

```ts
write(path, value)
```

### Regla 3

Suscripciones nativas por path:

```ts
subscribe("user.profile.name", cb)
```

## 1.4 Derived Graph unificado

```ts
store.derive("user.fullName", (get) => {
  return get("user.firstName") + " " + get("user.lastName")
})
```

Requisitos:

- dependency tracking automático
- invalidación granular
- cache por nodo

## 1.5 Entities → Plugin

```ts
store.plugin(entityPlugin())
```

## 1.6 Async → Plugin

```ts
store.plugin(asyncPlugin())
```

## 1.7 Middleware simplification

```ts
store.use(middleware)
```

Shape:

```ts
({ path, value, prevValue, next }) => void
```

## 1.8 Performance requirements

- Path lookup: O(log n) o amortized O(1)
- Subscription lookup: O(1)
- Update propagation proporcional al subtree afectado

## 1.9 DevTools hook

```ts
store.__inspect()
```

Debe exponer:

- state tree
- active subscriptions
- derived graph
- update trace

## 1.10 Escape hatch

```ts
const store = createStore({ user: {} })
```

Compatibilidad con selector-style cuando sea necesario.

---

# 2. REDISEÑO DE WEBSITE + DOCUMENTACIÓN

## Objetivo

Transformar percepción:

### Antes

Another state library

### Después

State as a navigable tree

## 2.1 Hero Message

Propuestas:

> Reactive state you can query by path

> State as a navigable tree

## 2.2 Visual mental model

```txt
user
 ├── profile
 │    ├── name
 │    ├── email
 ├── settings
      ├── theme
      ├── language
```

```ts
store.watch("user.profile.name")
```

## 2.3 Las 3 acciones principales

### Read

```ts
store.get("user.name")
```

### Write

```ts
store.set("user.name", "Carlos")
```

### Watch

```ts
store.watch("user.name", cb)
```

## 2.4 Features como plugins

No vender:

- entities
- history
- async
- middleware

Vender:

> Plugins extend core behavior

## 2.5 Interactive Playground

Debe incluir:

- path explorer
- live state tree
- subscription inspector
- derived graph visualizer

## 2.6 Comparación

| Concept | Zustand | Nexus |
|----------|----------|----------|
| Mental model | Store + selectors | Navigable tree |
| Updates | Manual selection | Path propagation |
| Derived state | External | Built-in graph |
| Scalability | Medium | High |

## 2.7 Migration guide

```ts
// Zustand
const name = useStore(s => s.user.name)

// Nexus
useStore("user.name")
```

## 2.8 Diferenciación

Mensaje principal:

> Nexus is not a store.
>
> It is a reactive state graph addressed by paths.

## 2.9 Nueva estructura docs

```txt
/docs
  intro.md
  mental-model.md
  core-api.md
  derived.md
  plugins.md
  performance.md
  migration.md
  advanced.md
```

## 2.10 Homepage

1. Hero
2. State Tree Diagram
3. Three Core APIs
4. Interactive Playground
5. Comparison Table
6. Get Started

---

# Resumen Ejecutivo

## Situación Actual

- Arquitectura fuerte
- Diferenciación real
- Complejidad percibida alta

## Objetivo

Reducir la complejidad mental sin sacrificar capacidad técnica.

## Resultado Esperado

- Menor curva de aprendizaje
- Mayor adopción
- Mejor posicionamiento frente a Zustand
- Categoría propia basada en Path-First State Management
