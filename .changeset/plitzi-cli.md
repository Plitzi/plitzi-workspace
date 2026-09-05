---
'@plitzi/cli': minor
---

A command line, with one command that matters: `plitzi init`.

It scaffolds a server that renders a space living in Plitzi — `package.json`, `tsconfig.json`, `src/main.ts`,
`.env`, `.gitignore` and a README — so the first run is `npm install && npm start`. Everything it writes was
already documented, which was the problem: a person had to read four things and write three files correctly
before they could tell whether any of it worked.

It never mints a credential. The self-hosting key comes from Credentials in the builder, is written to `.env`,
and `.gitignore` is written in the same breath.
