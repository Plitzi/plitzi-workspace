# Refusals

<!-- Written from `@plitzi/sdk-shared/refusals` and the CLI’s run refusals (`apps/cli/src/core/refusal.ts`):
`yarn generate:refusals` in `apps/cli`. Edit those tables, never this page. -->

When a command of the CLI or a tool of the MCP does not do what it was asked, it says why with one of the codes
below and the step to take next. The CLI prints the step under the problem (`Next (<code>): …`) and exits 1 — 2 for
`unanswered`, which is the machine’s, not the work’s; the MCP answers each error with its `code`, its `path` and a
`hint` that names the step for that error. `plitzi explain <code>` answers any of them.

What a space’s document is refused for is authoring’s, and listed with it in the `plitzi-authoring` skill
(`authoring-errors.md`).

## Commands and tools

| Code | Means | Next | Raised by |
|---|---|---|---|
| `wrong-options` | options given together that do not go together, or one given without the one it needs | change the options as the message says; the command’s --help lists what each takes | the CLI, the MCP |
| `bad-value` | a value an option, an argument or a field does not take: not an address, not one of a list, not JSON | write one of the values the message names, in the shape it shows | the CLI, the MCP |
| `not-a-project` | the command works on a project, and the folder it ran in is not one of the kind it needs | run it in the project’s folder: plitzi create makes one, and plitzi doctor says what a project lacks | the CLI |
| `old-layout` | the project is laid out as an older CLI left it, and this command would write it for another layout | run plitzi doctor --fix, which moves it with every import, then the command again | the CLI |
| `missing` | what the call names is not there: a file, an element, a page, a task, a bucket | name one that is: the message lists them, or says where they are listed | the CLI, the MCP |
| `exists` | the place it would write already holds something it would replace | choose another name or place; --force replaces it, where the command takes it and the person agrees | the CLI, the MCP |
| `unreadable` | a file or an answer that could not be read as what the command takes | check the path, and that the file is what the message says it should be | the CLI |
| `does-not-build` | what was to be built, packed or installed did not build: its own words are in the message | fix what the build says, then run the command again | the CLI |
| `signed-out` | no session for the platform, or one it no longer takes | sign in with plitzi login, then run the command again | the CLI |
| `not-allowed` | what was asked is not this account’s, this plan’s or this surface’s to do | do it where the message says it is done, or ask a person whose role or plan allows it | the CLI, the MCP |
| `refused-by-platform` | the platform refused what was sent, in its own words | do what the platform’s words say; when they name no fix, plitzi doctor checks the connection and the project | the CLI |
| `changed-since` | what is there changed since this copy last had it, and sending would replace that change | pull first (plitzi space pull) — over the MCP, read it again — apply your change on what it brings, and send it again | the CLI, the MCP |
| `unanswered` | nothing answered: a server not running, an address nothing serves, a browser that did not start | start what the message names (npm start, plitzi server) or install it (plitzi browser install); plitzi doctor checks the machine | the CLI, the MCP |
| `nobody-to-ask` | a choice that belongs to a person, and nobody is at the terminal to make it | ask the person each question the message lists, then run the command again with their answers | the CLI |
| `in-use` | what would be removed or changed is still used, or still running | stop or repoint what uses it first: the message names each | the CLI, the MCP |
| `outdated` | this client is older than the oldest the platform takes | in a project, plitzi upgrade packages (the CLI is one of them); elsewhere, npx @plitzi/cli@latest — then run the command again | the CLI |
| `repeated` | the same call was refused twice before and was not run again: the answer would not change | change what the errors named — plitzi_describe_operation gives an operation’s fields — or ask the person what they meant | the MCP |
| `failed` | what the command ran failed on its own: a task, a step, an install | read the failure the message carries, fix it in the project, and run the command again | the CLI |

## A run’s commands

A run’s commands (`plitzi run …`, `plitzi task …`) refuse with codes of their own, each with an exit code a script
branches on without reading the output; with `--json` the refusal is `{ refused, message, next }`.

| Code | Exit | Next |
|---|---|---|
| `claimed` | 10 | take another ready task (plitzi task next), or wait for the file (plitzi task claim <file> --wait) |
| `waiting` | 11 | take another ready task meanwhile; the file comes to this task when its holder is approved |
| `reassigned` | 12 | stop working on this task: it is no longer yours |
| `version-mismatch` | 13 | the Plitzi version changed while the run is open: a person re-pins it in their terminal (plitzi run attach) — an agent keeps its work in its copy and waits (plitzi task next waits through it); the lead tells the person |
| `stopping` | 14 | finish the task in hand and take no other |
| `forced-stop` | 15 | stop writing now: a task in hand was cut, and what it wrote since its last review is not kept (a task in review keeps its work); plitzi task next waits for the lead to resume the run |
| `reconciliation` | 16 | wait: the lead resolves each file (plitzi run resolve), then continues the run |
| `person-only` | 17 | ask a person to run it in their own terminal |
| `conflict` | 18 | the lead decides, from what the message offers; a task takes the run’s version (plitzi task discard <file>) and redoes its change on it; never write conflict markers |
| `checks-failed` | 19 | fix each step marked ✗ below, then complete again (plitzi task check runs them without completing) |
| `invalid` | 20 | do what the refusal above says, then run the command again |
| `not-found` | 21 | check the name: plitzi run status --all lists the runs and their tasks |
| `other-machine` | 22 | the run is active on another machine: release it there (plitzi run attach <run> --release), or a person takes it over |
| `another-run` | 23 | one run at a time: finish or abort the open one first (plitzi run status) |
| `agent-limit` | 24 | hand back to the lead: this task waits until one of the agents at work has nothing in progress (plitzi run status) |
| `lead-only` | 25 | it is the lead’s (lead) to do: leave it to it, and go on with your own part |
| `identity` | 26 | pass your own token (--token): the one your first command on the run printed, kept in its scratch/<you>/token — never another’s |
