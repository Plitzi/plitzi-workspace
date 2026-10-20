import { describe, expect, it } from 'vitest';

import { mergeLines } from './merge3';

const base = [
  'import { a } from "./a";',
  'import { z } from "./z";',
  '',
  'export const pages = [',
  '  a,',
  '  z',
  '];'
].join('\n');

describe('two changes to one file, put together line by line', () => {
  it('takes both additions at one place, the run’s first', () => {
    const ours = base.replace('import { z }', 'import { o } from "./o";\nimport { z }').replace('  a,', '  a,\n  o,');
    const theirs = base.replace('import { z }', 'import { t } from "./t";\nimport { z }').replace('  a,', '  a,\n  t,');
    const merged = mergeLines(base, ours, theirs);

    expect(merged).toEqual({
      ok: true,
      text: [
        'import { a } from "./a";',
        'import { t } from "./t";',
        'import { o } from "./o";',
        'import { z } from "./z";',
        '',
        'export const pages = [',
        '  a,',
        '  t,',
        '  o,',
        '  z',
        '];'
      ].join('\n')
    });
  });

  it('takes changes to different lines, and the same change once', () => {
    const ours = base.replace('  z', '  zed');
    const theirs = base.replace('import { a } from "./a";', 'import { a } from "./alpha";');

    expect(mergeLines(base, ours, theirs)).toEqual({
      ok: true,
      text: base.replace('  z', '  zed').replace('"./a"', '"./alpha"')
    });
    expect(mergeLines(base, ours, ours)).toEqual({ ok: true, text: ours });
  });

  it('takes the same change to a line and what each adds after it — a trailing comma, then its own entry', () => {
    const ours = base.replace('  a,\n  z', '  a,\n  z,\n  o');
    const theirs = base.replace('  a,\n  z', '  a,\n  z,\n  t');

    expect(mergeLines(base, ours, theirs)).toEqual({
      ok: true,
      text: base.replace('  a,\n  z', '  a,\n  z,\n  t,\n  o')
    });
  });

  it('refuses two different changes to the same lines', () => {
    expect(mergeLines(base, base.replace('  z', '  y'), base.replace('  z', '  x'))).toMatchObject({
      ok: false,
      conflicts: 1
    });
  });
});
