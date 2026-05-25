# Primeros pasos

## Requisitos

- **Node.js** ≥ 20
- **Yarn** 4 (el repositorio fija `yarn@4.2.2` en `packageManager` del `package.json` raíz)

## Clonar e instalar

```bash
git clone https://github.com/plitzi/plitzi-workspace.git
cd plitzi-workspace
yarn install
```

## Ejecutar en local

Arranca todas las apps en paralelo (builder, SDK, servidor):

```bash
yarn start
```

Modo depuración con mayor concurrencia en Turbo:

```bash
yarn start:debug
```

Para una sola app, entra en su carpeta y usa el mismo script:

```bash
cd apps/builder
yarn start
```

## Comandos habituales del workspace

```bash
yarn test          # ejecutar todos los tests
yarn lint          # ESLint en todo el monorepo
yarn typecheck     # comprobación TypeScript
yarn build:dev     # build de desarrollo
yarn build:prod    # build de producción
yarn storybook     # componentes UI (puerto 6006)
```

## Entorno local

Para hostnames como `app.plitzi.local` y HTTPS (necesario para `crypto` y dominios personalizados), consulta [Configuración local](./local-setup.md).

## Paquetes publicados

| App / paquete | Nombre en npm |
|---------------|---------------|
| SDK | `@plitzi/plitzi-sdk` |
| Builder | `@plitzi/plitzi-builder` |
| Servidor | `@plitzi/sdk-server` |

## Siguientes pasos

- [Estructura del repositorio](./repository-structure.md)
- [Desarrollo](./development.md)
- [Publicaciones](./releases.md)
