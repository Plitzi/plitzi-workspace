# Releases

Versions are managed with [Changesets](https://github.com/changesets/changesets) across workspace packages.

**Every public package moves together.** `.changeset/config.json` puts `@plitzi/*` in one `fixed` group, so a
release bumps all of them to the same version — whichever packages a changeset names. The packages depend on each
other at `workspace:*` and are published as a set; one version number is what makes "which sdk-server goes with
which sdk" a question nobody has to ask. Private workspaces (examples, e2e, the desktop app) are not versioned.

Keep **one changeset per release** (`.changeset/release.md`), and add to it rather than creating another: list every
public package in its front matter, so each package's `CHANGELOG.md` carries the notes and not just "updated
dependencies", and group the notes under a heading per area.

## Publish a release

1. Create a changeset — or add to the pending `.changeset/release.md`:

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

Each publishable app/package keeps a `CHANGELOG.md` updated by Changesets (for example `apps/sdk/CHANGELOG.md`, `packages/sdk-shared/CHANGELOG.md`).

## See also

- [.changeset/README.md](../../.changeset/README.md)
- [Development](./development.md)
