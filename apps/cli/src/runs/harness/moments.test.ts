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
        {
          type: 'tool_use',
          id: 'u1',
          name: 'Bash',
          input: { command: 'npx plitzi task progress --step "reading"\necho done' }
        },
        { type: 'tool_use', id: 'u2', name: 'Read', input: { file_path: `${ROOT}/src/functions/charts.ts` } }
      ]
    }
  }),
  line({
    type: 'user',
    timestamp: '2026-10-28T00:45:45.000Z',
    message: {
      content: [
        { type: 'tool_result', tool_use_id: 'u1', content: '\n  Where the task is: reading\n' },
        {
          type: 'tool_result',
          tool_use_id: 'u2',
          content: [{ type: 'text', text: 'ENOENT: no such file' }],
          is_error: true
        }
      ]
    }
  }),
  line({ type: 'api-request-blob', message: { content: [{ type: 'text', text: '<system-reminder>' }] } })
];

// Carlos, reading a headless agent: its own output is its last answer alone, the session the harness keeps is the rest.
describe('an agent’s session, read as it goes', () => {
  it('reads Claude Code’s turns — what it said, each tool on what, the answer’s first line — never its request copies', () => {
    expect(
      claudeMoments(claudeLines, ROOT).map(each => [each.kind, each.text, each.failed ?? false, each.call])
    ).toEqual([
      ['said', 'Checking b-48: the script.', false, undefined],
      // A call and its answer share its id: opened, the monitor shows both.
      ['tool', 'Bash npx plitzi task progress --step "reading"', false, 'u1'],
      ['tool', 'Read src/functions/charts.ts', false, 'u2'],
      ['result', 'Where the task is: reading', false, 'u1'],
      ['result', 'ENOENT: no such file', true, 'u2']
    ]);
  });

  // Carlos could not read a moment the sidebar cut: its whole is kept, opened under it.
  it('keeps a moment’s whole when its line says less — a message’s lines, a command, an answer — and only then', () => {
    const lines = [
      line({
        type: 'assistant',
        timestamp: 't',
        message: {
          content: [
            { type: 'text', text: 'First line.\nSecond line.' },
            { type: 'tool_use', name: 'Read', input: { file_path: `${ROOT}/src/a.ts` } }
          ]
        }
      }),
      line({
        type: 'user',
        timestamp: 't',
        message: { content: [{ type: 'tool_result', content: `head\n${'x'.repeat(5000)}` }] }
      })
    ];
    const [said, read, answer] = claudeMoments(lines, ROOT);

    expect(said).toMatchObject({ text: 'First line. Second line.', whole: 'First line.\nSecond line.' });
    expect(read.whole).toBeUndefined();
    expect(answer.text).toBe('head');
    expect(answer.whole).toMatch(/^head\nx+\n… 1005 characters more$/);
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
      line({
        timestamp: 't2',
        payload: { type: 'function_call', name: 'shell', arguments: '{"command":"ls src"}', call_id: 'k1' }
      }),
      line({ timestamp: 't3', payload: { type: 'function_call_output', output: 'functions\nspace', call_id: 'k1' } })
    ];
    expect(codexMoments(codex, ROOT).map(each => [each.kind, each.text, each.call])).toEqual([
      ['said', 'On it.', undefined],
      ['tool', 'shell ls src', 'k1'],
      ['result', 'functions', 'k1']
    ]);

    const parts = [
      { at: 't1', data: { type: 'text', text: 'Reading the charts.' } },
      {
        at: 't2',
        data: {
          type: 'tool',
          id: 'p2',
          tool: 'bash',
          state: { input: { command: 'npm test' }, output: 'fail 1', status: 'error' }
        }
      }
    ];
    expect(openCodeMoments(parts, ROOT).map(each => [each.kind, each.text, each.failed ?? false, each.call])).toEqual([
      ['said', 'Reading the charts.', false, undefined],
      ['tool', 'bash npm test', false, 'p2'],
      ['result', 'fail 1', true, 'p2']
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

  // Carlos: a scout's stream came, then read "nothing said or done yet" — its last line a screenshot of a megabyte.
  it('reads further back when the session’s end is one line longer than a read — a screenshot answered', async () => {
    const folder = path.join(home, 'claude', 'projects', '-work-project');
    await fs.mkdir(folder, { recursive: true });
    const shot = line({
      type: 'user',
      timestamp: '2026-10-28T00:45:46.000Z',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'u3',
            content: [{ type: 'image', source: { type: 'base64', data: 'A'.repeat(1024 * 1024) } }]
          }
        ]
      }
    });
    await fs.writeFile(path.join(folder, `${SESSION}.jsonl`), `${[...claudeLines, shot].join('\n')}\n`);

    const read = await recentMoments(
      { harness: 'claude', session: SESSION, startedAt: '2026-10-28T00:45:00Z' },
      ROOT,
      3
    );
    // The picture is said in its place, never read into the stream.
    expect('problem' in read ? read.problem : read.map(each => [each.kind, each.call, each.text])).toEqual([
      ['result', 'u1', 'Where the task is: reading'],
      ['result', 'u2', 'ENOENT: no such file'],
      ['result', 'u3', '[image · 768 KB, not shown]']
    ]);
  });
});
