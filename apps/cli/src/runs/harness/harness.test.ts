import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { harnessUsage, kindOf } from './index';
import { whatOf } from './types';
import { SESSION_ENV, sessionOfProcess } from '../agents/session';

/** An agent's session as each harness keeps it, reduced to what a round's cost is read from. */

const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';
const ROOT = '/work/acme';
let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-harness-'));
  vi.stubEnv('CLAUDE_CONFIG_DIR', path.join(home, 'claude'));
  vi.stubEnv('CODEX_HOME', path.join(home, 'codex'));
  vi.stubEnv('XDG_DATA_HOME', path.join(home, 'data'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

const T = (minute: number): string => new Date(Date.UTC(2026, 9, 24, 10, minute)).toISOString();
const window = { root: ROOT, from: T(1), to: T(10) };

const lines = (entries: unknown[]): string => `${entries.map(each => JSON.stringify(each)).join('\n')}\n`;

describe('what a Claude Code session spent in a round', () => {
  const answer = (minute: number, id: string, usage: Record<string, unknown>, content: unknown[] = []) => ({
    type: 'assistant',
    timestamp: T(minute),
    requestedModel: 'claude-sonnet-5-5',
    effort: 'high',
    version: '2.1.309',
    message: { id, usage, content }
  });

  it('sums each answer once, in the window, weighs each result by the turns after it, and says Plitzi’s files read', async () => {
    const usage = {
      input_tokens: 10,
      cache_read_input_tokens: 1000,
      cache_creation_input_tokens: 100,
      output_tokens: 50
    };
    const folder = path.join(home, 'claude', 'projects', '-work-acme');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(
      path.join(folder, `${SESSION}.jsonl`),
      lines([
        answer(0, 'before', usage),
        answer(1, 'm1', usage, [
          {
            type: 'tool_use',
            id: 'u1',
            name: 'Bash',
            input: { command: 'cd /x && /run/scratch/dev-1/plitzi page measure / --width 390' }
          },
          {
            type: 'tool_use',
            id: 'u2',
            name: 'Read',
            input: { file_path: '/work/acme/.claude/skills/plitzi-authoring/reference/realtime.md' }
          }
        ]),
        // The same answer kept again for its next part: counted once.
        answer(1, 'm1', usage, [{ type: 'text', text: 'measuring' }]),
        {
          type: 'user',
          timestamp: T(2),
          message: {
            content: [
              { type: 'tool_result', tool_use_id: 'u1', content: 'x'.repeat(4000) },
              { type: 'tool_result', tool_use_id: 'u2', content: 'y'.repeat(400) }
            ]
          }
        },
        answer(3, 'm2', usage),
        // Its cache kept an hour, as Claude Code writes it: twice the input's price, where five minutes is 1.25×.
        answer(4, 'm3', {
          ...usage,
          cache_read_input_tokens: 5000,
          cache_creation: { ephemeral_1h_input_tokens: 100 }
        }),
        answer(20, 'after', usage)
      ])
    );

    expect(await harnessUsage({ sessions: [SESSION], processes: [], ...window })).toEqual({
      harness: 'claude',
      model: 'claude-sonnet-5-5',
      effort: 'high',
      version: '2.1.309',
      turns: 3,
      input: 30,
      cacheRead: 7000,
      cacheWrite: 300,
      output: 150,
      processed: 7480,
      contextAtEnd: 5110,
      // Sonnet 5.5 at $2 in, $10 out, $0.20 read: 970 + 970 + 1920 millionths of a dollar.
      cost: expect.closeTo(0.00386, 10) as number,
      minutes: [
        { at: '2026-10-24T10:01', tokens: 1160 },
        { at: '2026-10-24T10:03', tokens: 1160 },
        { at: '2026-10-24T10:04', tokens: 5160 }
      ],
      heaviest: [
        { tool: 'Bash', what: 'plitzi page measure', results: 1, chars: 4000, reread: 2000 },
        { tool: 'Read', what: '.md', results: 1, chars: 400, reread: 200 }
      ],
      plitziRead: [{ file: 'skills/plitzi-authoring/reference/realtime.md', times: 1 }]
    });
  });

  it('reads nothing of a session it cannot find', async () => {
    expect(await harnessUsage({ sessions: [SESSION], processes: [], ...window })).toBeUndefined();
  });
});

describe('what a Codex session spent, found by its process', () => {
  it('finds the session its process started, in the project’s folder, and reads its usage, model and calls', async () => {
    const started = Date.parse(T(0));
    const day = new Date(started);
    const folder = path.join(
      home,
      'codex',
      'sessions',
      String(day.getFullYear()),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0')
    );
    await fs.mkdir(folder, { recursive: true });
    const usage = { input_tokens: 1200, cached_input_tokens: 1000, cache_write_input_tokens: 0, output_tokens: 80 };
    await fs.writeFile(
      path.join(folder, 'rollout-a.jsonl'),
      lines([
        { timestamp: T(0), type: 'session_meta', payload: { timestamp: T(0), cwd: ROOT, cli_version: '0.163.0' } },
        { timestamp: T(1), type: 'turn_context', payload: { model: 'gpt-5.6-terra', effort: 'high' } },
        {
          timestamp: T(2),
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'shell',
            call_id: 'c1',
            arguments: JSON.stringify({ command: ['bash', '-lc', 'plitzi explain channel'] })
          }
        },
        {
          timestamp: T(2),
          type: 'response_item',
          payload: { type: 'function_call_output', call_id: 'c1', output: 'z'.repeat(800) }
        },
        { timestamp: T(2), type: 'token_usage_record', payload: { response_id: 'r1', usage } },
        { timestamp: T(3), type: 'token_usage_record', payload: { response_id: 'r2', usage } }
      ])
    );
    // Another session started at the same time in another project: not this one's.
    await fs.writeFile(
      path.join(folder, 'rollout-b.jsonl'),
      lines([{ timestamp: T(0), type: 'session_meta', payload: { timestamp: T(0), cwd: '/work/other' } }])
    );

    expect(
      await harnessUsage({ sessions: [], processes: [`codex:42:${String(started / 1000)}`], ...window })
    ).toMatchObject({
      harness: 'codex',
      model: 'gpt-5.6-terra',
      effort: 'high',
      version: '0.163.0',
      turns: 2,
      input: 400,
      cacheRead: 2000,
      output: 160,
      heaviest: [{ tool: 'shell', what: 'plitzi explain channel', results: 1, chars: 800, reread: 200 }]
    });
    expect(
      await harnessUsage({ sessions: [], processes: [`codex:42:${String(started / 1000 + 3600)}`], ...window })
    ).toBeUndefined();
  });
});

describe('what an OpenCode session spent, found by its process', () => {
  it('reads its store: the session started with the process, in the folder, its messages’ tokens and its tools', async () => {
    const started = Date.parse(T(0));
    await fs.mkdir(path.join(home, 'data', 'opencode'), { recursive: true });
    const database = new DatabaseSync(path.join(home, 'data', 'opencode', 'opencode.db'));
    database.exec(
      'CREATE TABLE session (id TEXT, directory TEXT, version TEXT, time_created INTEGER); CREATE TABLE message (id TEXT, session_id TEXT, time_created INTEGER, data TEXT); CREATE TABLE part (id TEXT, session_id TEXT, time_created INTEGER, data TEXT);'
    );
    database.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run('s1', `${ROOT}/tmp/copy`, '1.4.0', started + 2000);
    database.prepare('INSERT INTO message VALUES (?, ?, ?, ?)').run(
      'm1',
      's1',
      Date.parse(T(2)),
      JSON.stringify({
        role: 'assistant',
        modelID: 'qwen3.6',
        tokens: { input: 300, output: 40, reasoning: 10, cache: { read: 900, write: 0 } }
      })
    );
    database.prepare('INSERT INTO part VALUES (?, ?, ?, ?)').run(
      'p1',
      's1',
      Date.parse(T(2)),
      JSON.stringify({
        type: 'tool',
        tool: 'read',
        callID: 'k1',
        state: {
          input: { filePath: '/x/node_modules/@plitzi/sdk-authoring/dist/index.d.ts' },
          output: 'w'.repeat(100)
        }
      })
    );
    database.close();

    const read = await harnessUsage({ sessions: [], processes: [`opencode:7:${String(started / 1000)}`], ...window });
    expect(read).toMatchObject({
      harness: 'opencode',
      model: 'qwen3.6',
      version: '1.4.0',
      turns: 1,
      input: 300,
      cacheRead: 900,
      output: 50,
      plitziRead: [{ file: '@plitzi/sdk-authoring/dist/index.d.ts', times: 1 }]
    });
    // A model with no price is said in tokens alone: never a price guessed.
    expect(read).not.toHaveProperty('cost');
  });
});

describe('the session a command runs in', () => {
  it('is the one the CLI started it in, else its harness’s own', () => {
    vi.stubEnv(SESSION_ENV, 'launched-1');
    vi.stubEnv('CLAUDE_CODE_SESSION_ID', 'claude-2');
    expect(sessionOfProcess()).toEqual({ session: 'launched-1' });

    vi.stubEnv(SESSION_ENV, '');
    expect(sessionOfProcess()).toEqual({ session: 'claude-2' });
  });
});

describe('what a tool was asked, named by its kind', () => {
  it('names the command a shell ran past comments, a cd and a loop, and a file read by its extension', () => {
    const named = (tool: string, input: unknown) => kindOf(tool, whatOf(tool, input));

    expect(named('Read', { file_path: '/w/src/space/home.ts' })).toBe('Read .ts');
    expect(named('Grep', { pattern: 'x' })).toBe('Grep');
    expect(named('Bash', { command: '# measure the sign\nplitzi page measure / home-sign' })).toBe(
      'Bash plitzi page measure'
    );
    expect(named('Bash', { command: 'cd /w/copy; plitzi task check' })).toBe('Bash plitzi task check');
    expect(named('Bash', { command: 'for w in 390 1440; do plitzi page shot / --width $w; done' })).toBe(
      'Bash plitzi page shot'
    );
    expect(named('Bash', { command: '"$(dirname x)"/run.sh' })).toBe('Bash a shell script');
  });
});
