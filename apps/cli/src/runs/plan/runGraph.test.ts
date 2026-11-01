import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runGraph } from './runGraph';

// A stage's dry run, its stacking and an amend read the same approved work: its graph is parsed once, not each time.
describe("the run's approved work, as a graph", () => {
  let dir: string;
  let work: string;
  let cache: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-graph-'));
    work = path.join(dir, 'work');
    cache = path.join(dir, 'cache');
    await fs.mkdir(path.join(work, 'src/space/pages'), { recursive: true });
    await fs.writeFile(path.join(work, 'package.json'), '{ "name": "graph", "type": "module" }\n');
    await fs.writeFile(
      path.join(work, 'src/space/index.ts'),
      "import { home } from './pages/home.ts';\nexport { home };\n"
    );
    await fs.writeFile(path.join(work, 'src/space/pages/home.ts'), "export const home = 'Inicio';\n");
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('is kept by what the code is: read from the cache while it is the same, again once it changed', async () => {
    const first = await runGraph(cache, work);
    expect(first.importedBy.get('src/space/pages/home.ts')).toEqual(['src/space/index.ts']);

    // The kept graph is what a second read answers: one edited by hand under the same digest proves it is read.
    const kept = JSON.parse(await fs.readFile(path.join(cache, 'run-graph.json'), 'utf-8')) as Record<string, unknown>;
    await fs.writeFile(
      path.join(cache, 'run-graph.json'),
      JSON.stringify({ ...kept, importedBy: { 'src/space/pages/home.ts': ['kept'] } })
    );
    expect((await runGraph(cache, work)).importedBy.get('src/space/pages/home.ts')).toEqual(['kept']);

    // The code changed — a page more, reached from the entry: read again.
    await fs.writeFile(
      path.join(work, 'src/space/pages/about.ts'),
      "import { home } from './home.ts';\nexport const about = home;\n"
    );
    await fs.writeFile(
      path.join(work, 'src/space/index.ts'),
      "import { home } from './pages/home.ts';\nimport { about } from './pages/about.ts';\nexport { about, home };\n"
    );
    expect((await runGraph(cache, work)).importedBy.get('src/space/pages/home.ts')?.sort()).toEqual([
      'src/space/index.ts',
      'src/space/pages/about.ts'
    ]);
  });
});
