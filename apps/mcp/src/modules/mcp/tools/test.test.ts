import { describe, expect, it } from 'vitest';

import { authorSpace, e2e, text, unit } from '@plitzi/sdk-authoring';

import { test as spaceTest } from './test';

import type { ToolContext } from './shared/tool';
import type { Schema } from '@plitzi/sdk-shared';

const { schema } = authorSpace({
  name: 'Tested',
  permanentUrl: 'tested',
  pages: [{ name: 'Home', slug: '', body: [text('Hi', { id: 'hello' })] }]
});

const contextOf = (document: Schema, saved: Schema[] = [], runE2eTests?: ToolContext['runE2eTests']): ToolContext =>
  ({
    space: { schema: document },
    env: 'main',
    persisters: { tests: (next: Schema) => Promise.resolve(void saved.push(next)) },
    ...(runE2eTests ? { runE2eTests } : {})
  }) as unknown as ToolContext;

// An agent writes the space's tests as a person does in the builder: saved whole in the document, refused when not tests.
describe('plitzi_test', () => {
  it('saves the tests whole, and answers how they stand', async () => {
    const saved: Schema[] = [];
    const answer = await spaceTest(
      {
        action: 'set',
        tests: { unit: [unit.test({ id: 'shows', title: 'Shows', element: 'hello', expect: [unit.visible()] })] }
      },
      contextOf(schema, saved)
    );

    expect(answer).toMatchObject({ saved: true, problems: [], unit: { passed: 1, failed: 0 } });
    expect(saved[0]?.tests?.unit?.map(test => test.id)).toEqual(['shows']);
    expect(await spaceTest({ action: 'set', tests: { unit: [{ id: 'x' }] } }, contextOf(schema))).toMatchObject({
      saved: false,
      problems: expect.arrayContaining(['tests.unit[0].title: words']) as unknown
    });
  });

  it('runs the unit tests here, and the e2e ones where the deployment plays them — said as not run where it does not', async () => {
    const document: Schema = {
      ...schema,
      tests: {
        unit: [unit.test({ id: 'hidden', title: 'Hidden', element: 'hello', expect: [unit.visible(false)] })],
        e2e: [e2e.test({ id: 'opens', title: 'Opens', page: '/', steps: [e2e.expectShown('hello')] })]
      }
    };

    expect(await spaceTest({ action: 'run' }, contextOf(document))).toMatchObject({
      unit: { passed: 0, failed: 1 },
      e2e: { notRun: 'this deployment plays no e2e tests' }
    });
    const played = await spaceTest(
      { action: 'run', ids: ['opens'] },
      contextOf(document, [], ids => Promise.resolve({ results: ids.map(id => ({ id, ok: true })) }))
    );
    expect(played).toMatchObject({ e2e: { results: [{ id: 'opens', ok: true }] } });
  });
});
