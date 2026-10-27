import { describe, expect, it } from 'vitest';

import { commandDoing } from './agentDoing';
import { feedOf, SHORT } from './feedLine';
import { ranAs } from '../../tests/ranAs';

// A person following a run read "refused (invalid): plitzi task complete --known-failure … --token …" and an agent's row
// saying "writes t-home" alone: what an agent is at, and what went wrong, are said in words.
describe('the activity, in words', () => {
  it('says a refusal by its command’s name and its first sentence, never the command line', () => {
    const said = feedOf({
      at: '2026-10-23T10:47:17.350Z',
      by: 'dev-2',
      action: 'refused',
      code: 'invalid',
      command: 'plitzi task complete --known-failure acceptance: the line --fixed-by lead --token …',
      ...ranAs('plitzi task complete --known-failure acceptance: the line --fixed-by lead --token …'),
      message: 'Run "lx" has no task "lead". Name the task that fixes it.'
    });

    expect(said).toMatchObject({
      text: 'task complete refused — invalid',
      detail: 'task complete was refused (invalid): Run "lx" has no task "lead".'
    });
    expect(said?.detail).not.toContain('--token');
  });

  it('says a check that fails for nothing of the copy’s as not its own, not as a problem', () => {
    const said = feedOf({
      at: '2026-10-23T10:32:00.000Z',
      by: 'dev-1',
      action: 'check',
      task: 't-home',
      ok: false,
      failed: ['author'],
      notOwn: ['author']
    });

    expect(said).toMatchObject({
      kind: 'other',
      text: 'checked: what fails is not its own',
      detail: 'checked: what fails is not its own — author'
    });
  });

  // A tenth of the activity's lines ran past 200 characters, the longest 499 — a failed check naming every
  // file of other tasks — and a person following the run read none of them.
  it('says each line for a glance, the whole kept for whoever opens it', () => {
    const failing = feedOf({
      at: '2026-10-24T16:27:55.751Z',
      by: 'dev-1',
      action: 'check',
      task: 't-room-lists',
      ok: false,
      failed: [
        'acceptance — The room is whole at both widths, in both schemes',
        'acceptance — Signed in, the room is whole at both widths',
        "src/space/room/styles.ts is t-room-stage's",
        'lint'
      ]
    });
    expect(failing).toMatchObject({
      kind: 'problem',
      text: 'checks fail: lint, 2 acceptance lines + 1 file of other tasks'
    });
    expect(failing?.detail).toContain("src/space/room/styles.ts is t-room-stage's");

    const stopped = feedOf({
      at: '2026-10-24T16:30:00.000Z',
      by: 'dev-2',
      action: 'stops',
      why: "t-menu is complete, and your context is 140k tokens, past the team's 100k (freshContextAt): every turn reads it all again — you are started again with a fresh one for what comes next. You can stop"
    });
    expect(stopped?.text).toBe('stops for a fresh context — started again for what comes');
    expect(stopped?.detail).toContain('140k tokens');

    const notice = feedOf({
      at: '2026-10-24T16:31:00.000Z',
      by: 'lead',
      action: 'notice',
      about: 'plitzi',
      text: 'run amend with a stage’s plan removed the tasks of tests the run itself had made after that stage’s developer tasks'
    });
    expect(notice?.text.length).toBeLessThanOrEqual(SHORT);
    expect(notice?.detail).toContain('developer tasks');
    // What fits is said whole, with nothing to open.
    expect(feedOf({ at: '2026-10-24T16:32:00.000Z', by: 'dev-1', action: 'take', task: 't-home' })).not.toHaveProperty(
      'detail'
    );
  });

  it('says what a kept count of tokens is', () => {
    expect(
      feedOf({ at: '2026-10-23T12:49:18.473Z', by: 'lead', action: 'tokens', agents: ['dev-1', 'design-1'] })?.text
    ).toBe('kept what the harness counted each agent spent: dev-1, design-1');
  });

  it('says what an agent’s last command was about', () => {
    expect(
      commandDoing(
        ranAs('plitzi page measure /cart "cart-box => .cart" --compare https://www.example.com --width 390 --token …')
      )
    ).toBe('measuring /cart against the original');
    expect(commandDoing(ranAs('/x/node_modules/.bin/plitzi task check --fix --token …'))).toBe('running its checks');
    expect(commandDoing(ranAs('plitzi task look t-home --token …'))).toBe('looking at t-home');
    expect(commandDoing(ranAs('plitzi data describe src/data/site.json'))).toBe('running data describe');
    expect(commandDoing(ranAs('plitzi task claim src/space/theme.ts --wait --follow'))).toBe(
      'waiting for a shared file'
    );
    expect(commandDoing(ranAs('plitzi task claim src/space/theme.ts --release'))).toBe('letting a shared file go');
  });
});
