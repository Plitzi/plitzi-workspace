# Releases

Versions are managed with [Changesets](https://github.com/changesets/changesets) across workspace packages.

**Every public package moves together.** `.changeset/config.json` puts `@plitzi/*` in one `fixed` group, so a
release bumps all of them to the same version — whichever packages a changeset names. The packages depend on each
other at `workspace:*` and are published as a set; one version number is what makes "which sdk-server goes with
which sdk" a question nobody has to ask. Private workspaces (examples, e2e, the desktop app) are not versioned.

A release has **two changesets**, and every note goes in the first:

- `.changeset/release.md` names `@plitzi/cli` alone and holds the notes of every package, under a heading per area.
  Add to it rather than creating another changeset.
- `.changeset/release-packages.md` names every other public package and says one thing: the notes are in
  `@plitzi/cli`'s `CHANGELOG.md`. So each package's changelog says where to read, not just "updated dependencies" —
  and the notes are one copy, where seventeen identical ones made whoever upgrades read the same text once per
  package. A new public package goes into its front matter.

The CLI holds them because a project has it installed, and `plitzi upgrade` is where an upgrade starts. **Keep them
short:** a change is one or two lines — what changed and, for a break, what to do (under "To do when you upgrade") —
never its story or its edge cases, which the README and `docs/en` own. Fold a fix into the feature it belongs to
rather than adding a bullet.

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
     answers the places — a line and what to write instead — and, for a place with one right answer (a rename, an
     import whose new home names the same export), its `edit`, written with `--write`. A place without one is said and
     never written: the author decides.
2. Listed in `MIGRATIONS` (`index.ts`), oldest first — each runs on what the ones before it wrote. `index.test.ts`
   holds the list to `changes/` and the order.
3. A test beside it in `changes/`, from `template.test.ts`: what it finds, what it leaves alone and, for places with
   an `edit`, what `--write` makes of the file. And the change named in `.changeset/release.md`.

A migration stays while a project may still be on a version before it. Removing one is a decision, said in the
changeset with what a project still on that version changes by hand.

## Publish a release

0. Bring `plitzi-sdk-server`'s seeds up to date against the unreleased code: portal the packages there and run its
   `yarn typecheck` and `yarn test`. The public docs' guides and the Academy's lessons are seeds — their code
   typechecked, their spaces authored — so a change that breaks or outdates one fails in this step, before anything is
   published.

1. Add to the pending `.changeset/release.md` — or, after a release, create it and `.changeset/release-packages.md`:

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
