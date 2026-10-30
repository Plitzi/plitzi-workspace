import { describe, expect, it } from 'vitest';

import { unwrittenOf } from './show';

// A run's card named a plugin's folder; the work wrote its seven files and `task show` said it wrote none of it.
describe('the files a card names that its work did not write', () => {
  it('counts a folder written when a file in it is, and names a file or a folder with nothing written', () => {
    const changed = [
      'src/plugins/SheetHandle/SheetHandle.tsx',
      'src/plugins/SheetHandle/level.ts',
      'src/space/sheet.ts'
    ];

    expect(unwrittenOf(['src/plugins/SheetHandle', 'src/plugins/SheetHandle/', 'src/space/sheet.ts'], changed)).toEqual(
      []
    );
    expect(unwrittenOf(['src/plugins/Sheet', 'src/space/tabs.ts'], changed)).toEqual([
      'src/plugins/Sheet',
      'src/space/tabs.ts'
    ]);
  });
});
