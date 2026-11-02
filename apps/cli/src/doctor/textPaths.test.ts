import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { findingOf, project, read, run, doctorProjectEachTest, write } from './tests/doctorProject';

// The doctor says which browser opens pages by starting one; these tests examine projects, not the machine's browsers.
vi.mock('../commands/browser/browser', () => ({
  browserInUse: () => Promise.resolve({ said: 'Chromium, downloaded by plitzi browser install' })
}));

doctorProjectEachTest();

/** A script that writes into a folder by a path it builds, as a project's generator does. */
const GENERATOR = [
  "import { writeFileSync } from 'node:fs';",
  "import path from 'node:path';",
  "const ROOT = path.resolve(import.meta.dirname, '..');",
  "writeFileSync(path.join(ROOT, 'functions/generated.ts'), 'export {};');",
  ''
].join('\n');

// Each run is the whole doctor on a project on disk: far over the default 5 s with every package's tests at once.
describe('the paths a project’s code writes as text, when the doctor moves a folder', { timeout: 30_000 }, () => {
  // A server built 'data/store.json' from its root; after the move it read an empty file there, and its keeper's data
  // looked gone. The move had said every script naming the folder followed.
  it('says the ones a move does not follow, and keeps saying them until they name where the folder is', async () => {
    await fs.rm(path.join(project, 'src/functions'), { recursive: true, force: true });
    await write('functions/index.ts', 'export default {};\n');
    await write('scripts/gen.ts', GENERATOR);

    const planned = await run({ fix: true, dryRun: true });

    expect(planned.repaired.repairs.join('\n')).toContain(
      "1 path the code writes as text does not, and is said until it names where each is now: scripts/gen.ts:4 ('functions/generated.ts')"
    );

    const moved = await run({ fix: true });

    expect(await read('src/functions/index.ts')).toBe('export default {};\n');
    expect(findingOf(moved, 'path-to-moved-folder')).toMatchObject({
      severity: 'warning',
      file: 'scripts/gen.ts',
      fix: "Name src/functions/ there: 'src/functions/generated.ts'."
    });

    await write('scripts/gen.ts', GENERATOR.replace("'functions/generated.ts'", "'src/functions/generated.ts'"));

    expect(findingOf(await run(), 'path-to-moved-folder')).toBeUndefined();
  });

  // What the server writes as it runs is the state it keeps: moved into src/data/ it was committed and watched.
  it('moves no folder the code writes to into src/data/, and says it is state', async () => {
    await write('data/store.json', '{}\n');
    await write(
      'src/config/store.ts',
      "import { writeFileSync } from 'node:fs';\nexport const save = (text: string) => writeFileSync('data/store.json', text);\n"
    );

    const report = await run({ fix: true });
    const folder = report.findings.find(finding => finding.file === 'data/');

    expect(folder?.message).toContain("data/ is written by the project's code as it runs (src/config/store.ts:2");
    expect(folder?.message).toContain("process.env.PLITZI_STATE_DIR ?? 'state'");
    expect(folder?.repair).toBeUndefined();
    expect(await read('data/store.json')).toBe('{}\n');
  });
});
