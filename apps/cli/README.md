# @plitzi/cli

The command line for Plitzi.

```bash
npx @plitzi/cli init my-site
```

## `init`

Scaffolds a server that renders a space living in Plitzi. The space stays in the builder — edited, published and
versioned there — and every request is served from the generated project, under its own domain, auth and logs.

```bash
plitzi init                                   # into the current directory, asking for the key
plitzi init my-site --key host_…              # named, non-interactively
plitzi init my-site --environment production  # serve a published version instead of what the builder is editing
plitzi init . --force                         # write into a directory that is not empty
```

It writes six files: `package.json`, `tsconfig.json`, `src/main.ts`, `.env`, `.gitignore` and a `README.md`. The
first run is then `npm install && npm start`.

**The key is secret and is treated as one.** `init` never mints a credential — the self-hosting key comes from
Credentials in the builder — and it writes it to `.env`, with `.gitignore` written in the same breath. It is not
the public `render` key a published page embeds: that one is protected by the origin a browser states, and a
server states none.

The generated `src/main.ts` carries the reasoning it needs to be read, rather than assuming its owner will find
the documentation: which credential is which, and what `PLITZI_ENVIRONMENT` and `PLITZI_REVISION` decide about
which version of the space is served.
