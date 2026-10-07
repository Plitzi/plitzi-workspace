# Estructura del repositorio

Monorepo Turborepo: aplicaciones frontend y paquetes compartidos del SDK.

```
plitzi-workspace/
├── apps/
│   ├── builder/     # Builder visual (@plitzi/plitzi-builder)
│   ├── sdk/         # App del SDK Plitzi (@plitzi/plitzi-sdk)
│   ├── server/      # Servidor de páginas: SSR / RSC (@plitzi/sdk-server)
│   ├── mcp/         # Superficie de IA: servidor MCP (@plitzi/sdk-mcp)
│   ├── cli/         # Crea proyectos y plugins, sube código a un space, saca un space como proyecto (@plitzi/cli)
│   └── desktop/     # Cliente de escritorio
├── packages/
│   ├── sdk-auth/
│   ├── sdk-authoring/   # Autoría offline de espacios y plantillas (@plitzi/sdk-authoring)
│   ├── sdk-dev-tools/
│   ├── sdk-elements/
│   ├── sdk-event-bridge/
│   ├── sdk-interactions/
│   ├── sdk-navigation/
│   ├── sdk-plugins/
│   ├── sdk-schema/
│   ├── sdk-shared/      # ESLint, TSConfig, tipos y utilidades compartidas
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
| `apps/mcp` | Servidor MCP y herramientas de IA, que dependen de las entradas acotadas de `apps/server` (nunca al revés) — un despliegue que solo sirve páginas nunca lo instala |

## Paquetes

Los paquetes en `packages/sdk-*` son librerías del workspace importadas por las apps y entre sí. Se versionan y publican juntos mediante [Changesets](./releases.md).

## Mapa de documentación

| Tema | Ubicación |
|------|-----------|
| Guías del monorepo | `docs/en/` o `docs/es/` — ¿recién llegado? [Onboarding](./onboarding.md) |
| Decisiones de diseño | `docs/rfc/` (inglés) |
| API del servidor SSR | `apps/server/README.md` (inglés) |
| Superficie MCP / IA | `apps/mcp/README.md` (inglés) |
| Backend: API, auth, base de datos | [Plitzi/plitzi-sdk-server](https://github.com/plitzi/plitzi-sdk-server) (repositorio aparte, en inglés) |
| API del store (Nexus) | [Plitzi/nexus](https://github.com/Plitzi/nexus) (repositorio aparte, en inglés) |
| Convenciones de código | `claude.md` |
