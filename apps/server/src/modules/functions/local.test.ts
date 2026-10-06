import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

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

describe('ctx.data, in the sandbox', () => {
  const READER = {
    'index.ts': `export default {
  tasks: [{ namespace: 'shop', action: 'cheapest', title: 'Cheapest', params: {}, run: async (_params, ctx) => {
    const products = await ctx.data('shop/products.json');
    return products.reduce((low, product) => (product.cost < low.cost ? product : low)).id;
  } }, { namespace: 'shop', action: 'missing', title: 'Missing', params: {}, run: (_params, ctx) => ctx.data('nope.json') }]
};`
  };

  it('reads one file of the project’s data, parsed — a call back to the platform like kv', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'plitzi-fn-data-'));
    try {
      mkdirSync(path.join(dataDir, 'shop'));
      writeFileSync(
        path.join(dataDir, 'shop/products.json'),
        JSON.stringify([
          { id: 'a', cost: 4 },
          { id: 'b', cost: 2 }
        ])
      );
      const local = createLocalFunctions({ dataDir });
      await local.load(READER);

      expect((await local.tryTask('shop.cheapest', {})).output.value).toBe('b');
      const missing = await local.tryTask('shop.missing', {});
      expect(missing.status).toBe('failed');
      expect(JSON.stringify(missing.steps)).toContain('\\"nope.json\\" is not a file of this space\'s data');
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
