import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { serverTasks, serverTaskText } from './serverTasks';

const CATALOG = [
  {
    name: 'list.put',
    title: 'Add To List',
    description: 'Adds an entry to a list',
    params: {
      list: { type: 'text', label: 'List', defaultValue: '' },
      order: { type: 'select', label: 'Order', defaultValue: 'desc', options: [{ label: 'Highest', value: 'desc' }] }
    }
  }
];

/** A project with an installed `@plitzi/sdk-server` whose catalogue is `catalog`, or none at all. */
const projectWith = async (catalog?: unknown): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-tasks-'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'p', type: 'module' }));
  if (catalog !== undefined) {
    const pkg = path.join(root, 'node_modules', '@plitzi', 'sdk-server');
    await fs.mkdir(pkg, { recursive: true });
    await fs.writeFile(
      path.join(pkg, 'package.json'),
      JSON.stringify({ name: '@plitzi/sdk-server', type: 'module', exports: { './actions': './actions.js' } })
    );
    await fs.writeFile(
      path.join(pkg, 'actions.js'),
      `export const createTaskRegistry = () => ({});\nexport const describeCatalog = () => (${JSON.stringify(catalog)});\n`
    );
  }

  return root;
};

describe('a server action’s steps, as the project’s sdk-server declares them', () => {
  it('reads them with their params', async () => {
    const root = await projectWith(CATALOG);
    const read = await serverTasks(root);

    expect(read).toMatchObject({
      tasks: [
        {
          name: 'list.put',
          description: 'Adds an entry to a list',
          params: [
            { name: 'list', type: 'text' },
            { name: 'order', options: [{ value: 'desc' }] }
          ]
        }
      ]
    });
    expect('tasks' in read && serverTaskText(read.tasks[0])).toMatch(/order \(select\) — Order; default .desc./);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('says why there are none in a project with no server', async () => {
    const root = await projectWith();

    expect(await serverTasks(root)).toMatchObject({
      problem: expect.stringContaining('no @plitzi/sdk-server') as unknown
    });
    await fs.rm(root, { recursive: true, force: true });
  });
});
