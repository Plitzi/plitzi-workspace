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
| `edge-128`   | 0.25  | 128 MB | `--single-threaded --max-semi-space-size=4 --max-old-space-size=48`                     |
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
- **A young generation of 4 MB at a quarter core and 128 MB.** At 2 MB one cold start in four rendered half the
  pages a second; at 4 MB none did, for ~7 MB more at its peak. At 64 and 96 MB there is no room for it, and an eighth
  of a core (`micro-128`) has not been measured with it.
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

`yarn agents` is a different bench: not the server's hardware but the agents that write a space. It finds **the
floor** — the smallest model and context whose results are as good as the largest's — which is what the tools an agent
uses are built to lower (`docs/en/agent-tooling.md` § Built for the smallest model). It spends tokens, so nothing runs
without a model named.

```bash
yarn agents --model claude:claude-opus-5-5 --model claude:claude-haiku-4-5-20251001 \
  --model opencode:ollama/qwen3.6:latest --dry-run       # what would run
yarn agents --model claude:claude-haiku-4-5-20251001 --task mcp-text --runs 1
yarn agents --model … --context none --context core --context full --runs 5
yarn agents --report <dir>                               # the report again, from results/agents/<dir>/runs.jsonl
```

- **The ladder**, largest first: the first `--model` is the reference every other is held to. Claude models run in
  Claude Code (`claude -p`, on the account it is signed in to), any other in OpenCode (`ollama/<model>` reaches a local
  Ollama). Each is started with nothing of the person's own setup — project settings only, no MCP server but the
  bench's, the scenario's tools only, and a shell that runs `npx plitzi` and `npm run` and nothing else.
- **The context levels**, swept with the models: `none` (no skill), `core` (the skills as a project carries them) and
  `full` (every reference handed over up front). A smaller context saves tokens until the model guesses what it was
  not shown; that is part of the same curve.
- **The tasks** (`agents/tasks.ts`): three on a space through the MCP — the MCP's dev server, serving a copy of its
  sample per run (`apps/mcp/src/devSample.test.ts` holds it sound: a task the space cannot do is counted as the
  agent's failure) — and three on a project through the CLI, written per run by the workspace's CLI from its catalog
  template; one after a person moved the file the change is in. Each is checked on the result: the space as saved, or
  the project's space authored again.
- **What is measured** (`agents/metrics.ts`), degradation in three kinds: **failure** (the task's check does not
  hold), **hallucination** (a refusal naming something made up — a type, a field, a class, an option) and **the long
  way round** (turns, refusals met, and the waste: the share of a run's tokens spent on the turns after a refusal).
  Tokens are net: what a turn costs beyond the harness's own system prompt and tools, measured per model on a run
  asked for one word. A Claude Code run's output is read from its `result`, the only event that says the whole.
- **A ceiling per run**: three times the reference's median on that task. A run past it fails — a loop is not a slow
  success, and without the ceiling one looping run would hide inside an average.
- **The number that decides: net tokens per verified success** — every run's tokens over the runs the check
  confirmed, so a cheap model that fails or loops costs more per success than a dearer one that does not.
- **The floor** is the smallest configuration that, against the reference, succeeds no more than 5 points less,
  hallucinates no more than 1 point more, wastes no more than 15% of a run's tokens on average and 30% on any task, and
  did every task at least once. Among those that hold, the cheapest per verified success is the one recommended.
- **The report** (`results/agents/<date>/report.md`): the table of every configuration with each rate's 95% interval
  (Wilson's: with five runs, 0% and 100% are common, and the normal interval would call them certain) and the net
  tokens a run from the first to the third quartile — a difference inside them is no difference — then, for each
  configuration, the tasks it broke and why. Every run that failed or met a refusal keeps the harness's stream in
  `transcripts/`, to read what it did.

**The first baseline (2026-11-09, Opus 5.5 alone, 90 runs).** What it settled:

- **The skills' core costs nothing on the MCP and saves nothing on a project for the largest model**: `none` and `core`
  did every task, at 67.5k and 69.1k net tokens per success. A core is for the models below it; a run with them says
  what it buys.
- **Every reference handed over up front never pays**: `full` did every task, at 4.5 to 31 times the tokens of `none`
  (316k for a page added on the MCP, 640k for one title changed in a project) — past the ceiling, so 0% verified. References stay read when a task names
  their subject.
- **On the MCP a turn is the cost**: ~35k net tokens each, ~19k of them the tool listing read again — a two-turn task
  is 70k, a three-turn one 106–109k, with no refusal in 60 runs. A turn saved is worth more than any description
  trimmed.
- **The tolerances are below the noise at this size**: 30 runs a configuration put a 100% success rate's 95% interval
  at 89–100, eleven points wide, against a 5-point tolerance. A difference of 5 points needs a few hundred runs a
  configuration; until a run that size, a configuration is below the floor for what its interval says, not its rate.
- **Two of the bench's own faults, fixed before it counted**: the dev sample dressed twelve elements in classes nothing
  defined (a task refused by the MCP, rightly, and counted as Opus's failure), and a Claude Code run's output was read
  from its turns, 45 tokens for 689.

Not measured yet — the next run: the rungs below Opus (Sonnet, Haiku 5.5 and 4.5, an open model through Ollama), so
the floor is a model and not only a context; and the CLI's tasks again, whose waste this run reads too high — the
workspace's `plitzi` had lost its executable mark in a build (fixed in `apps/cli/vite.config.ts`), and the agents spent
turns working round "Permission denied".

**When it runs.** Five runs or more per task, model and context — agents are not deterministic — at milestones: a
change to what an agent loads or calls (the MCP's tools, a skill's core, a CLI command's output) and a new model worth
a rung. A change enters when no configuration at or above the floor does worse on any of the three kinds and some
configuration's cost per verified success goes down. Between runs, what is free to measure is held by tests: the MCP's
listing (`e2e/connector.test.ts`), the skills' budgets (`skills.test.ts`), each command's output on a fixture project.
