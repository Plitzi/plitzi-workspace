import { describe, it, expect } from 'vitest';

import getBindingsDetails from './getBindingsDetails';

import type { Element, ElementBinding } from '../types';
import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

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

  // The schema's element is shared by every render: written through copies, never in place — a frozen one too.
  it('leaves the element as it was, copies only what it writes through, and shares the rest', () => {
    const deepFreeze = <T>(value: T): T => {
      if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
      }

      return value;
    };
    const element = deepFreeze(
      makeElement(
        {
          attributes: [binding({ source: 'row.title', to: 'card.title' })],
          initialState: [binding({ id: 'b2', source: 'row.open', to: 'open' })]
        },
        { card: { title: 'before', tags: ['a'] }, other: { kept: true } }
      )
    );
    const result = getBindingsDetails({ row: { title: 'after', open: true } }, element);

    expect(result.attributes.card).toEqual({ title: 'after', tags: ['a'] });
    expect(result.definition.initialState).toEqual({ open: true });
    expect(element.attributes.card).toEqual({ title: 'before', tags: ['a'] });
    expect(element.definition.initialState).toBeUndefined();
    expect(result.attributes.other).toBe(element.attributes.other);
    expect((result.attributes.card as { tags: unknown }).tags).toBe(
      (element.attributes.card as { tags: unknown }).tags
    );
    expect(result.definition.styleSelectors).toBe(element.definition.styleSelectors);
  });

  // A binding that writes what is already there is no change: the element's own objects come back, as with no binding.
  it('hands back the element’s own objects when a binding writes the value they already hold', () => {
    const element = makeElement(
      { attributes: [binding({ source: 'row.title', to: 'card.title' })] },
      {
        card: { title: 'same' }
      }
    );
    const result = getBindingsDetails({ row: { title: 'same' } }, element);

    expect(result.attributes).toBe(element.attributes);
    expect(result.definition).toBe(element.definition);
  });

  it('writes an attribute binding from source path into the target attribute', () => {
    const element = makeElement({ attributes: [binding({ source: 'variables.title', to: 'text' })] });
    const result = getBindingsDetails({ variables: { title: 'Hello' } }, element);

    expect(result.attributes.text).toBe('Hello');
  });

  // Read as lodash's `get` read them, which this replaced: an index, a primitive's property, a key holding the dots.
  it('reads a source path through an index, a value’s own property, and a key that is the whole path', () => {
    const read = (source: string, data: Record<string, RuleValue>) =>
      getBindingsDetails(data, makeElement({ attributes: [binding({ source, to: 'text' })] })).attributes.text;

    expect(read('rows[1].name', { rows: [{ name: 'a' }, { name: 'b' }] })).toBe('b');
    expect(read('rows.1.name', { rows: [{ name: 'a' }, { name: 'b' }] })).toBe('b');
    expect(read('variables.title.length', { variables: { title: 'Hello' } })).toBe(5);
    expect(read('list_x.item', { 'list_x.item': 'flat', list_x: { item: 'nested' } })).toBe('flat');
    expect(read('variables.missing.deeper', { variables: {} })).toBeUndefined();
  });

  it('camelCases the to for style bindings', () => {
    const element = makeElement({ style: [binding({ source: 'variables.col', to: 'background-color' })] });
    const result = getBindingsDetails({ variables: { col: 'red' } }, element);

    expect((result.style as Record<string, unknown>).backgroundColor).toBe('red');
  });

  // A run's phone sheet bound its tab's word through twigTemplate and an appended styleVariant: with no variant held
  // before, `sourceTo` was the bound word, spread beside the key as {"0":"o","1":"n","sheetTarget":{"base":"on"}}.
  it('appends a style variant to what the element holds, and to nothing when it holds none', () => {
    const variant = () =>
      makeElement({
        initialState: [
          binding({
            source: 'computed.tab',
            to: 'styleVariant',
            transformers: [
              { action: 'twigTemplate', params: { template: "{{ source == 'log' ? 'on' : '' }}" } },
              { action: 'styleVariant', params: { key: 'sheetTarget.base', variant: '', append: 'true' } }
            ]
          })
        ]
      });
    const withHeld = variant();
    withHeld.definition.initialState = { styleVariant: { sheet: { base: 'half' } } };

    expect(getBindingsDetails({ computed: { tab: 'log' } }, variant()).definition.initialState?.styleVariant).toEqual({
      sheetTarget: { base: 'on' }
    });
    expect(getBindingsDetails({ computed: { tab: 'log' } }, withHeld).definition.initialState?.styleVariant).toEqual({
      sheet: { base: 'half' },
      sheetTarget: { base: 'on' }
    });
  });

  it('gives a transformer the field’s previous value as sourceTo — nothing when it had none, never the bound value', () => {
    const asked = (attributes: Record<string, unknown>) =>
      makeElement(
        {
          attributes: [
            binding({
              source: 'variables.word',
              to: 'text',
              transformers: [
                { action: 'twigTemplate', params: { template: "{{ sourceTo ? 'had ' ~ sourceTo : 'none' }}" } }
              ]
            })
          ]
        },
        attributes
      );

    expect(getBindingsDetails({ variables: { word: 'on' } }, asked({})).attributes.text).toBe('none');
    expect(getBindingsDetails({ variables: { word: 'on' } }, asked({ text: 'Log' })).attributes.text).toBe('had Log');
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

  /**
   * A visibility answered with anything else than a boolean: a condition's template printing nothing, `0` or a list.
   * Each is a no — and a no is WRITTEN, so an element shown a moment ago is hidden again when its condition empties.
   * A value not there at all is no answer yet, and leaves the element as it starts.
   */
  it('reads a visibility as a yes or a no once the data answers, writing the no too', () => {
    const element = makeElement({
      initialState: [
        binding({
          source: 'variables.owner',
          to: 'visibility',
          transformers: [{ action: 'twigTemplate', params: { template: '{{ source }}' } }]
        })
      ]
    });
    const visibility = (owner: unknown) =>
      getBindingsDetails({ variables: { owner } }, element).definition.initialState?.visibility;

    expect(visibility('key-1')).toBe(true);
    expect(visibility('')).toBe(false);
    expect(visibility('0')).toBe(false);
    expect(visibility(undefined)).toBeUndefined();
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

  it('hands a template `source` as the bound value — undefined before it has one — and the current value as `sourceTo`', () => {
    const element = makeElement(
      {
        attributes: [
          binding({
            source: 'state.preset',
            to: 'content',
            transformers: [
              {
                action: 'twigTemplate',
                params: { template: "{{ source|default('fade-up') }} / {{ sourceTo }}" }
              }
            ]
          })
        ]
      },
      { content: 'Text' }
    );

    expect(getBindingsDetails({ state: {} }, element).attributes.content).toBe('fade-up / Text');
    expect(getBindingsDetails({ state: { preset: 'scale' } }, element).attributes.content).toBe('scale / Text');
  });

  /** A colour from data, under a palette the class keeps: `background-color: var(--who, var(--muted))`. */
  it('writes a custom property as it is named', () => {
    const element = makeElement({ style: [binding({ source: 'variables.col', to: '--who' })] });

    expect(getBindingsDetails({ variables: { col: '#4422ee' } }, element).style).toEqual({ '--who': '#4422ee' });
  });

  /** The page server writes inline styles as text: a value that ends its declaration would add others. */
  it('writes no style value that could end its declaration', () => {
    const element = makeElement({ style: [binding({ source: 'variables.col', to: 'background-color' })] });

    expect(getBindingsDetails({ variables: { col: 'red;position:fixed' } }, element).style).toEqual({});
    expect(getBindingsDetails({ variables: { col: 'rgb(0 0 0 / 50%)' } }, element).style).toEqual({
      backgroundColor: 'rgb(0 0 0 / 50%)'
    });
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
