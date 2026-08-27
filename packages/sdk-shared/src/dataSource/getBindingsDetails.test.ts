import { describe, it, expect } from 'vitest';

import getBindingsDetails from './getBindingsDetails';

import type { Element, ElementBinding } from '../types';

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
  to: 'text',
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

  it('writes an attribute binding from source path into the target attribute', () => {
    const element = makeElement({ attributes: [binding({ source: 'variables.title', to: 'text' })] });
    const result = getBindingsDetails({ variables: { title: 'Hello' } }, element);

    expect(result.attributes.text).toBe('Hello');
  });

  it('camelCases the to for style bindings', () => {
    const element = makeElement({ style: [binding({ source: 'variables.col', to: 'background-color' })] });
    const result = getBindingsDetails({ variables: { col: 'red' } }, element);

    expect((result.style as Record<string, unknown>).backgroundColor).toBe('red');
  });

  it('writes initialState bindings under definition.initialState', () => {
    const element = makeElement({ initialState: [binding({ source: 'variables.on', to: 'visibility' })] });
    const result = getBindingsDetails({ variables: { on: true } }, element);

    expect(result.definition.initialState?.visibility).toBe(true);
  });

  /**
   * The end of the chain `hiddenWhen` authors, and the part that is easy to get wrong twice over: the pipeline
   * writes `false` only because it checks the TYPE before truthiness, and `isVisible` hides only on `false` or
   * `"false"`. A transformer that returned the string "0", or a pipeline that dropped a falsy result, would leave
   * the element on screen with nothing reporting it.
   */
  it('hides an element when a `not` transformer inverts a true source', () => {
    const element = makeElement({
      initialState: [
        binding({ source: 'variables.found', to: 'visibility', transformers: [{ action: 'not', params: {} }] })
      ]
    });

    expect(getBindingsDetails({ variables: { found: true } }, element).definition.initialState?.visibility).toBe(false);
    expect(getBindingsDetails({ variables: { found: false } }, element).definition.initialState?.visibility).toBe(true);
  });

  it('skips a binding whose `when` evaluates to false and applies it when true', () => {
    const when = {
      combinator: 'and',
      rules: [{ field: 'variables.flag', operator: '=', value: true }]
    } as ElementBinding['when'];
    const element = makeElement({
      attributes: [binding({ source: 'variables.title', to: 'text', when })]
    });

    expect(getBindingsDetails({ variables: { flag: false, title: 'Hi' } }, element).attributes.text).toBeUndefined();
    expect(getBindingsDetails({ variables: { flag: true, title: 'Hi' } }, element).attributes.text).toBe('Hi');
  });

  it('skips a disabled binding', () => {
    const element = makeElement({
      attributes: [binding({ source: 'variables.title', to: 'text', enabled: false })]
    });
    const result = getBindingsDetails({ variables: { title: 'Hello' } }, element);

    expect(result.attributes.text).toBeUndefined();
  });

  it('applies a utility transformer to the resolved value', () => {
    const element = makeElement({
      attributes: [
        binding({
          source: 'variables.title',
          to: 'text',
          transformers: [{ action: 'capitalize', params: { valueType: '', value: '' } }]
        })
      ]
    });
    const result = getBindingsDetails({ variables: { title: 'hello' } }, element);

    expect(result.attributes.text).toBe('Hello');
  });

  it('skips a disabled transformer and passes the value through unchanged', () => {
    const element = makeElement({
      attributes: [
        binding({
          source: 'variables.title',
          to: 'text',
          transformers: [{ action: 'capitalize', params: { valueType: '', value: '' }, enabled: false }]
        })
      ]
    });
    const result = getBindingsDetails({ variables: { title: 'hello' } }, element);

    expect(result.attributes.text).toBe('hello');
  });

  describe('falsy write predicate (current behavior — no allowEmpty)', () => {
    it('does NOT write an empty string (keeps the design-time value)', () => {
      const element = makeElement(
        { attributes: [binding({ source: 'variables.title', to: 'text' })] },
        { text: 'keep' }
      );
      const result = getBindingsDetails({ variables: { title: '' } }, element);

      expect(result.attributes.text).toBe('keep');
    });

    it('writes 0 (number) and false (boolean)', () => {
      const element = makeElement({
        attributes: [
          binding({ id: 'b1', source: 'variables.n', to: 'count' }),
          binding({ id: 'b2', source: 'variables.b', to: 'flag' })
        ]
      });
      const result = getBindingsDetails({ variables: { n: 0, b: false } }, element);

      expect(result.attributes.count).toBe(0);
      expect(result.attributes.flag).toBe(false);
    });
  });
});
