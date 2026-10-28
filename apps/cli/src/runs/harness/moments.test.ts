import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { claudeMoments, codexMoments, openCodeMoments, recentMoments } from './moments';

const ROOT = '/work/project';
const SESSION = '2a224fac-8e6c-400b-8982-1459a226e4c9';

let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-moments-'));
  vi.stubEnv('CLAUDE_CONFIG_DIR', path.join(home, 'claude'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

const line = (entry: unknown): string => JSON.stringify(entry);

/** A Claude Code session as it keeps one: the model's turns, their tool calls, the answers — and its request copies. */
const claudeLines = [
  line({
    type: 'assistant',
    timestamp: '2026-10-28T00:45:43.000Z',
    message: {
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: 'Checking b-48:\nthe script.' }
      ]
    }
  }),
  line({
    type: 'assistant',
    timestamp: '2026-10-28T00:45:44.000Z',
    message: {
      content: [
        { type: 'tool_use', name: 'Bash', input: { command: 'npx plitzi task progress --step "reading"\necho done' } },
        { type: 'tool_use', name: 'Read', input: { file_path: `${ROOT}/src/functions/charts.ts` } }
      ]
    }
  }),
  line({
    type: 'user',
    timestamp: '2026-10-28T00:45:45.000Z',
    message: {
      content: [
        { type: 'tool_result', content: '\n  Where the task is: reading\n' },
        { type: 'tool_result', content: [{ type: 'text', text: 'ENOENT: no such file' }], is_error: true }
      ]
    }
  }),
  line({ type: 'api-request-blob', message: { content: [{ type: 'text', text: '<system-reminder>' }] } })
];

// Carlos, reading a headless agent: its own output is its last answer alone, the session the harness keeps is the rest.
describe('an agent’s session, read as it goes', () => {
  it('reads Claude Code’s turns — what it said, each tool on what, the answer’s first line — never its request copies', () => {
    expect(claudeMoments(claudeLines, ROOT).map(each => [each.kind, each.text, each.failed ?? false])).toEqual([
      ['said', 'Checking b-48: the script.', false],
      ['tool', 'Bash npx plitzi task progress --step "reading"', false],
      ['tool', 'Read src/functions/charts.ts', false],
      ['result', 'Where the task is: reading', false],
      ['result', 'ENOENT: no such file', true]
    ]);
  });

  // A row of the sidebar was a task copy's 90-character prefix alone.
  it('says the project’s paths as short as they read: a copy’s from the copy, a scratch’s as scratch/', () => {
    const copy = `${ROOT}/tmp/plitzi-runs/r-1/tasks/s-scope/cache/work`;
    const lines = [
      line({
        type: 'assistant',
        timestamp: 't',
        message: {
          content: [
            { type: 'tool_use', name: 'Write', input: { file_path: `${copy}/tmp/scout/stage.json` } },
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: `${ROOT}/tmp/plitzi-runs/r-1/scratch/scout-1/plitzi run open x --dry-run` }
            }
          ]
        }
      }),
      line({
        type: 'user',
        timestamp: 't',
        message: { content: [{ type: 'tool_result', content: `File created at: ${ROOT}/src/a.ts` }] }
      })
    ];

    expect(claudeMoments(lines, ROOT).map(each => each.text)).toEqual([
      'Write tmp/scout/stage.json',
      'Bash scratch/plitzi run open x --dry-run',
      'File created at: src/a.ts'
    ]);
  });

  it('reads Codex’s answers and function calls, and OpenCode’s parts', () => {
    const codex = [
      line({ type: 'session_meta', payload: { cwd: ROOT } }),
      line({
        timestamp: 't1',
        payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'On it.' }] }
      }),
      line({ timestamp: 't2', payload: { type: 'function_call', name: 'shell', arguments: '{"command":"ls src"}' } }),
      line({ timestamp: 't3', payload: { type: 'function_call_output', output: 'functions\nspace' } })
    ];
    expect(codexMoments(codex, ROOT).map(each => [each.kind, each.text])).toEqual([
      ['said', 'On it.'],
      ['tool', 'shell ls src'],
      ['result', 'functions']
    ]);

    const parts = [
      { at: 't1', data: { type: 'text', text: 'Reading the charts.' } },
      {
        at: 't2',
        data: {
          type: 'tool',
          tool: 'bash',
          state: { input: { command: 'npm test' }, output: 'fail 1', status: 'error' }
        }
      }
    ];
    expect(openCodeMoments(parts, ROOT).map(each => [each.kind, each.text, each.failed ?? false])).toEqual([
      ['said', 'Reading the charts.', false],
      ['tool', 'bash npm test', false],
      ['result', 'fail 1', true]
    ]);
  });

  it('reads a Claude Code session’s last moments off its file — and says when there is none yet', async () => {
    const folder = path.join(home, 'claude', 'projects', '-work-project');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, `${SESSION}.jsonl`), `${claudeLines.join('\n')}\n`);

    const read = await recentMoments(
      { harness: 'claude', session: SESSION, startedAt: '2026-10-28T00:45:00Z' },
      ROOT,
      2
    );
    expect('problem' in read ? read.problem : read.map(each => each.text)).toEqual([
      'Where the task is: reading',
      'ENOENT: no such file'
    ]);
    expect(
      await recentMoments({ harness: 'claude', session: '0'.repeat(8), startedAt: '2026-10-28T00:45:00Z' }, ROOT, 2)
    ).toEqual({ problem: 'no Claude Code session of it on this machine yet' });
  });
});
