# Desarrollo

## Stack

| Área | Tecnología |
|------|------------|
| Lenguaje | TypeScript + React 19 |
| Build | Vite (por app/paquete), Turborepo |
| Tests | Vitest + Testing Library |
| Estilos | Tailwind CSS v4 |
| Gestor de paquetes | Yarn 4 workspaces |
| UI | Storybook |

## Comandos del workspace

```bash
yarn start                  # todas las apps en paralelo
yarn build:dev              # build de desarrollo
yarn build:prod             # build de producción
yarn test                   # todos los tests
yarn lint                   # ESLint
yarn typecheck              # tsc --noEmit (todos los paquetes)
```

## Comandos por paquete

Desde `apps/<app>` o `packages/<package>`:

```bash
yarn start
yarn test
yarn test:coverage
yarn lint
yarn typecheck
yarn build:dev
yarn build:prod
```

## Antes de abrir un PR

1. Ejecuta `yarn typecheck` y corrige errores de TypeScript.
2. Ejecuta `yarn lint` y corrige errores de ESLint (los warnings ya existentes pueden mantenerse).
3. Añade o actualiza tests si cambia el comportamiento.
4. Actualiza la documentación si cambian setup, APIs o flujos.

## Estilo de código (resumen)

Las reglas completas están en [claude.md](../../claude.md) (inglés) en la raíz del repositorio. Puntos clave:

- **Prettier**: 120 columnas, 2 espacios, punto y coma, comillas simples, sin comas finales.
- **ESLint**: TypeScript estricto, `prefer-const`, `curly`, imports ordenados con línea en blanco entre grupos.
- **TypeScript**: `strict`, prohibidos locals/parámetros sin usar, `import type` para imports solo de tipos.
- **React**: handlers con `useCallback` con nombre en JSX (sin flechas inline en props); Tailwind para estilos; `clsx` para clases condicionales.
- **Componentes**: una carpeta por componente (PascalCase), barrel `index.ts`, tests y stories en la misma carpeta.

Identificadores y comentarios en el código van en **inglés**; la conversación del equipo puede ser en español.

Los workspaces de Yarn resuelven las dependencias `workspace:*` automáticamente en modo dev — no hace falta enlazar paquetes a mano.

## Contribuir

- Lee [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) (inglés) y [CONTRIBUTOR_TOS.es.md](../../CONTRIBUTOR_TOS.es.md).
- Abre un issue para cambios importantes cuando sea posible.
- Envía PRs contra `main`; las contribuciones son bajo AGPL-3.0.
- Seguridad: [política de seguridad](https://github.com/plitzi/plitzi-workspace/security/policy) del repositorio y `apps/builder/SECURITY.md` / `apps/sdk/SECURITY.md`.

## Ver también

- [Primeros pasos](./getting-started.md)
- [Configuración local](./local-setup.md)
- [Publicaciones](./releases.md)
