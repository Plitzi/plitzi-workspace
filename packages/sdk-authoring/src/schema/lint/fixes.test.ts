import { describe, expect, it } from 'vitest';

import { BUILTIN_GLOBAL_CALLBACKS, FIXABLE_CODES, fixSpace, lintSpace } from '../../index';
import { addElement, authored, onClick, setFlow, step, withChange } from './testUtils/lintFixture';

import type { Documents } from './testUtils/lintFixture';

const codesOf = (documents: Documents): string[] => {
  const { errors, warnings } = lintSpace(documents);

  return [...errors, ...warnings].map(issue => issue.code);
};

/** A space broken the one way each fixable rule is about — the same breakages the linter's own cases use. */
const broken: Record<string, () => Documents> = {
  'page-target-url': () =>
    withChange(({ schema }) => {
      schema.flat['to-about'].attributes.href = 'mailto:hello@example.com';
    }),
  'unknown-attribute': () =>
    withChange(({ schema }) => {
      schema.flat.hello.attributes.contnet = 'Typo';
      schema.flat.hello.attributes.title = 'Never read';
      Reflect.deleteProperty(schema.flat.hello.attributes, 'content');
    }),
  'attribute-kind': () =>
    withChange(({ schema }) => {
      schema.flat.go.attributes.disabled = 'true';
    }),
  'step-params': () =>
    withChange(({ schema }) => {
      setFlow(schema, 'go', [
        onClick(),
        step('notify', 'globalCallback', 'addNotification', {
          elementId: BUILTIN_GLOBAL_CALLBACKS.addNotification.source,
          params: { content: 'Hi', appeareance: 'success', autoDismiss: 'false' }
        })
      ]);
    }),
  'global-callback-module': () =>
    withChange(({ schema }) => {
      setFlow(schema, 'go', [
        onClick(),
        step('notify', 'globalCallback', 'addNotification', { elementId: 'go', params: { content: 'Hi' } })
      ]);
    }),
  'utility-module': () =>
    withChange(({ schema }) => {
      setFlow(schema, 'go', [
        onClick(),
        step('wait', 'utility', 'delayTime', { elementId: 'go', params: { time: 1 } })
      ]);
    }),
  'visibility-as-attribute': () =>
    withChange(({ schema }) => {
      schema.flat.hello.definition.bindings = { attributes: [{ id: 'b1', to: 'visibility', source: 'state.open' }] };
    }),
  'binding-target-unknown': () =>
    withChange(({ schema }) => {
      schema.flat.hello.definition.bindings = { attributes: [{ id: 'b1', to: 'data-name', source: 'state.name' }] };
    }),
  'unknown-transformer': () =>
    withChange(({ schema }) => {
      schema.flat.hello.definition.bindings = {
        attributes: [
          {
            id: 'b1',
            to: 'content',
            source: 'state.name',
            transformers: [{ action: 'template', params: { template: '{{ source }}' } }]
          }
        ]
      };
    }),
  'overlay-starts-open': () =>
    withChange(({ schema }) => {
      schema.flat.modal.definition.initialState = { visibility: true };
    }),
  'state-key-has-runtime-prefix': () =>
    withChange(({ schema }) => {
      setFlow(schema, 'go', [
        onClick(),
        step('write', 'globalCallback', 'setState', {
          elementId: 'state',
          params: { key: 'state.name', type: 'text', value: 'Ada' }
        })
      ]);
    })
};

describe('fixSpace', () => {
  for (const [code, breakage] of Object.entries(broken)) {
    it(`settles ${code}, says so, and leaves nothing new behind`, () => {
      const documents = breakage();
      const before = codesOf(documents);
      expect(before).toContain(code);

      const { schema, style, applied } = fixSpace(documents);
      const after = codesOf({ schema, style });

      expect(after).not.toContain(code);
      expect(applied.some(fix => fix.code === code && fix.message !== '')).toBe(true);
      expect(after.filter(remaining => !before.includes(remaining))).toEqual([]);
    });
  }

  it('renames a typo to the attribute it was meant to be, and drops what nothing reads', () => {
    const { schema } = fixSpace(broken['unknown-attribute']());

    expect(schema.flat.hello.attributes).toEqual({ content: 'Typo' });
  });

  it('works on a copy: the documents handed in are left as they were', () => {
    const documents = broken['page-target-url']();
    const snapshot = structuredClone(documents);

    fixSpace(documents);

    expect(documents).toEqual(snapshot);
  });

  it('changes nothing in a space with nothing to fix', () => {
    const documents = authored();

    expect(fixSpace(documents)).toEqual({ ...documents, applied: [] });
  });

  it('fixes only the codes asked for', () => {
    const documents = withChange(({ schema }) => {
      schema.flat['to-about'].attributes.href = 'mailto:hello@example.com';
      addElement(schema, { id: 'extra', type: 'text', attributes: { content: 'x', title: 'Never read' } });
    });

    const { applied } = fixSpace(documents, {}, ['page-target-url']);

    expect(applied.map(fix => fix.code)).toEqual(['page-target-url']);
  });

  it('has a case for every code it can fix', () => {
    expect([...FIXABLE_CODES].filter(code => !Object.hasOwn(broken, code))).toEqual([]);
  });
});
