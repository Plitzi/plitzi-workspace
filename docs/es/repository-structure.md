# Estructura del repositorio

Monorepo Turborepo: aplicaciones frontend y paquetes compartidos del SDK.

```
plitzi-workspace/
├── apps/
│   ├── builder/     # Builder visual (@plitzi/plitzi-builder)
│   ├── sdk/         # App del SDK Plitzi (@plitzi/plitzi-sdk)
│   └── server/      # Servidor SSR / RSC / MCP (@plitzi/sdk-server)
├── packages/
│   ├── sdk-auth/
│   ├── sdk-collections/
│   ├── sdk-data-source/
│   ├── sdk-dev-tools/
│   ├── sdk-elements/
│   ├── sdk-event-bridge/
│   ├── sdk-interactions/
│   ├── sdk-navigation/
│   ├── sdk-plugins/
│   ├── sdk-schema/
│   ├── sdk-shared/      # ESLint, TSConfig, tipos y utilidades compartidas
│   ├── sdk-state/
│   ├── sdk-store/     # Store React (useSyncExternalStore)
│   ├── sdk-style/
│   └── sdk-variables/
├── docs/
│   ├── en/            # Documentación en inglés
│   └── es/            # Documentación en español
├── claude.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTOR_TOS.md / CONTRIBUTOR_TOS.es.md
├── COMMERCIAL_LICENSE.md / COMMERCIAL_LICENSE.es.md
├── LICENSE            # AGPL-3.0 (texto legal en inglés)
└── package.json       # Scripts del workspace (Turbo + Yarn)
```

## Apps

| Ruta | Función |
|------|---------|
| `apps/builder` | Interfaz principal para diseñar y editar espacios Plitzi |
| `apps/sdk` | Bundle del SDK usado por espacios y el servidor SSR |
| `apps/server` | Servidor HTTP para SSR, RSC, plugins y assets estáticos |

## Paquetes

Los paquetes en `packages/sdk-*` son librerías del workspace importadas por las apps y entre sí. Se versionan y publican juntos mediante [Changesets](./releases.md).

## Mapa de documentación

| Tema | Ubicación |
|------|-----------|
| Guías del monorepo | `docs/en/` o `docs/es/` |
| API del servidor SSR | `apps/server/README.md` (inglés) |
| API del store | `packages/sdk-store/README.md` (inglés) |
| Convenciones de código | `claude.md` |
