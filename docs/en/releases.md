# Releases

Versions are managed with [Changesets](https://github.com/changesets/changesets) across workspace packages.

## Publish a release

1. Create a changeset and select affected packages:

   ```bash
   yarn changeset
   ```

2. Bump versions from accumulated changesets:

   ```bash
   yarn changeset version
   ```

3. Create a **GitHub release** with the generated changelog and tags.

4. CI can publish to npm with:

   ```bash
   yarn ci:publish
   ```

   (Typically run from CI, not manually.)

## Verify tarballs before publish

```bash
yarn check-tgz
```

Ensures packed `package.json` files do not still contain unresolved `workspace:*` references.

## Changelogs

Each publishable app/package keeps a `CHANGELOG.md` updated by Changesets (for example `apps/sdk/CHANGELOG.md`, `packages/nexus/CHANGELOG.md`).

## See also

- [.changeset/README.md](../../.changeset/README.md)
- [Development](./development.md)
