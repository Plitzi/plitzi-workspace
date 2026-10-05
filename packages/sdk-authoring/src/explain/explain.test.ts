/* eslint-disable quotes -- the expectations quote code, which reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { BUILDER_SIGNATURES } from './builders';
import { BUILDER_NAMES, EXPLAIN_KINDS, explain, explainKindOf, explainList, explanationText } from './explain';
import { AUTHORING_HELPERS } from './helpers';
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

  /** Asked by the name the code writes it with: `reloadApi(…)` is the `performQuery` step, `cancelApi(…)` `cancelQuery`. */
  it('answers a builder named otherwise than its step with the step it writes', () => {
    expect(explain('reloadApi')).toEqual([
      expect.objectContaining({ kind: 'step', name: 'performQuery', builder: 'reloadApi' })
    ]);
    expect(explain('cancelApi')).toEqual([
      expect.objectContaining({ kind: 'step', name: 'cancelQuery', builder: 'cancelApi' })
    ]);
    expect(explain('whileRunning')).toEqual([expect.objectContaining({ kind: 'helper', name: 'whileRunning' })]);
  });

  /** A builder called with arguments of its own is written as it is called, not with the document's param names. */
  it('writes a step the way its builder is called', () => {
    const written = (name: string): string => explain(name).map(explanationText).join('\n');

    expect(written('delayTime')).toContain('Written: delay(ms)');
    expect(written('navigate')).toContain('Written: navigate({ … })');
    expect(written('onInterval')).toContain('Written: onInterval(ms)');
  });

  it('holds every builder signature to an export taking those arguments', () => {
    const exports: Record<string, unknown> = { ...authoring };
    /** The signature's arguments, and how many of them are required (no `?`). */
    const argumentsOf = (signature: string): { all: number; required: number } => {
      const args: string[] = [];
      let depth = 0;
      let quoted = false;
      let current = '';
      for (const character of signature.slice(signature.indexOf('(') + 1, signature.lastIndexOf(')'))) {
        quoted = character === "'" ? !quoted : quoted;
        depth += character === '{' ? 1 : character === '}' ? -1 : 0;
        if (character === ',' && depth === 0 && !quoted) {
          args.push(current.trim());
          current = '';
        } else {
          current += character;
        }
      }

      const all = [...args, current.trim()].filter(arg => arg !== '');

      return { all: all.length, required: all.filter(arg => !arg.endsWith('?')).length };
    };

    for (const [name, signature] of Object.entries(BUILDER_SIGNATURES)) {
      const builder = exports[name];
      expect(typeof builder, name).toBe('function');
      // A function's `length` stops at its first parameter with a default, and counts an optional one without.
      const length = typeof builder === 'function' ? builder.length : -1;
      const { all, required } = argumentsOf(signature);
      expect(length >= required && length <= all, `${signature} — the builder takes ${String(length)}`).toBe(true);
    }
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
    expect(explanationText(explain('content-attribute')[0])).toMatch(
      /^content-attribute — suggested: .*\nThe short way: /
    );
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

  /** The helpers an agent otherwise looks up in the `.d.ts`: each one a function the package exports. */
  it('says what a helper is for and how it is written — only helpers the package exports', () => {
    for (const helper of Object.keys(AUTHORING_HELPERS)) {
      expect(typeof (authoring as Record<string, unknown>)[helper], helper).toBe('function');
    }

    expect(explainText('bindTemplate')).toContain(
      "Written: bindTemplate(to, source, template, { returns?: 'text' | 'value', category? })"
    );
    expect(explainList('helper').map(entry => entry.name)).toContain('scope');
  });

  /** `motion` is a field, not a function: said from the presets the SDK plays, so the list cannot fall behind. */
  it('says what motion takes, from the presets themselves', () => {
    expect(explainText('motion')).toContain("enter?: 'fade' | 'fade-up'");
    expect(explainText('motion')).toContain("loop?: 'float'");
    expect(authoring.MOTION_ENTERS).toContain('fade-up');
    expect(authoring.MOTION_LOOPS).toContain('float');
  });
});

const explainText = (name: string): string => explain(name).map(explanationText).join('\n');
