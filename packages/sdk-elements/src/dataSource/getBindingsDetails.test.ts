import { describe, it, expect } from 'vitest';

import getBindingsDetails from './getBindingsDetails';

import type { Element, ElementBinding } from '@plitzi/sdk-shared';

const makeElement = (
  bindings?: Element['definition']['bindings'],
  attributes: Record<string, unknown> = {}
): Element => ({
  id: 'el1',
  attributes,
  definition: {
    rootId: 'root',
    label: 'El',
    type: 'text',
    styleSelectors: { base: 'el1' },
    bindings
  }
});

const binding = (over: Partial<ElementBinding>): ElementBinding => ({
  id: 'b1',
  source: 'variables',
  toPath: 'text',
  enabled: true,
  ...over
});

describe('getBindingsDetails', () => {
  it('returns the element untouched when there are no bindings', () => {
    const element = makeElement(undefined, { text: 'original' });
    const result = getBindingsDetails({}, element);

    expect(result.attributes).toEqual({ text: 'original' });
    expect(result.style).toEqual({});
    expect(result.definition).toBe(element.definition);
  });

  it('writes an attribute binding from source.fromPath into the target attribute', () => {
    const element = makeElement({ attributes: [binding({ fromPath: 'title', toPath: 'text' })] });
    const result = getBindingsDetails({ variables: { title: 'Hello' } }, element);

    expect(result.attributes.text).toBe('Hello');
  });

  it('camelCases the toPath for style bindings', () => {
    const element = makeElement({ style: [binding({ fromPath: 'col', toPath: 'background-color' })] });
    const result = getBindingsDetails({ variables: { col: 'red' } }, element);

    expect((result.style as Record<string, unknown>).backgroundColor).toBe('red');
  });

  it('writes initialState bindings under definition.initialState', () => {
    const element = makeElement({ initialState: [binding({ fromPath: 'on', toPath: 'visibility' })] });
    const result = getBindingsDetails({ variables: { on: true } }, element);

    expect(result.definition.initialState?.visibility).toBe(true);
  });

  it('skips a binding whose `when` evaluates to false and applies it when true', () => {
    const when = {
      combinator: 'and',
      rules: [{ field: 'variables.flag', operator: '=', value: true }]
    } as ElementBinding['when'];
    const element = makeElement({ attributes: [binding({ fromPath: 'title', toPath: 'text', when })] });

    expect(getBindingsDetails({ variables: { flag: false, title: 'Hi' } }, element).attributes.text).toBeUndefined();
    expect(getBindingsDetails({ variables: { flag: true, title: 'Hi' } }, element).attributes.text).toBe('Hi');
  });

  it('skips a disabled binding', () => {
    const element = makeElement({ attributes: [binding({ fromPath: 'title', toPath: 'text', enabled: false })] });
    const result = getBindingsDetails({ variables: { title: 'Hello' } }, element);

    expect(result.attributes.text).toBeUndefined();
  });

  it('applies a utility transformer to the resolved value', () => {
    const element = makeElement({
      attributes: [
        binding({
          fromPath: 'title',
          toPath: 'text',
          transformers: [{ type: 'utility', action: 'capitalize', params: { valueType: '', value: '' } }]
        })
      ]
    });
    const result = getBindingsDetails({ variables: { title: 'hello' } }, element);

    expect(result.attributes.text).toBe('Hello');
  });

  describe('falsy write predicate (current behavior — no allowEmpty)', () => {
    it('does NOT write an empty string (keeps the design-time value)', () => {
      const element = makeElement({ attributes: [binding({ fromPath: 'title', toPath: 'text' })] }, { text: 'keep' });
      const result = getBindingsDetails({ variables: { title: '' } }, element);

      expect(result.attributes.text).toBe('keep');
    });

    it('writes 0 (number) and false (boolean)', () => {
      const element = makeElement({
        attributes: [
          binding({ id: 'b1', fromPath: 'n', toPath: 'count' }),
          binding({ id: 'b2', fromPath: 'b', toPath: 'flag' })
        ]
      });
      const result = getBindingsDetails({ variables: { n: 0, b: false } }, element);

      expect(result.attributes.count).toBe(0);
      expect(result.attributes.flag).toBe(false);
    });
  });
});
