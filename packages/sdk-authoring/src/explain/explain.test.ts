import { describe, expect, it } from 'vitest';

import { BUILDER_NAMES, EXPLAIN_KINDS, explain, explainKindOf, explainList, explanationText } from './explain';
import * as authoring from '../index';

describe('explain', () => {
  it('says what an element takes, fires and answers, and how it is written', () => {
    const [container] = explain('container');

    expect(container).toMatchObject({ kind: 'element', factory: 'container({ … })', holdsChildren: true });
    const subType =
      container.kind === 'element' ? container.attributes.find(({ name }) => name === 'subType') : undefined;
    expect(subType?.values).toEqual(expect.arrayContaining(['section', 'span']));
    expect(container.kind === 'element' && container.callbacks).toEqual(
      expect.arrayContaining(['scrollBy', 'setState'])
    );
  });

  it('says a step’s params and the function that writes it', () => {
    const [navigate] = explain('navigate');

    expect(navigate).toMatchObject({ kind: 'step', type: 'globalCallback', builder: 'navigate' });
    expect(navigate.kind === 'step' && navigate.params.map(param => param.name)).toEqual(
      expect.arrayContaining(['urlType', 'url'])
    );
  });

  it('says both meanings of a name that has two', () => {
    expect(explain('setState').map(entry => entry.kind === 'step' && [entry.type, entry.builder])).toEqual([
      ['globalCallback', 'setState'],
      ['callback', 'updateElement']
    ]);
  });

  it('says what a trigger hands its flow, and what fires it', () => {
    expect(explain('onScroll')).toEqual([
      expect.objectContaining({
        kind: 'trigger',
        builder: 'onScroll',
        reads: ['x', 'y', 'atStart', 'atEnd'],
        firedBy: 'every element'
      })
    ]);
    expect(explain('onSubmit')).toEqual([expect.objectContaining({ kind: 'trigger', firedBy: ['form'] })]);
  });

  it('says what a problem’s code means and what to write instead', () => {
    expect(explanationText(explain('class-and-css')[0])).toMatch(/^class-and-css — refused: .*\nWrite instead: /);
  });

  it('says nothing about a name that is nothing', () => {
    expect(explain('teleport')).toEqual([]);
  });

  it('lists every name of a kind, each with a line', () => {
    for (const plural of Object.values(EXPLAIN_KINDS)) {
      const kind = explainKindOf(plural);
      if (!kind) {
        throw new Error(`no kind is listed as ${plural}`);
      }

      const listed = explainList(kind);

      expect(listed.length).toBeGreaterThan(3);
      expect(listed.every(entry => entry.summary !== '')).toBe(true);
    }
  });

  // A builder renamed without this table is a step `explain` would say is written by a function that does not exist.
  it('names only builders the package exports', () => {
    for (const builder of Object.values(BUILDER_NAMES)) {
      expect(authoring, builder).toHaveProperty(builder);
    }
  });
});
