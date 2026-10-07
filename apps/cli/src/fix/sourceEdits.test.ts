/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { applyChanges, attributeEdit, callTextAt, pruneImports, sourceEdit } from './sourceEdits';

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

  return applyChanges(text, outcome.changes) ?? 'overlap';
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
    ).toBe('unplaced: `decorative` is written as `decorative: flag` there: change it where that is given');
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

describe('children that are only words and an icon, written as the element’s own', () => {
  const move = (value: string, more: Partial<SpecEdit> = {}): SpecEdit => ({
    on: 'children',
    op: 'set',
    key: 'content',
    value,
    ...more
  });

  it('moves the words — as written, a literal or an expression — and the icon, after the words when it was', () => {
    expect(edited("link({ href: '/', children: [text('Pricing')] })", 'link', move('Pricing'))).toBe(
      "link({ href: '/', content: 'Pricing' })"
    );
    expect(edited('link({ href: entry.href, children: [text(entry.label)] })', 'link', move('Shop'))).toBe(
      'link({ href: entry.href, content: entry.label })'
    );
    expect(
      edited(
        "link({ children: [text('Docs'), fontAwesome({ icon: 'fa-solid fa-arrow-right' })] })",
        'link',
        move('Docs', { icon: 'fa-solid fa-arrow-right', iconPlacement: 'after' })
      )
    ).toBe("link({ content: 'Docs', icon: 'fa-solid fa-arrow-right', iconPlacement: 'after' })");
  });

  it("drops the `content: ''` that said it had no words of its own", () => {
    expect(edited("button({ content: '', title: 'Go', children: [text('Go')] })", 'button', move('Go'))).toBe(
      "button({ title: 'Go', content: 'Go' })"
    );
    expect(
      edited(
        "button({ content: '', title: 'Close', children: [fontAwesome({ icon: 'fa-solid fa-xmark' })] })",
        'button',
        move('', { icon: 'fa-solid fa-xmark' })
      )
    ).toBe("button({ content: '', title: 'Close', icon: 'fa-solid fa-xmark' })");
  });

  it('leaves to the author a child written with more than its words, or words that are not the ones shown', () => {
    expect(edited("link({ children: [text('Pricing', { class: strong })] })", 'link', move('Pricing'))).toBe(
      'unplaced: a child carries more than its words or its icon there'
    );
    expect(edited("link({ children: [text('Prices')] })", 'link', move('Pricing'))).toBe(
      'unplaced: the words written there are not the ones it shows'
    );
    expect(edited("button({ content: 'Save', children: [text('now')] })", 'button', move('now'))).toBe(
      'unplaced: it is written with words of its own beside its children'
    );
  });

  it('takes out the imports a move left unused, and only those', () => {
    const text = [
      "import { fontAwesome, link, text } from '@plitzi/sdk-authoring';",
      "import { heading } from './kit';",
      '',
      "export const nav = link({ href: '/', content: 'Home' });",
      "export const lede = text('Still here');"
    ].join('\n');

    expect(pruneImports(ts, 'nav.ts', text, ['text', 'fontAwesome'])).toBe(
      text.replace('{ fontAwesome, link, text }', '{ link, text }')
    );
    expect(
      pruneImports(ts, 'nav.ts', "import { text } from '@plitzi/sdk-authoring';\nexport const a = 1;", ['text'])
    ).toBe('\nexport const a = 1;');
  });
});

describe('an attribute edited where the element was written (plitzi edit)', () => {
  const at = (text: string, marker: string) => {
    const sourceFile = ts.createSourceFile('space.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(text.indexOf(marker));

    return { sourceFile, position: { line: line + 1, column: character + 1 } };
  };
  const edit = (text: string, marker: string, key: string, value?: string | number | boolean): string => {
    const { sourceFile, position } = at(text, marker);
    const outcome = attributeEdit(ts, sourceFile, position, key, value);

    return 'unplaced' in outcome ? `unplaced: ${outcome.unplaced}` : (applyChanges(text, outcome.changes) ?? 'overlap');
  };

  it('replaces words written as the factory’s first argument there, and anything else in its props', () => {
    expect(edit("text('Search', { id: 'w' })", 'text', 'content', 'Find')).toBe("text('Find', { id: 'w' })");
    expect(edit("heading({ id: 'h', level: 2 })", 'heading', 'level', 3)).toBe("heading({ id: 'h', level: 3 })");
    expect(edit("link({ id: 'l', target: '_blank' })", 'link', 'target')).toBe("link({ id: 'l' })");
  });

  it('leaves words written as the first argument to the author when they are to go', () => {
    expect(edit("text('Search', { id: 'w' })", 'text', 'content')).toBe(
      'unplaced: `content` is the call’s first argument there: remove it from the call by hand'
    );
  });

  // A helper's parameter, or a value from anywhere else: what the visitor reads is decided where it is given, and a
  // `content` added to the props would win over the first argument and leave it written for nothing.
  it('leaves words given from elsewhere where they are given', () => {
    expect(edit("heading(title, { id: 'h' })", 'heading', 'content', 'About')).toBe(
      'unplaced: `content` is written as `title` there: change it where that is given'
    );
    expect(edit("paragraph({ id: 'p', content: line })", 'paragraph', 'content', 'About')).toBe(
      'unplaced: `content` is written as `content: line` there: change it where that is given'
    );
  });

  it('shows the call as it is written', () => {
    const text = "const page = [text('Hi', { id: 'a' }), link({ id: 'b' })];";
    const { sourceFile, position } = at(text, 'link');

    expect(callTextAt(ts, sourceFile, position)).toBe("link({ id: 'b' })");
  });
});
