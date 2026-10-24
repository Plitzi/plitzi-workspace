---
name: plitzi-cli
description: >-
  Use the Plitzi command line (@plitzi/cli, `plitzi …` or `npx @plitzi/cli …`) instead of hand-writing what it
  generates: scaffold a project that renders a space, add plugins to it or build a plugin package, pack, upload and
  install one, edit a space's functions, take a space on Plitzi out as a self-hosted project and back (`create --from`,
  `space pull`, `space push`), check a project (`doctor`) or how its space's source is written (`space lint`), follow
  what each save does (`space watch`) and what others do on the space (`space activity`), and write a report to Plitzi
  of what broke, misled or cost time (`feedback`). Use whenever the task is to start a Plitzi project, create or change
  a plugin, pack, upload or install one, pull/push/try a space's functions, move a space to a server of its own and
  back, work out which space the CLI is connected to — or when the person asks for a report, feedback or a list of what
  went wrong with Plitzi. Multi-agent mode — a team of agents, several or parallel agents, subagents at once, agent
  orchestration or a swarm, in any language ("con un equipo de agentes", "varios agentes en paralelo"): `run start`,
  then `run`, `task` — only when the person asks for it.
---

# The Plitzi CLI

The CLI writes what an agent would otherwise get subtly wrong by hand: a project's server, bundler, lint and visual test
wired together; a plugin's files in the shape Plitzi's own elements use; a signed-in upload. **Reach for it before
writing any of those yourself.** `plitzi <command> --help` lists every flag; `plitzi --help`, every command by what it
is for.

## A person new to Plitzi

They ask for what they want; the project, the commands and the checks are yours to run. With no project yet:

1. **Make it:** `npx @plitzi/cli create <dir>` — with nobody at its terminal it prints each choice as a question: ask
   the person in plain words (served or browser-only, the space in code or on Plitzi), then run it with their answers
   as flags. Never guess them.
2. **Serve it and show it:** `npm start`, and give them the address it prints.
3. **Change what they ask:** in `src/space/` — `npx plitzi element where <id|words>` says where an element is written;
   `npx plitzi space watch --json` in the background answers each save with what it did.
4. **Leave it passing:** `npx plitzi verify` before you say it is done — only what fails is printed.

```bash
npx plitzi element edit hero-cta --set content="Hi"     # an attribute written where the code has it, checked
npx plitzi element remove ent-trust                     # an element taken out, with what only it used
npx plitzi element move ent-faq --before ent-pricing    # an element put elsewhere among its siblings
npx plitzi page check -- /about --width 1440,390        # whether a page is whole, in text
npx plitzi space activity --follow --json               # what others do on the space: edits, versions, failures
npx plitzi explain navigate                             # what a name means: element, step, code, any export
npx plitzi explain --search "carousel end"              # whether Plitzi has a way: fields, steps, states, commands
npx plitzi doctor                                       # whether the project is whole; --fix the simple parts
npx plitzi upgrade                                      # the project up to this CLI (--write)
npx plitzi cert                                         # HTTPS for a phone on the Wi-Fi (with HOST=0.0.0.0)
npx plitzi server stop --port 4793                      # this folder's own, never pkill
```

## Alone, or a team of agents

**You work the project yourself, by default** — everything above is for that. A team of agents (multi-agent mode) is
for a job big enough to split — a section of many pages, a translation, a redesign — only when the person asks for one
or agrees when you propose it — in plain words: several agents in parallel, each in a copy, nothing in their project
until they apply it. Then `npx plitzi run start "<the ask>"` checks the project, opens the run and says each
step: you lead it ([runs-lead](reference/runs-lead.md)), `npx plitzi run agent <name> --launch` starts each agent, and
the person applies the result. `run …` and `task …` are the team's alone — never on a job of your own. Started as an
agent of a run (its prompt says so): [runs](reference/runs.md) — a designer's half: [runs-designer](reference/runs-designer.md).

## Running it as an agent

- **Which check.** All of it before you finish: `verify`. The space alone: `npm run
author`; a page: `page check`. The project around them: `doctor`, before `space push`. Pages for signed-in visitors
  are checked as the account `.env` names (`PLITZI_CHECK_USER`, `PLITZI_CHECK_PASSWORD`); `verify` says when none is.
- **Be told, don't ask again.** While you edit `src/space/`, run `space watch --json` in the background: each save
  answers with what it changed, the problems it brought and fixed, or why the space stopped authoring. On a space
  people edit too, `space activity --follow --json` says their edits and the actions that fail as they happen.
- **Signing in happens in the browser** (`login`, `space use`, a first `plugin upload`): a tab waits for the person.
- **One space at a time** — the one `whoami --json` names; `plitzi space use` switches it.
- **A report to Plitzi** — the person asks for a report, feedback, the bugs found or what cost time: `npx plitzi
feedback` (`--previous <link>` continues an earlier one). It reads the versions and `doctor` and writes the page:
  fill and publish it as its brief says.
- **Read stdout, exit code and stderr apart.** The answer is on stdout (`--json`: one line); exit 1 means it did not do
  what was asked; a page command's 2, that it could not read what it asked (nothing served, the other page's element
  missing). A refusal says what to change: change it — the same refusal twice says to stop and ask.

**The MCP or this CLI.** A space written in code (`src/space/`) is this CLI's, with no account. One kept on Plitzi —
edited in the builder — is the Plitzi MCP's. Never both on one space.

## What to read

| The task                                                                               | Read                                            |
| -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Start a project, its modes, scripts and port                                           | [projects](reference/projects.md)               |
| An element of your own, a plugin package, packing and uploading one                    | [plugins](reference/plugins.md)                 |
| A space on Plitzi as a project, and back (`create --from`, `space pull`, `space push`) | [from-space](reference/from-space.md)           |
| The space's own server code (`functions`, `runtime`)                                   | [functions](reference/functions.md)             |
| Something does not work                                                                | [troubleshooting](reference/troubleshooting.md) |
