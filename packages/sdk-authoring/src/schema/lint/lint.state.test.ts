import { describe, expect, it } from 'vitest';

import { lintSpace } from '../../index';
import { withChange } from './tests/lintFixture';

/** A space whose settings list keys to keep — one list, with `keepState` on or off — and the linter's warnings of it. */
const warned = (list: 'transientState' | 'keptState' | 'paintedState' | 'browserState', keepState: boolean) =>
  lintSpace(
    withChange(({ schema }) => {
      Object.assign(schema.settings, { keepState, [list]: ['dismissedNotice'] });
    })
  ).warnings.filter(issue => issue.code.endsWith('-without-keep-state'));

/** Read off the settings, so the builder says it of a space as authoring does: a list of kept keys with nothing kept. */
describe('lintSpace', () => {
  describe('kept state', () => {
    it('transient-state-without-keep-state', () => {
      expect(warned('transientState', false)).toMatchObject([
        { code: 'transient-state-without-keep-state', details: { keys: ['dismissedNotice'] } }
      ]);
      expect(warned('transientState', true)).toEqual([]);
    });

    it('kept-state-without-keep-state', () => {
      expect(warned('keptState', false).map(issue => issue.code)).toEqual(['kept-state-without-keep-state']);
      expect(warned('keptState', true)).toEqual([]);
    });

    it('painted-state-without-keep-state', () => {
      expect(warned('paintedState', false).map(issue => issue.code)).toEqual(['painted-state-without-keep-state']);
      expect(warned('paintedState', true)).toEqual([]);
    });

    it('browser-state-without-keep-state', () => {
      expect(warned('browserState', false).map(issue => issue.code)).toEqual(['browser-state-without-keep-state']);
      expect(warned('browserState', true)).toEqual([]);
    });
  });
});

/** A variant set on an element that no style declares: read off the documents, so the builder says it as authoring does. */
describe('lintSpace', () => {
  describe('variants', () => {
    it('unknown-variant', () => {
      const documents = withChange(({ schema, style }) => {
        style.platform.desktop.card = {
          name: 'card',
          type: 'class',
          cache: '',
          attributes: {
            base: { default: { 'padding-top': '8px' }, variants: { primary: { default: { color: 'red' } } } }
          }
        };
        const element = schema.flat[schema.pages[0] ?? ''];
        element.definition.initialState = {
          ...element.definition.initialState,
          styleVariant: { card: { base: 'secondary' } }
        };
      });
      const unknown = lintSpace(documents).warnings.filter(issue => issue.code === 'unknown-variant');

      expect(unknown).toHaveLength(1);
      expect(unknown[0].message).toContain("is written with `variant: 'secondary'`, which no class of it");

      const declared = withChange(({ schema, style }) => {
        style.platform.desktop.card = {
          name: 'card',
          type: 'class',
          cache: '',
          attributes: { base: { default: {}, variants: { primary: { default: { color: 'red' } } } } }
        };
        const element = schema.flat[schema.pages[0] ?? ''];
        element.definition.initialState = {
          ...element.definition.initialState,
          styleVariant: { card: { base: 'primary' } }
        };
      });
      expect(lintSpace(declared).warnings.filter(issue => issue.code === 'unknown-variant')).toEqual([]);
    });
  });
});
