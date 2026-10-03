/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { applyChanges, sourceEdit } from './sourceEdits';

import type { SpecEdit } from '@plitzi/sdk-authoring';

/** The source with the edit made at the call whose name starts at `marker` (its first occurrence, or `nth`). */
const edited = (text: string, marker: string, edit: SpecEdit, nth = 0): string => {
  const sourceFile = ts.createSourceFile('space.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let at = -1;
  for (let count = 0; count <= nth; count += 1) {
    at = text.indexOf(marker, at + 1);
  }

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(at);
  const outcome = sourceEdit(ts, sourceFile, { line: line + 1, column: character + 1 }, edit);
  if ('unplaced' in outcome) {
    return `unplaced: ${outcome.unplaced}`;
  }

  return applyChanges(text, [outcome.change]) ?? 'overlap';
};

describe('a planned edit, made in the source', () => {
  it('writes a value, drops a key and renames one, in the call that wrote the element', () => {
    expect(
      edited("element('image', { id: 'p', src: '/a.png', decorative: 'true' })", 'element', {
        on: 'attribute',
        op: 'set',
        key: 'decorative',
        value: true
      })
    ).toBe("element('image', { id: 'p', src: '/a.png', decorative: true })");
    expect(
      edited("text({ content: 'Hi', contnet: 'x' })", 'text', { on: 'attribute', op: 'remove', key: 'contnet' })
    ).toBe("text({ content: 'Hi' })");
    expect(
      edited("link({ hreff: '/a', children: [] })", 'link', { on: 'attribute', op: 'rename', key: 'hreff', to: 'href' })
    ).toBe("link({ href: '/a', children: [] })");
  });

  it('adds what was not written, and leaves alone what is not written as a value', () => {
    expect(
      edited("modalContainer({ id: 'm' })", 'modal', { on: 'field', op: 'set', key: 'visible', value: false })
    ).toBe("modalContainer({ id: 'm', visible: false })");
    expect(
      edited('image({ src: s, decorative: flag })', 'image', {
        on: 'attribute',
        op: 'set',
        key: 'decorative',
        value: true
      })
    ).toBe('unplaced: `decorative` is not written as a value there');
  });

  it('tells two calls on one line apart by where each starts', () => {
    const line = "container({ children: [text({ a: 'x' }), text({ a: 'y' })] })";

    expect(edited(line, 'text', { on: 'attribute', op: 'remove', key: 'a' }, 1)).toBe(
      "container({ children: [text({ a: 'x' }), text({  })] })"
    );
  });

  it('edits a step by its flow and place, through a wrapper', () => {
    const source = "button({ flows: [[onClick(), named('add', setState({ key: 'state.count', value: '1' }))]] })";

    expect(
      edited(source, 'button', { on: 'step', op: 'set', key: 'key', value: 'count', step: { flow: 0, index: 1 } })
    ).toBe("button({ flows: [[onClick(), named('add', setState({ key: 'count', value: '1' }))]] })");
  });

  it('edits a binding by its target, in either form, and a transformer by its action', () => {
    expect(
      edited("text({ bind: { content: 'a.b', colour: 'c.d' } })", 'text', {
        on: 'binding',
        op: 'remove',
        key: 'colour'
      })
    ).toBe("text({ bind: { content: 'a.b' } })");
    expect(
      edited("text({ bind: [{ to: 'colour', source: 'c' }, { to: 'content', source: 'a' }] })", 'text', {
        on: 'binding',
        op: 'remove',
        key: 'colour'
      })
    ).toBe("text({ bind: [{ to: 'content', source: 'a' }] })");
    expect(
      edited("text({ bind: [{ to: 'content', source: 'a', transformers: [{ action: 'twigTemplat' }] }] })", 'text', {
        on: 'binding',
        op: 'replace',
        key: 'twigTemplat',
        to: 'twigTemplate'
      })
    ).toBe("text({ bind: [{ to: 'content', source: 'a', transformers: [{ action: 'twigTemplate' }] }] })");
  });

  it('takes `bind` away with its last binding', () => {
    expect(
      edited("text({ content: 'Hi', bind: { colour: 'c.d' } })", 'text', { on: 'binding', op: 'remove', key: 'colour' })
    ).toBe("text({ content: 'Hi' })");
  });

  it('says why when the call is not where it was', () => {
    expect(edited("text({ content: 'Hi' })", 'content', { on: 'attribute', op: 'remove', key: 'content' })).toBe(
      'unplaced: the call that wrote it is not where it was'
    );
  });
});
