---
'@plitzi/cli': patch
---

`plitzi create` installs on release day under npm, pnpm and Yarn, says why when it cannot, and tests every page.

Every case below was reproduced by scaffolding a project and installing it, not inferred.

- **npm: the generated project installs.** It pinned `eslint@^9` beside `@eslint/js@^10`, whose peer is `eslint@^10`,
  so npm stopped on `ERESOLVE` before writing `node_modules`. `eslint` is now `^10`, and a test holds the two majors
  together.
- **npm: no unreviewed install scripts.** npm 11 lists them on every install and has announced it will block them.
  `package.json` now carries `allowScripts` (esbuild approved, fsevents — a prebuilt binary — refused).
- **pnpm: the install no longer fails.** pnpm stopped with `ERR_PNPM_IGNORED_BUILDS` over esbuild. The project now
  gets a `pnpm-workspace.yaml` with `allowBuilds: { esbuild: true }` and `@plitzi/*` excluded from
  `minimumReleaseAge`.
- **Yarn: `@plitzi/*` is not quarantined.** Yarn refuses packages younger than a day (YN0016), which on release
  day is every one of ours. `.yarnrc.yml` now preapproves `@plitzi/*`, and nothing else — and only when the
  installed Yarn is 4.10 or later, because Yarn 4.9 refuses the whole file over a setting it does not know.
- **A failed install is a failed command.** The summary used to print after the manager's errors and read as
  success. It is now preceded by a red line naming the command, a hint for that manager's usual refusal, and exit
  code 1.
- **The visual test covers every page a visit can open.** It checked only `/`. It now runs one test per page,
  skipping pages behind a session or with route params, and elements shown only under a condition.
