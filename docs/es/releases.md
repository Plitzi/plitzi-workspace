# Publicaciones

Las versiones se gestionan con [Changesets](https://github.com/changesets/changesets) en los paquetes del workspace.

## Publicar una release

1. Crea un changeset y selecciona los paquetes afectados:

   ```bash
   yarn changeset
   ```

2. Sube las versiones según los changesets acumulados:

   ```bash
   yarn changeset version
   ```

3. Crea una **release en GitHub** con el changelog y los tags generados.

4. CI puede publicar en npm con:

   ```bash
   yarn ci:publish
   ```

   (Suele ejecutarse desde CI, no manualmente.)

## Verificar tarballs antes de publicar

```bash
yarn check-tgz
```

Comprueba que los `package.json` empaquetados no conserven referencias `workspace:*` sin resolver.

## Changelogs

Cada app/paquete publicable mantiene un `CHANGELOG.md` actualizado por Changesets (por ejemplo `apps/sdk/CHANGELOG.md`, `packages/sdk-store/CHANGELOG.md`).

## Ver también

- [.changeset/README.md](../../.changeset/README.md)
- [Desarrollo](./development.md)
