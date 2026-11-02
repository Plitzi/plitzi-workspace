import { describe, expect, it } from 'vitest';

import { runsOnly } from './testsOfDeleted';

// A run's t-shell deleted the starter's StatCard plugin; t-shell-tests kept its tests and a line running them.
describe('a tests card’s line, once its task deleted what it tested', () => {
  const gone = ['src/plugins/StatCard/index.test.ts', 'src/plugins/StatCard/declaration.test.ts'];

  it('runs only what is gone — by its path, or by a glob over a folder only gone files were in', () => {
    expect(runsOnly('node --test src/plugins/StatCard/**/*.test.ts', gone, [])).toBe(true);
    expect(runsOnly('node --test src/plugins/StatCard/index.test.ts', gone, [])).toBe(true);
  });

  it('still runs what is kept: a glob that reaches a test left, another file named', () => {
    expect(runsOnly('node --test src/plugins/**/*.test.ts', gone, ['src/plugins/Chart/index.test.ts'])).toBe(false);
    expect(runsOnly('node --test src/plugins/Chart/index.test.ts', gone, ['src/plugins/Chart/index.test.ts'])).toBe(
      false
    );
  });
});
