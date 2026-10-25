import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkedElements, elementFileNotices } from './elementFiles';
import { makeBench } from '../tests/runProject';

import type { PlannedTask } from './model';
import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const task = (files: string[], check: string): PlannedTask => ({
  id: 't-result-card',
  title: 'The result card',
  files,
  dependsOn: [],
  priority: 'medium',
  estimateMinutes: 25,
  acceptance: [{ said: 'The judges as the original', check }]
});

// T-result-card was given match/styles.ts; its check measured the judges, written in pages/combate.ts.
describe('the elements a task’s checks read', () => {
  it('are read off page check and page measure, ours before its "=>"', () => {
    expect(
      checkedElements(
        'plitzi page measure /combate/x "match-judges => .judge-votes" match-result-winner --compare https://o.example --same gap'
      )
    ).toEqual(['match-judges', 'match-result-winner']);
    expect(checkedElements('plitzi page check / --expect "home-title~Hola" --element home-hero')).toEqual([
      'home-title',
      'home-hero'
    ]);
  });

  it('say the file they are written in when it is none of the task’s', async () => {
    await bench.write('src/space/pages/combate.ts', "export const page = { id: 'match-judges' };\n");
    await bench.write('src/space/match/styles.ts', 'export const styles = {};\n');
    const check =
      'plitzi page measure /combate/x "match-judges => .judge-votes" --compare https://o.example --same gap';

    expect(await elementFileNotices(bench.root, [task(['src/space/match/styles.ts'], check)])).toEqual([
      'Task "t-result-card"\'s checks read match-judges (src/space/pages/combate.ts) — written in none of its files: give it those files, or its change to them waits for whoever holds them'
    ]);
    expect(
      await elementFileNotices(bench.root, [task(['src/space/match/styles.ts', 'src/space/pages/combate.ts'], check)])
    ).toEqual([]);
  });

  // T-body-type measured the FAQ's answers, written in faq.ts, and changed them through fore() — its own.
  it('say nothing of an element whose file imports one of the task’s: that import is the task’s way to it', async () => {
    await bench.write(
      'src/space/pages/home/faq.ts',
      "import { fore } from './mediaCommon';\nexport const faq = { id: 'home-faq-answer-text', color: fore(75) };\n"
    );
    await bench.write('src/space/pages/home/mediaCommon.ts', 'export const fore = (n: number) => String(n);\n');
    const check = 'plitzi page measure / "home-faq-answer-text => .faq-answer-body" --compare https://o.example';

    expect(await elementFileNotices(bench.root, [task(['src/space/pages/home/mediaCommon.ts'], check)])).toEqual([]);
    expect(await elementFileNotices(bench.root, [task(['src/space/theme.ts'], check)])).toHaveLength(1);
  });
});
