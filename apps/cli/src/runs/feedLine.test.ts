import { describe, expect, it } from 'vitest';

import { commandDoing } from './agentDoing';
import { feedOf } from './feedLine';

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
      message: 'Run "lx" has no task "lead". Name the task that fixes it.'
    });

    expect(said?.text).toBe('task complete was refused (invalid): Run "lx" has no task "lead".');
    expect(said?.text).not.toContain('--token');
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

    expect(said).toMatchObject({ kind: 'other', text: 'checked t-home: what fails is not its own — author' });
  });

  it('says what an agent’s last command was about', () => {
    expect(
      commandDoing(
        'plitzi page measure /cart "cart-box => .cart" --compare https://www.example.com --width 390 --token …'
      )
    ).toBe('measuring /cart against the original');
    expect(commandDoing('/x/node_modules/.bin/plitzi task check --fix --token …')).toBe('running its checks');
    expect(commandDoing('plitzi task look t-home --token …')).toBe('looking at t-home');
    expect(commandDoing('plitzi data describe src/data/site.json')).toBe('running data describe');
  });
});
