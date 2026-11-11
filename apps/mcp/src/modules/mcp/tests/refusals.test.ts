import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REFUSALS } from '@plitzi/sdk-shared/refusals';

import { buildSpace, capturing } from './helpers';
import { apply } from '../tools/apply';
import { OPERATIONS_BY_TYPE } from '../tools/operations';

import type { Operation } from '../tools/operations';
import type { RefusalEntry, RefusalSurface } from '@plitzi/sdk-shared/refusals';

/**
 * Every operation, sent naming what the space does not have — or a value it does not take, where the operation makes
 * what it names. Each is refused with a code of the one list the CLI shares (`@plitzi/sdk-shared/refusals`) and a hint
 * that is a step: an agent refused with "Nothing to delete" or an empty hint has only its guess left. Keyed by the
 * operation type, so a new operation does not compile until it says how it is refused here.
 */
const REFUSED: { [Type in Operation['type']]: Extract<Operation, { type: Type }> } = {
  upsertElement: { type: 'upsertElement', pageRef: 'nope', element: { ref: 'x', type: 'text' } },
  patchElement: { type: 'patchElement', pageRef: 'home', ref: 'nope', props: { content: 'x' } },
  deleteElement: { type: 'deleteElement', pageRef: 'home', ref: 'nope' },
  moveElement: { type: 'moveElement', pageRef: 'home', ref: 'nope', toParentRef: 'home', position: 'inside' },
  repeatElement: {
    type: 'repeatElement',
    pageRef: 'nope',
    ref: 'rows',
    template: { ref: 'row', type: 'text' },
    items: [{ title: 'a' }]
  },
  upsertPage: { type: 'upsertPage', ref: 'p', slug: 'p', layout: 'nope' },
  deletePage: { type: 'deletePage', ref: 'nope' },
  upsertLayout: { type: 'upsertLayout', ref: 'not a name' },
  deleteLayout: { type: 'deleteLayout', ref: 'nope' },
  upsertFolder: { type: 'upsertFolder', ref: 'f', name: 'F', parentId: 'nope' },
  deleteFolder: { type: 'deleteFolder', ref: 'nope' },
  upsertComponent: { type: 'upsertComponent', ref: 'not a name', label: 'Card', props: {} },
  deleteComponent: { type: 'deleteComponent', ref: 'nope' },
  upsertBinding: {
    type: 'upsertBinding',
    pageRef: 'home',
    ref: 'nope',
    category: 'attributes',
    binding: { to: 'content', source: 'state.x' }
  },
  patchBinding: { type: 'patchBinding', pageRef: 'home', ref: 'c1', category: 'attributes', to: 'nope' },
  deleteBinding: { type: 'deleteBinding', pageRef: 'home', ref: 'c1', category: 'attributes', to: 'nope' },
  upsertInteractionFlow: {
    type: 'upsertInteractionFlow',
    pageRef: 'home',
    ref: 'nope',
    nodes: [{ id: 'go', title: 'Go', nodeType: 'trigger', action: 'onClick' }]
  },
  patchInteractionNode: { type: 'patchInteractionNode', pageRef: 'home', ref: 'c1', nodeId: 'nope', params: {} },
  deleteInteraction: { type: 'deleteInteraction', pageRef: 'home', ref: 'c1', nodeId: 'nope' },
  upsertFlag: { type: 'upsertFlag', name: 'not a name', value: true },
  deleteFlag: { type: 'deleteFlag', name: 'nope' },
  patchSettings: { type: 'patchSettings', withheldPage: 'nope' },
  upsertVariable: { type: 'upsertVariable', name: 'not a name', variableType: 'text', value: 'x' },
  deleteVariable: { type: 'deleteVariable', name: 'nope' },
  upsertDefinition: { type: 'upsertDefinition', ref: 'card', desktop: { 'not-a-property': '1px' } },
  upsertDefinitions: { type: 'upsertDefinitions', definitions: {} },
  patchDefinition: { type: 'patchDefinition', ref: 'nope', desktop: { padding: '1px' } },
  deleteDefinition: { type: 'deleteDefinition', ref: 'nope' },
  upsertGlobalStyle: { type: 'upsertGlobalStyle', componentType: 'button', desktop: { 'not-a-property': '1px' } },
  patchGlobalStyle: { type: 'patchGlobalStyle', componentType: 'nope', desktop: { padding: '1px' } },
  deleteGlobalStyle: { type: 'deleteGlobalStyle', componentType: 'nope' },
  upsertIdStyle: { type: 'upsertIdStyle', targetId: 'hero', desktop: { 'not-a-property': '1px' } },
  patchIdStyle: { type: 'patchIdStyle', targetId: 'nope', desktop: { padding: '1px' } },
  deleteIdStyle: { type: 'deleteIdStyle', targetId: 'nope' },
  upsertStyleVariable: { type: 'upsertStyleVariable', category: 'color', name: 'not a name', value: '#000' },
  deleteStyleVariable: { type: 'deleteStyleVariable', category: 'color', name: 'nope' },
  upsertFont: { type: 'upsertFont', family: '', source: 'remote', fallback: 'sans-serif' },
  deleteFont: { type: 'deleteFont', family: 'nope' },
  upsertConnector: {
    type: 'upsertConnector',
    ref: 'cms',
    name: 'CMS',
    baseUrl: 'https://cms.example.com',
    endpoints: { read: {} }
  },
  patchConnector: { type: 'patchConnector', ref: 'nope', name: 'x' },
  deleteConnector: { type: 'deleteConnector', ref: 'nope' },
  upsertAction: { type: 'upsertAction', ref: 'go', name: 'Go', nodes: [] },
  patchAction: { type: 'patchAction', ref: 'nope', nodes: [] },
  deleteAction: { type: 'deleteAction', ref: 'nope' },
  upsertFunctionFile: { type: 'upsertFunctionFile', path: '../outside.ts', content: '' },
  deleteFunctionFile: { type: 'deleteFunctionFile', path: 'nope.ts' },
  upsertDataFile: { type: 'upsertDataFile', path: 'items.json', content: 'not json' },
  deleteDataFile: { type: 'deleteDataFile', path: 'nope.json' }
};

const MCP = join(dirname(fileURLToPath(import.meta.url)), '..');

const sources = (folder: string): string[] =>
  readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      return name === 'tests' ? [] : sources(path);
    }

    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });

describe('a refused operation', () => {
  // A code the list says the MCP raises and nothing here does is a row an agent never meets.
  it('raises every code the shared list says it does', () => {
    const code = sources(MCP)
      .map(path => readFileSync(path, 'utf-8'))
      .join('\n');
    const unraised = Object.entries(REFUSALS)
      .filter(
        ([name, refusal]: [string, RefusalEntry]) => refusal.surfaces.includes('mcp') && !code.includes(`'${name}'`)
      )
      .map(([name]) => name);

    expect(unraised).toEqual([]);
  });

  it('has a case for every operation there is', () => {
    expect(Object.keys(REFUSED).sort()).toEqual([...OPERATIONS_BY_TYPE.keys()].sort());
  });

  it.each(Object.values(REFUSED).map(op => [op.type, op] as const))(
    '%s: refused with a code of the shared list and a step to take',
    async (_type, op) => {
      const cap = capturing(buildSpace());
      const result = await apply({ operations: [op] }, buildSpace(), cap.persisters);

      expect(result.applied, JSON.stringify(result)).toBe(false);
      const errors = result.errors ?? [];
      expect(errors.length).toBeGreaterThan(0);
      for (const error of errors) {
        const surfaces: readonly RefusalSurface[] = REFUSALS[error.code].surfaces;
        expect(surfaces.includes('mcp'), error.code).toBe(true);
        expect(error.hint.trim(), error.message).not.toBe('');
        expect(error.hint, error.message).not.toMatch(/^nothing to/i);
      }
    }
  );
});
