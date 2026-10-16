# Releases

Versions are managed with [Changesets](https://github.com/changesets/changesets) across workspace packages.

**Every public package moves together.** `.changeset/config.json` puts `@plitzi/*` in one `fixed` group, so a
release bumps all of them to the same version — whichever packages a changeset names. The packages depend on each
other at `workspace:*` and are published as a set; one version number is what makes "which sdk-server goes with
which sdk" a question nobody has to ask. Private workspaces (examples, e2e, the desktop app) are not versioned.

Keep **one changeset per release** (`.changeset/release.md`), and add to it rather than creating another: list every
public package in its front matter, so each package's `CHANGELOG.md` carries the notes and not just "updated
dependencies", and group the notes under a heading per area.

## A change a project's source has to follow

A release that renames a name, moves an import or flips a default that a project's own source counts on ships its
**migration**, which `plitzi upgrade migrations` runs over the project's `src/` and `visual/`:

`apps/cli/src/migrations/` holds the machinery (`types.ts`, `run.ts`, the list in `index.ts`) and the template;
`changes/` holds the migrations, one file each and nothing else.

1. One file in `changes/`, a copy of `template.ts` (a rename: the commonest kind) named by what it changes, exporting a
   `Migration` (`types.ts`):
   - `since` — the version it ships in, shown beside every place it finds;
   - `scope` — `always` when what it finds is broken whenever the project was last upgraded (an import the installed
     package no longer answers), `until-upgraded` when a project upgraded past `since` was already told (a default that
     flipped);
   - `start(project)` — what it reads once (what is installed), returning the finder run on each source file, which
     answers the lines and what to write instead;
   - `rewrite` — only for a change with one right answer, a rename, written with `--write`. Without it the place is
     said and never written: the author decides.
2. Listed in `MIGRATIONS` (`index.ts`), oldest first — each runs on what the ones before it wrote. `index.test.ts`
   holds the list to `changes/` and the order.
3. A test beside it in `changes/`, from `template.test.ts`: what it finds, what it leaves alone and, with a
   `rewrite`, what `--write` makes of the file. And the change named in `.changeset/release.md`.

A migration stays while a project may still be on a version before it. Removing one is a decision, said in the
changeset with what a project still on that version changes by hand.

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
