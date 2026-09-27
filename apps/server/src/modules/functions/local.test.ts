import { describe, expect, it } from 'vitest';

import { createLocalFunctions } from './local';
import { TRY_STEP } from './tryEntry';

const SOURCE = {
  'index.ts': `export default {
  tasks: [{ namespace: 'count', action: 'up', title: 'Up', params: {}, run: async (_params, ctx) => {
    ctx.log('counting');
    return ctx.kv.increment('n', 1);
  } }]
};`
};

describe('functions on this machine', () => {
  it('run as the platform runs them, with a store that lasts as long as the process', async () => {
    const local = createLocalFunctions();

    expect(await local.load(SOURCE)).toEqual({ ok: true, tasks: ['count.up'] });

    await local.tryTask('count.up', {});
    const second = await local.tryTask('count.up', {});

    expect(second.output.value).toBe(2);
    expect(second.steps.find(step => step.id === TRY_STEP)?.logs).toEqual(['counting']);
  });

  it('refuse what the platform refuses, where it is', async () => {
    const loaded = await createLocalFunctions().load({
      'index.ts': 'import fs from "node:fs";\nexport default { fs };'
    });

    expect(loaded).toMatchObject({ ok: false, problems: [{ file: 'index.ts', line: 1 }] });
  });
});
