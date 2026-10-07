# @plitzi/bench

How much hardware a **self-hosted** Plitzi server needs — the one a user runs and hosts in their own cloud. Each
target is that server, compiled as it is deployed, held to a hardware profile from the smallest edge instance to an
eight-core machine and driven at several concurrencies. It reports what sizing needs: requests a second, latency, CPU
per request, and memory at rest, under load and after it.

```bash
yarn bench                                      # every target at edge-256, in Docker
yarn bench --target sdk-server-render --profile edge-128
yarn bench --profile edge-128 --profile small   # one run per profile
yarn bench --list                               # targets and profiles
yarn bench:report                               # from the root: every profile, a few minutes, then report.md
```

`yarn bench:report` is the one to run before reading the report: the page rendered and the page cached on every profile from an eighth of a
core to eight cores, in short phases — a few minutes; `yarn bench --report` only rewrites `report.md` from what is saved.

Needs Docker. The workspace is mounted read-only into a `node:24-slim` container with the profile's CPU and memory
limits; nothing is installed, so build first — `yarn build:prod` measures what is published, `yarn build:dev` a
development build that renders slower. The first run
downloads the Linux build of the esbuild the workspace uses (the page server's plugin compiler drives it) into
`.cache/`.

## Reading the results

Open **`results/report.md`**: one table — Plitzi at every hardware size measured (RAM at rest and under load, pages
rendered per request, a cached page, the pod size), beside the typical ranges of other Node frameworks from public
benchmarks (not measured here). It is rewritten after every run, and `yarn bench --report` rewrites it from what is
saved without measuring anything.

`results/` keeps the latest run of each profile and runtime — `<profile>-<runtime>.json` and a `.md` table beside it —
and each run replaces the one before, so it never grows. A run worth keeping is a baseline (below).

## What it measures

For every target: it starts cold and waits for its first page (`boot`), lets it idle (`idle`), then holds each
scenario at each concurrency for `--duration` seconds after an unmeasured `--warmup` on the same connections.

| Column            | Meaning                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `req/s`           | Answered requests a second. Closed loop: each connection sends its next request when the last one answered.                                                                  |
| `p50` `p90` `p99` | Latency in ms. Under a CPU quota a request that runs out of it waits for the next period (100 ms), which is why p90 jumps even at one connection.                            |
| `failed`          | Requests with no answer (`err`), and answers with a status the scenario does not expect (`3×500`).                                                                           |
| `cpu ms/req`      | CPU the server spent per answered request — every thread and child process included. The number to size CPU with.                                                            |
| `cores`           | Cores kept busy on average. At the profile's quota means the server is CPU-bound.                                                                                            |
| `throttled`       | Share of scheduler periods that ended with the quota spent.                                                                                                                  |
| `max MB`          | Highest memory charged to the container during the phase. `anon` is the part the kernel cannot drop.                                                                         |
| `heap` `code`     | The process's own view (from a probe preloaded into the server): V8 heap and compiled code. What `anon` holds beyond them lives outside V8 — buffers, malloc, thread stacks. |
| `retained` `peak` | Memory once the load is over, and the highest it ever reached.                                                                                                               |

A server that dies — out of memory, a crash — stops that target's run and the report says how and shows its last
output.

## Profiles

| Profile      | CPU   | Memory | Node flags                                                                              |
| ------------ | ----- | ------ | --------------------------------------------------------------------------------------- |
| `micro-64`   | 0.125 | 64 MB  | `--single-threaded --max-semi-space-size=1 --max-old-space-size=24` — the extreme floor |
| `micro-128`  | 0.125 | 128 MB | `--single-threaded --max-semi-space-size=2 --max-old-space-size=48`                     |
| `edge-64`    | 0.25  | 64 MB  | `--single-threaded --max-semi-space-size=1 --max-old-space-size=24` — the floor         |
| `edge-96`    | 0.25  | 96 MB  | `--single-threaded --max-semi-space-size=1 --max-old-space-size=32`                     |
| `edge-128`   | 0.25  | 128 MB | `--single-threaded --max-semi-space-size=2 --max-old-space-size=48`                     |
| `edge-256`   | 0.25  | 256 MB | `--single-threaded --max-semi-space-size=4 --max-old-space-size=160`                    |
| `small`      | 0.5   | 256 MB | `--single-threaded --max-semi-space-size=4 --max-old-space-size=160`                    |
| `standard`   | 1     | 512 MB | `--max-old-space-size=384`                                                              |
| `medium`     | 2     | 1 GB   | `--max-old-space-size=384` per worker                                                   |
| `large`      | 4     | 2 GB   | `--max-old-space-size=384` per worker                                                   |
| `enterprise` | 8     | 4 GB   | `--max-old-space-size=384` per worker                                                   |
| `unbounded`  | —     | —      | —                                                                                       |

The flags are part of the profile because they are what that hardware should run with, and they were found with
this bench:

- **The heap has to fit beside what lives outside it.** A page server holds ~45 MB off the V8 heap. V8 sizes its heap
  from the machine rather than the container, and under load grows it to its limit even when the live set is a third
  of that — so without a limit the container is killed before V8 collects.
- **Below one core, `--single-threaded`.** V8's background GC and compiler threads bring no parallelism under a
  fraction of a core, only contention for the same quota, and each keeps a malloc arena of its own. At a quarter core
  it rendered ~45% more pages in ~25 MB less.

`--node-options="…"` replaces a profile's flags for one run, `--env KEY=VALUE` adds to the server's environment —
both for trying something before it becomes the default.

## Baselines

`--save-baseline` keeps the run in `baseline/<profile>-<runtime>.json`, merged by target. Every later run of that
profile is compared with it and prints what moved beyond `--tolerance` (10% by default, with a noise floor per
metric); `--check` exits non-zero on a regression, for CI. Whole-run memory only compares between runs that ran the
same scenarios, and a target only against the same target run the same way.

One run on a shared machine can be off by half — a build that just finished, an editor re-reading what it wrote.
Let the machine settle after a build, and before trusting a regression run it again with `--repeat 3`: the target is
started cold three times and each phase keeps its median run. Separate processes, because on a machine whose cores
are not alike (Apple silicon) a container lands on a fast or a slow one for its whole life, up to twice apart.

Numbers are the machine's: a baseline from a laptop says nothing about a CI runner. Compare runs from one machine,
and keep a baseline per machine that matters.

## Targets

Three, in `targets.ts`:

| Target              | What it is                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cli-server`        | A project as `plitzi create` writes it, generated afresh from the built CLI, built with its own `build` and started with `start:prod` — what a self-hoster deploys |
| `sdk-server-render` | A page rendered on every request (the `main` environment, never cached)                                                                                            |
| `sdk-server-cached` | A published page served from the page cache, and the SDK's own files                                                                                               |

Each is compiled to JavaScript before it starts: Node's type stripping would keep a TypeScript transformer in the
process, ~10 MB counted as the server's.

`--runtime local` runs the servers as plain child processes instead: no limits, memory read as resident set size
(which on macOS counts pages a container would not). For a quick before/after on one machine, never to size hardware.

## Agents: how small a model can work on Plitzi

`yarn agents` is a different bench: not the server's hardware but the agents that write a space — RFC 0025's floor,
the smallest model and context whose results are as good as the largest's. It spends tokens, so nothing runs without
a model named, and it is run at milestones rather than on every change.

```bash
yarn agents --model claude:claude-opus-5-5 --model claude:claude-haiku-4-5-20251001 \
  --model opencode:ollama/qwen3.6:latest --dry-run       # what would run
yarn agents --model claude:claude-haiku-4-5-20251001 --task mcp-text --runs 1
yarn agents --model … --context none --context core --context full
yarn agents --report <dir>                               # the report again, from results/agents/<dir>/runs.jsonl
```

- **The ladder**, largest first: the first `--model` is the reference every other is held to. Claude models run in
  Claude Code (`claude -p`, on the account it is signed in to), any other in OpenCode (`ollama/<model>` reaches a local
  Ollama). Each is started with nothing of the person's own setup — project settings only, no MCP server but the
  bench's, the scenario's tools only, and a shell that runs `npx plitzi` and `npm run` and nothing else.
- **The tasks** (`agents/tasks.ts`): three on a space through the MCP — the MCP's dev server, serving a copy of its
  sample per run — and three on a project through the CLI, written per run by the workspace's CLI from its catalog
  template; one after a person moved the file the change is in. Each is checked on the result: the space as saved, or
  the project's space authored again.
- **What is measured** (`agents/metrics.ts`): success; hallucinations (a refusal naming something made up); waste (the
  tokens of the turns after a refusal); net tokens — what a turn costs beyond the harness's own system prompt and tools,
  measured per model on a run asked for one word; and turns.
- **The report** (`results/agents/<date>/report.md`): per configuration, the success, hallucination and waste rates and
  the net tokens per verified success, held to the reference within RFC 0025's tolerances; a run past three times the
  reference's median on its task fails. The floor recommended is the cheapest configuration that holds.
