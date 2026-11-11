import { REFUSALS } from '@plitzi/sdk-shared/refusals';

import { runRefusals } from './refusal';

import type { RefusalSurface } from '@plitzi/sdk-shared/refusals';

const SURFACE: Record<RefusalSurface, string> = { cli: 'the CLI', mcp: 'the MCP' };

const cell = (text: string): string => text.replaceAll('|', '\\|');

/**
 * `docs/en/refusals.md`: every code a command of the CLI, a tool of the MCP and a run's commands refuse with, what it
 * means and what to do next — written from the tables the refusals are raised with, so the page cannot miss one.
 */
export const refusalsPage = (): string =>
  [
    '# Refusals',
    '',
    '<!-- Written from `@plitzi/sdk-shared/refusals` and the CLI’s run refusals (`apps/cli/src/core/refusal.ts`):',
    '`yarn generate:refusals` in `apps/cli`. Edit those tables, never this page. -->',
    '',
    'When a command of the CLI or a tool of the MCP does not do what it was asked, it says why with one of the codes',
    'below and the step to take next. The CLI prints the step under the problem (`Next (<code>): …`) and exits 1 — 2 for',
    '`unanswered`, which is the machine’s, not the work’s; the MCP answers each error with its `code`, its `path` and a',
    '`hint` that names the step for that error. `plitzi explain <code>` answers any of them.',
    '',
    'What a space’s document is refused for is authoring’s, and listed with it in the `plitzi-authoring` skill',
    '(`authoring-errors.md`).',
    '',
    '## Commands and tools',
    '',
    '| Code | Means | Next | Raised by |',
    '|---|---|---|---|',
    ...Object.entries(REFUSALS).map(
      ([code, refusal]) =>
        `| \`${code}\` | ${cell(refusal.means)} | ${cell(refusal.next)} | ${refusal.surfaces.map(surface => SURFACE[surface]).join(', ')} |`
    ),
    '',
    '## A run’s commands',
    '',
    'A run’s commands (`plitzi run …`, `plitzi task …`) refuse with codes of their own, each with an exit code a script',
    'branches on without reading the output; with `--json` the refusal is `{ refused, message, next }`.',
    '',
    '| Code | Exit | Next |',
    '|---|---|---|',
    ...runRefusals().map(({ code, exitCode, next }) => `| \`${code}\` | ${String(exitCode)} | ${cell(next)} |`),
    ''
  ].join('\n');
