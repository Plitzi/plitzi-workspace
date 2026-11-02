import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { findingOf, project, read, run, doctorProjectEachTest, write } from './tests/doctorProject';
import { digestOf, readScaffoldRecord, writeScaffoldRecord } from '../commands/project/scaffoldRecord';

// The doctor says which browser opens pages by starting one; these tests examine projects, not the machine's browsers.
vi.mock('../commands/browser/browser', () => ({
  browserInUse: () => Promise.resolve({ said: 'Chromium, downloaded by plitzi browser install' })
}));

/** What `plitzi doctor` says of the CLI's machinery in a project: as `plitzi upgrade files` sees each file. */

doctorProjectEachTest();

// Each run is the whole doctor on a project on disk: far over the default 5 s with every package's tests at once.
describe('the CLI’s machinery, as plitzi doctor reads it', { timeout: 30_000 }, () => {
  /** `src/env.ts` read `.env` before Node did: an older CLI's, and nothing reads it beside today's `main.ts`. */
  it('says machinery the CLI no longer writes, left over — and whether upgrade removes it or it is the project’s', async () => {
    const older = "try {\n  process.loadEnvFile(new URL('../.env', import.meta.url));\n} catch {\n  // None.\n}\n";
    await write('src/env.ts', older);
    const record = await readScaffoldRecord(project);
    await writeScaffoldRecord(project, record?.cli ?? '0.38.4', {
      files: { ...record?.files, 'src/env.ts': digestOf(older) }
    });

    expect(findingOf(await run(), 'machinery-retired')).toMatchObject({
      severity: 'warning',
      file: 'src/env.ts',
      fix: 'plitzi upgrade files --write'
    });

    await write('src/env.ts', `${older}// mine\n`);
    const report = await run();
    expect(findingOf(report, 'machinery-retired')).toBeUndefined();
    expect(findingOf(report, 'machinery-retired-yours')).toMatchObject({ severity: 'info', file: 'src/env.ts' });
  });

  it('says the CLI’s files that are gone or behind, and the records it cannot read', async () => {
    await fs.rm(path.join(project, '.plitzi/author.ts'));
    await write('.plitzi/scaffold.json', '{ "format": 2 }');

    const report = await run();

    expect(findingOf(report, 'machinery-missing')).toMatchObject({ severity: 'error', file: '.plitzi/author.ts' });
    expect(findingOf(report, 'record-unreadable')).toMatchObject({ file: '.plitzi/scaffold.json' });
  });

  // A .prettierignore of the project's own without the folder the CLI's reports go to was "Healthy", and its check failed.
  it('says a list of the project’s own that lacks the CLI’s lines, and not one holding them beside its own', async () => {
    const ours = await read('.prettierignore');
    await write('.prettierignore', 'node_modules\nsrc/legacy-of-ours\n');

    expect(findingOf(await run(), 'machinery-lines-missing')).toMatchObject({
      severity: 'warning',
      file: '.prettierignore'
    });

    await write('.prettierignore', `${ours}src/legacy-of-ours\n`);
    expect(findingOf(await run(), 'machinery-lines-missing')).toBeUndefined();
  });

  // What AGENTS.md says ("nothing unused") and what upgrade writes agree: a `.gitkeep` keeps an EMPTY folder in git.
  it('asks for a folder’s .gitkeep only while the folder is empty', async () => {
    await fs.rm(path.join(project, 'src/functions/.gitkeep'), { force: true });
    await write('src/functions/index.ts', 'export {};\n');

    expect(
      (await run()).findings.filter(
        finding => finding.code === 'machinery-missing' && finding.file?.endsWith('.gitkeep')
      )
    ).toEqual([]);

    await fs.rm(path.join(project, 'src/functions/index.ts'));
    expect(findingOf(await run(), 'machinery-missing')).toMatchObject({ file: 'src/functions/.gitkeep' });
  });
});
