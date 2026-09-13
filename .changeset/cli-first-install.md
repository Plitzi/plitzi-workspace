---
'@plitzi/cli': patch
---

`plitzi create` installs with npm again, says so when it cannot, and tests every page.

- **The generated project installs.** It pinned `eslint@^9` beside `@eslint/js@^10`, whose peer is `eslint@^10`,
  so `npx @plitzi/cli create` with npm stopped on `ERESOLVE` before writing `node_modules`. `eslint` is now `^10`,
  and a test holds the two majors together.
- **A failed install is a failed command.** The summary used to print on its own after the resolver's errors, which
  read as success; now it is preceded by a red line naming the command that failed, and the exit code is 1.
- **The visual test covers every page.** It checked only the home page, so the second page a space grew was never
  opened. It now runs one test per page the space declares.
