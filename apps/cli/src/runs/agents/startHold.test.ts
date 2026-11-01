import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeLaunch } from './launch';
import { holdNotices, limitLineIn, quickEndsOf, resetOf, startHolds } from './startHold';
import { agentScratch, runPaths } from '../core/paths';

import type { Launch } from './launch';
import type { RunPaths } from '../core/paths';

// Claude Code past its 5-hour limit ended every agent as it started, and a run's keeper started its eight 4379 times in
// 40 minutes (Carlos: "cuando el harness llega al límite, el monitor se vuelve loco").
const LIMIT = "You've hit your 5-hour limit · resets 8:40pm (Europe/Lisbon)";

describe('a harness past its limit', () => {
  it('is read off its own line — after a failed compaction too — never off an agent writing of a limit', () => {
    expect(limitLineIn(`working…\n${LIMIT}\n${LIMIT}\n`)).toBe(LIMIT);
    expect(limitLineIn(`Prompt is too long · automatic compaction failed: ${LIMIT}`)).toContain('resets 8:40pm');
    expect(limitLineIn('- the 640px height limit means desktop visitors scroll inside the box')).toBeUndefined();
    // Followed by work, it was an earlier session's — or passed: the session ended on what it did.
    expect(limitLineIn(`${LIMIT}\n- **Friction with the CLI:** none.\n`)).toBeUndefined();
  });

  it('resets when its line says, in the zone it names: the first such time after it was written', () => {
    const at = (iso: string) => new Date(iso).getTime();
    const iso = (ms: number | undefined) => (ms === undefined ? undefined : new Date(ms).toISOString());

    // Lisbon is on UTC in November, an hour ahead of it in July.
    expect(iso(resetOf(LIMIT, at('2026-11-01T20:39:00Z')))).toBe('2026-11-01T20:40:00.000Z');
    // Written just past the time it names, it rounded its reset down: tried again in five minutes, never tomorrow.
    expect(iso(resetOf(LIMIT, at('2026-11-01T20:42:00Z')))).toBe('2026-11-01T20:47:00.000Z');
    expect(iso(resetOf(LIMIT, at('2026-11-01T22:00:00Z')))).toBe('2026-11-02T20:40:00.000Z');
    expect(iso(resetOf("You've hit your 5-hour limit · resets 8pm (Europe/Lisbon)", at('2026-07-01T12:00:00Z')))).toBe(
      '2026-07-01T19:00:00.000Z'
    );
    expect(
      iso(resetOf("You've hit your weekly limit · resets Nov 3, 8pm (Europe/Lisbon)", at('2026-11-01T20:00:00Z')))
    ).toBe('2026-11-03T20:00:00.000Z');
    expect(iso(resetOf('Claude AI usage limit reached|1793563200', 0))).toBe('2026-11-01T20:00:00.000Z');
    // Nothing it can read — a zone this machine does not know: the harness is tried again later, never at once.
    expect(resetOf("You've hit your 5-hour limit · resets 8pm (Mars/Olympus)", 0)).toBeUndefined();
    expect(resetOf("You've hit your usage limit", 0)).toBeUndefined();
  });
});

describe('the holds on starting agents again', () => {
  let root: string;
  let paths: RunPaths;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-hold-'));
    paths = runPaths(root, 'r1');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  /** An agent launched at `startedAt`, its session writing `text` and ending at `endedAt`. */
  const launched = async (agent: string, text: string, startedAt: string, endedAt: string, quickEnds?: number) => {
    const scratch = agentScratch(paths, agent);
    await fs.mkdir(scratch, { recursive: true });
    const log = path.join(scratch, 'agent.log');
    await fs.writeFile(log, `an earlier session's words\n${text}`);
    await fs.utimes(log, new Date(endedAt), new Date(endedAt));
    const launch: Launch = {
      pid: 1,
      harness: 'claude',
      startedAt,
      log,
      logFrom: "an earlier session's words\n".length,
      ...(quickEnds === undefined ? {} : { quickEnds })
    };
    await writeLaunch(paths, agent, launch);

    return launch;
  };

  const notRunning = (agents: string[]) => ({ notRunning: agents, harness: 'claude' });
  const allow = (agents: string[], at: string) => ({ action: 'starts-allowed', agents, at, by: 'lead' });

  it('holds every agent in a harness past its limit until it resets, said once to the person with who waits', async () => {
    await launched('test-1', `${LIMIT}\n`, '2026-11-01T20:39:00.000Z', '2026-11-01T20:39:05.000Z');
    const holds = await startHolds(
      paths,
      notRunning(['test-1', 'dev-2', 'design-1']),
      [],
      Date.parse('2026-11-01T20:39:30Z')
    );

    expect([...holds.keys()]).toEqual(['test-1', 'dev-2', 'design-1']);
    expect(holds.get('dev-2')).toMatchObject({ why: 'limit', until: '2026-11-01T20:40:00.000Z' });
    const notices = holdNotices(holds);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ who: 'person' });
    expect(notices[0].text).toContain('until 20:40 UTC');
    expect(notices[0].text).toContain('test-1, dev-2, design-1 wait');

    // Allowed sooner — a plan raised — the one allowed starts; the others still wait for the reset.
    const sooner = await startHolds(
      paths,
      notRunning(['test-1', 'dev-2']),
      [allow(['dev-2'], '2026-11-01T20:39:20.000Z')],
      Date.parse('2026-11-01T20:39:30Z')
    );
    expect([...sooner.keys()]).toEqual(['test-1']);

    // Once it resets, nothing is held: the run starts them as it asks.
    expect((await startHolds(paths, notRunning(['test-1']), [], Date.parse('2026-11-01T20:41:00Z'))).size).toBe(0);
  });

  it('holds an agent that ended as it started three times in a row until the lead allows it — one more try', async () => {
    const start = '2026-11-01T20:00:00.000Z';
    const launch = await launched(
      'dev-1',
      'Invalid API key · Please run /login\n',
      start,
      '2026-11-01T20:00:04.000Z',
      2
    );
    // No time lifts it: an hour on, it is still the lead's to look at.
    const held = await startHolds(paths, notRunning(['dev-1']), [], Date.parse('2026-11-01T21:00:00Z'));

    expect(held.get('dev-1')).toMatchObject({ why: 'quick-ends', ends: 3 });
    const [notice] = holdNotices(held);
    expect(notice.who).toBe('lead');
    expect(notice.text).toContain('"Invalid API key · Please run /login"');
    expect(notice.text).toContain('plitzi run allow dev-1');
    // Its next launch keeps the count: one more end as it starts, and it is held again.
    expect(await quickEndsOf('dev-1', launch, [])).toBe(3);

    // Allowed after it ended: started again.
    const allowed = [allow(['dev-1'], '2026-11-01T20:10:00.000Z')];
    expect((await startHolds(paths, notRunning(['dev-1']), allowed, Date.parse('2026-11-01T21:00:00Z'))).size).toBe(0);

    // A word of it to the run since it started: it worked, whatever ended it — no hold, and the count starts again.
    const worked = [{ by: 'dev-1', action: 'joined', at: '2026-11-01T20:00:02.000Z' }];
    expect((await startHolds(paths, notRunning(['dev-1']), worked, Date.parse('2026-11-01T20:00:30Z'))).size).toBe(0);
    expect(await quickEndsOf('dev-1', launch, worked)).toBe(0);

    // Twice is not yet a loop.
    await launched('dev-2', 'gone\n', start, '2026-11-01T20:00:04.000Z', 1);
    expect((await startHolds(paths, notRunning(['dev-2']), [], Date.parse('2026-11-01T20:00:30Z'))).size).toBe(0);
  });

  it('holds an agent someone stopped until allowed, launched or never', async () => {
    const stop = { action: 'agent-held', agent: 'test-2', at: '2026-11-01T20:00:00.000Z', by: 'person' };
    const held = await startHolds(paths, notRunning(['test-2']), [stop], Date.parse('2026-11-01T20:30:00Z'));

    expect(held.get('test-2')).toMatchObject({ why: 'stopped', by: 'person', since: stop.at });
    expect(holdNotices(held)[0].text).toContain('stopped by person (run hold)');
    expect(
      (await startHolds(paths, notRunning(['test-2']), [stop, allow(['test-2'], '2026-11-01T20:05:00.000Z')], 0)).size
    ).toBe(0);
  });
});
