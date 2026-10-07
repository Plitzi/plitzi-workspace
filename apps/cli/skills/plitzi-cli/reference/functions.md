# A space's server code (`functions`, `runtime`)

A space's own server code — TypeScript tasks its actions run as steps, and routes under `/fn/` — lives in the space;
`src/functions/` in a project is a **working copy** of it. The contract (`defineFunctions`, `ctx`) is typed in
`@plitzi/sdk-server/functions`, whose `.d.ts` documents every field; what matters for the CLI:

- **Pull before you edit, push when done.** `functions pull` refuses to overwrite what is not pushed (`--force` throws it
  away); `functions push` refuses when the space changed since the pull — someone saved in the builder. Then: keep your
  changes aside, `functions pull`, apply them again, `functions push`. Never `--force` over somebody else's work to get past it.
- **A push is checked, not just stored.** A problem comes back as `src/functions/<file>:<line> <message>` and nothing is
  saved — fix it and push again. `index.ts` must default-export `defineFunctions({ … })`; files import each other by
  relative path and `@plitzi/sdk-server/functions`, nothing else. `src/data/` is read with `ctx.data('x.json')`, never
  imported (`dev` reads the project's).
- **`try` runs the saved draft for real** (its fetches and writes happen). `dev` runs `src/functions/` on this machine with
  the project's own `@plitzi/sdk-server` — `npm install -D @plitzi/sdk-server isolated-vm core-js` first — and sends
  nothing to the space; `PLITZI_FUNCTIONS_CREDENTIALS='{"stripe":{"apiKey":"…"}}'` gives it credentials to name.
- **A run gets 100 ms of CPU and 10 s.** A task that needs more asks with `limits: { cpuMs, wallMs }` (or
  `defineFunctions({ limits })` for all), up to the plan's ceiling; asking above it is a problem the push reports.
- **The live site runs what the space was last published with.** A push changes the draft; publishing is the person's.

## A space's runtime (`runtime`)

What a function cannot be — Node packages, a connection held open, state across requests — is the space's **runtime**:
`src/runtime/index.ts` (`plitzi runtime add`), default-exporting `defineRuntime` from `@plitzi/sdk-server/runtime` (its
`.d.ts` documents it). The project's server runs it as Plitzi does, so try it with `npm start` before pushing.

- `runtime push` packs it (`--entry` for another file) as the draft's runtime; publishing deploys it. Its source goes
  up with it, so `create --from` brings it back.
- `runtime status` (`--json`) says how each environment's runs, and its variables' names. `runtime vars set NAME`
  reads the value from stdin (`printf %s "$V" | …`), never echo it in a command line; `vars unset NAME` removes one.
- `runtime size small|medium|large`, `stop`, `start` — the draft's unless `--environment` names a published one.
- It needs a plan that includes runtimes and a private bucket on the space's CDN; a refusal says which is missing.
