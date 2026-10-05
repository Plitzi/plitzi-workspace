import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { projectData, publicData } from './node';

const root = mkdtempSync(path.join(tmpdir(), 'plitzi-public-data-'));
mkdirSync(path.join(root, 'public/data'), { recursive: true });
writeFileSync(path.join(root, 'public/data/plans.json'), JSON.stringify({ plans: [{ name: 'Starter' }] }));
writeFileSync(path.join(root, 'public/data/broken.json'), '{ plans');
writeFileSync(path.join(root, 'secret.json'), '{}');

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('publicData', () => {
  const answer = publicData(path.join(root, 'public'));

  it('answers a query that is a JSON file the project serves', () => {
    expect(answer('/data/plans.json')).toEqual({ plans: [{ name: 'Starter' }] });
    expect(answer('/data/plans.json?v=2')).toEqual({ plans: [{ name: 'Starter' }] });
  });

  it('answers nothing it cannot read as the server would serve it', () => {
    expect(answer('https://example.com/data/plans.json')).toBeUndefined();
    expect(answer('/data/{{ navigation.routeParams.id }}.json')).toBeUndefined();
    expect(answer('/../secret.json')).toBeUndefined();
    expect(answer('/data/missing.json')).toBeUndefined();
    expect(answer('/data/broken.json')).toBeUndefined();
  });
});

describe('projectData', () => {
  const answer = projectData(path.join(root, 'public/data'));

  it('answers `/data/<file>` from the folder the server reads it from', () => {
    expect(answer('/data/plans.json')).toEqual({ plans: [{ name: 'Starter' }] });
  });

  it('answers nothing outside `/data/`, nor out of its folder', () => {
    expect(answer('/plans.json')).toBeUndefined();
    expect(answer('/data/../secret.json')).toBeUndefined();
    expect(answer('/data/../../secret.json')).toBeUndefined();
  });
});
