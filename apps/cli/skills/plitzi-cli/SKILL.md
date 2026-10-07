---
name: plitzi-cli
description: >-
  Use the Plitzi command line (@plitzi/cli, `plitzi …` or `npx @plitzi/cli …`) instead of hand-writing what it
  generates: scaffold a project that renders a space, add plugins to it or build a plugin package, pack, upload and
  install one, edit a space's functions, take a space on Plitzi out as a self-hosted project and back (`create --from`,
  `space pull`, `space push`), check a project (`doctor`) or how its space's source is written (`space lint`), and
  write a report to Plitzi of what broke, misled or cost time (`feedback`). Use whenever the task is to start a Plitzi
  project, create or change a plugin, pack, upload or install one, pull/push/try a space's functions, move a space to a
  server of its own and back, work out which space the CLI is connected to — or when the person asks for a report,
  feedback or a list of what went wrong with Plitzi.
---

# The Plitzi CLI

The CLI writes what an agent would otherwise get subtly wrong by hand: a project's server, bundler, lint and visual test
wired together; a plugin's files in the shape Plitzi's own elements use; a signed-in upload. **Reach for it before
writing any of those yourself.** `plitzi <command> --help` lists every flag.

```bash
npx plitzi element where hero-cta                       # where the code writes an element: file:line and the call
npx plitzi element edit hero-cta --set content="Hi"     # an attribute written there, checked
npx plitzi element remove ent-trust                     # an element taken out, with what only it used
npx plitzi element move ent-faq --before ent-pricing    # an element put elsewhere among its siblings
npx plitzi verify                               # left passing? author, lints, types, format, pages
npx plitzi page check -- /about --width 1440,390     # whether a page is whole, in text
npx plitzi explain navigate                     # what a name means: element, step, code, any export
npx plitzi doctor                               # whether the project is whole; --fix the simple parts
npx plitzi upgrade                              # the project up to this CLI (--write)
npx plitzi feedback                             # a report to Plitzi, for the person to send as a link
```

## Running it as an agent

- **Which check.** All of it before you finish: `verify` — only what fails is printed. The space alone: `npm run
  author`; a page: `page check`. The project around them: `doctor`, before `space push`. Pages for signed-in visitors
  are checked as the account `.env` names (`PLITZI_CHECK_USER`, `PLITZI_CHECK_PASSWORD`); `verify` says when none is.
- **`create` never decides for the person.** With nobody at the terminal it writes nothing and prints each choice as a
  question: ask the user, then run again with their answers as flags. Never guess them.
- **Signing in happens in the browser** (`login`, `space use`, a first `plugin upload`): tell the person a tab is waiting.
- **One space at a time** — the one `whoami --json` names; `plitzi space use` switches it.
- **A report to Plitzi** — the person asks for a report, feedback, the bugs found or what cost time: `npx plitzi
  feedback` (`--previous <link>` continues an earlier one). It reads the versions and `doctor` itself and writes the
  page; fill it and publish it as its brief says, rather than a report of your own making.
- **Read stdout, exit code and stderr apart.** The answer is on stdout (`--json`: one line); exit 1 means it did not do
  what was asked. A refusal says what to change: change it — the same refusal twice says to stop and ask.

**The MCP or this CLI.** A space written in code (`src/space/`) is this CLI's, with no account. One kept on Plitzi —
edited in the builder — is the Plitzi MCP's. Never both on one space.

## What to read

| The task                                                                   | Read                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------- |
| Start a project, its modes, scripts and port                               | [projects](reference/projects.md)               |
| An element of your own, a plugin package, packing and uploading one        | [plugins](reference/plugins.md)                 |
| A space on Plitzi as a project, and back (`create --from`, `space pull`, `space push`) | [from-space](reference/from-space.md)           |
| The space's own server code (`functions`, `runtime`)                       | [functions](reference/functions.md)             |
| Something does not work                                                    | [troubleshooting](reference/troubleshooting.md) |
