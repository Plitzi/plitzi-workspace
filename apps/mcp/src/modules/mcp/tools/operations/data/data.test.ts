import { describe, expect, it, vi } from 'vitest';

import { readResource } from '../../../resources/router';
import { buildSpace } from '../../../tests/helpers';
import { apply } from '../../apply';

import type { Space } from '../../../helpers';
import type { Persisters } from '../../../types';
import type { DataSaveResult, FunctionsSaveResult } from '@plitzi/sdk-shared';

/**
 * The space's own data, for an agent: read as a provider would, written a file at a time, and saved whole with the
 * batch — refused where a file is wrong, before the documents are written.
 */

const withData = (files: Record<string, string> = { 'products.json': '[{"id":1}]' }): Space => ({
  ...buildSpace(),
  data: { files, version: 'd1' }
});

const saving = (answer: DataSaveResult) => {
  const saveData = vi.fn<NonNullable<Persisters['saveData']>>(() => Promise.resolve(answer));
  const schema = vi.fn(() => Promise.resolve());
  const persisters: Persisters = { saveData, schema };

  return { persisters, saveData, schema };
};

describe('data file ops', () => {
  it('save the files whole, against the version the batch read', async () => {
    const { persisters, saveData } = saving({ ok: true, version: 'd2' });
    const result = await apply(
      {
        operations: [
          { type: 'upsertDataFile', path: 'shop/hours.json', content: '{"open":9}' },
          { type: 'deleteDataFile', path: 'products.json' }
        ]
      },
      withData(),
      persisters
    );

    expect(result).toMatchObject({ applied: true, persisted: true, summary: { created: 1, deleted: 1 } });
    expect(saveData).toHaveBeenCalledWith({ 'shop/hours.json': '{"open":9}' }, 'd1');
  });

  it('refuse a file that is not JSON where it is written, and save nothing', async () => {
    const { persisters, saveData } = saving({ ok: true, version: 'd2' });
    const result = await apply(
      { operations: [{ type: 'upsertDataFile', path: 'products.json', content: '[{"id":' }] },
      withData(),
      persisters
    );

    expect(result.applied).toBe(false);
    expect(result.errors?.[0]?.message).toContain('"products.json" is not JSON');
    expect(saveData).not.toHaveBeenCalled();
  });

  it('refuse the batch with what the platform says, by file, before the documents are written', async () => {
    const { persisters, schema } = saving({
      ok: false,
      problems: [{ file: '../x.json', message: 'is not a data file: a path of plain segments ending in .json' }]
    });
    const result = await apply(
      {
        operations: [
          { type: 'upsertDataFile', path: '../x.json', content: '{}' },
          { type: 'patchSettings', customCss: 'body { color: red; }' }
        ]
      },
      withData(),
      persisters
    );

    expect(result).toMatchObject({ applied: false, persisted: false, errors: [{ path: 'data/../x.json' }] });
    expect(schema).not.toHaveBeenCalled();
  });

  it('say the functions of the batch stayed saved when the data was refused after them', async () => {
    const saveFunctions = vi.fn<NonNullable<Persisters['saveFunctions']>>(() =>
      Promise.resolve<FunctionsSaveResult>({ ok: true, version: 'v2', manifest: { hosts: [], tasks: [], routes: [] } })
    );
    const saveData = vi.fn<NonNullable<Persisters['saveData']>>(() =>
      Promise.resolve<DataSaveResult>({ ok: false, refusal: { status: 409, limit: 'version', error: 'moved on' } })
    );
    const result = await apply(
      {
        operations: [
          { type: 'upsertFunctionFile', path: 'index.ts', content: 'export default {};' },
          { type: 'upsertDataFile', path: 'products.json', content: '[]' }
        ]
      },
      {
        ...withData(),
        functions: { files: {}, version: 'v1', manifest: null, offer: null }
      },
      { saveFunctions, saveData }
    );

    expect(result.applied).toBe(false);
    expect(result.errors?.[0]).toMatchObject({ path: 'data', message: 'moved on' });
    expect(result.warnings?.[0]).toContain('functions of this batch were saved');
  });

  it('say so on a deployment that keeps no data', async () => {
    const result = await apply(
      { operations: [{ type: 'upsertDataFile', path: 'a.json', content: '{}' }] },
      buildSpace(),
      saving({ ok: true, version: 'd2' }).persisters
    );

    expect(result.errors?.[0]?.message).toBe('This deployment keeps no space data');
  });
});

describe('plitzi://data', () => {
  it('lists the files with the query a provider reads each by, and reads one parsed', () => {
    const space = withData();

    expect(readResource(space, 'main', 'plitzi://data/main')?.data).toEqual({
      available: true,
      version: 'd1',
      files: [{ path: 'products.json', query: '/data/products.json', bytes: 10 }]
    });
    expect(readResource(space, 'main', 'plitzi://data/main/products.json')?.data).toEqual({
      path: 'products.json',
      query: '/data/products.json',
      content: [{ id: 1 }]
    });
    expect(readResource(space, 'main', 'plitzi://data/main/missing.json')).toBeNull();
  });
});
