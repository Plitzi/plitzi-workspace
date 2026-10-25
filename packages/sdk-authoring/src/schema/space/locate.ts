import { isRecord } from '@plitzi/sdk-shared/helpers';

import { writtenAtPosition, writtenCalls } from '../writtenAt';
import { SpaceAuthor } from './author';
import { isBoxless } from './elements';

import type { AuthorSpaceOptions, SpaceSpec } from '../types';
import type { WrittenPosition } from '../writtenAt';
import type { Element } from '@plitzi/sdk-shared';

/** One element of the space, and the call in the author's code that wrote it. */
export interface WrittenElement {
  elementId: string;
  type: string;
  /** The page, layout or component it is in. */
  rootId: string;
  /** The classes it wears, by name. */
  classes: string[];
  /** Its own words, when it has some. */
  content?: string;
  /** The templates its bindings compute an attribute with — where the words it shows live when they are not its own. */
  templates: string[];
  /**
   * Every word it says to a person, read or heard: its `content`, `label`, `title`, `alt` and `placeholder`, the
   * templates its bindings write, and — an instance of a component — the words it hands the component. What
   * `plitzi element where` finds an element by when it is asked for words.
   */
  words: string[];
  /** Its attributes as authored. */
  attributes: Record<string, unknown>;
  /** The elements it holds, in their order. */
  children: string[];
  /** It has no box on a page — a provider with no tag, a plugin's that draws nothing: only its children are seen. */
  boxless?: true;
  /** The other elements its flows act on, each with the step that does: what taking one of them away would break. */
  targets: { elementId: string; step: string }[];
  /** The attributes its bindings compute: what the page shows of them is the binding's, never the value written. */
  bound: string[];
  /** Where it was written: `src/space/pages/home.ts:42`. Absent for an element no call of the author's code wrote. */
  at?: string;
  /** The same place exactly — the factory's name, at its line and column — which is what an edit is made at. */
  position?: WrittenPosition;
  /**
   * The calls of the author's code that led to `position`, the nearest first: a helper written once and called for
   * each element (`pageHead('about-head', …)`) is told apart by them.
   */
  through: WrittenPosition[];
}

/** The attributes that are words a person reads or hears, whatever the element. */
const SAID_ATTRIBUTES = new Set(['content', 'label', 'title', 'alt', 'placeholder']);

/** What places a component, never what it hands it: the rest of an instance's attributes are the component's props. */
const PLACING_ATTRIBUTES = new Set(['referenceType', 'referenceId', 'slot']);

/** Every string a list's data holds, a few levels deep: the words its rows show come from there. */
const dataWords = (value: unknown, depth = 0): string[] => {
  if (depth > 4) {
    return [];
  }

  if (typeof value === 'string') {
    return value === '' ? [] : [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => dataWords(item, depth + 1));
  }

  return isRecord(value) ? Object.values(value).flatMap(item => dataWords(item, depth + 1)) : [];
};

const wordsOf = (element: Element, templates: readonly string[]): string[] => {
  const instance = element.definition.type === 'reference' && element.attributes.referenceType === 'component';

  return [
    ...Object.entries(element.attributes).flatMap(([key, value]) =>
      typeof value === 'string' &&
      value !== '' &&
      (SAID_ATTRIBUTES.has(key) || (instance && !PLACING_ATTRIBUTES.has(key)))
        ? [value]
        : []
    ),
    ...templates,
    // A list handed its rows as data (`items: [...PLANS]`): what each row shows is in them.
    ...dataWords(element.attributes.items)
  ];
};

/**
 * Every element the space authors to, with where it was written — read from the code as it is NOW, so it follows an
 * element wherever a person moved it, with nothing kept that could fall out of step. What `plitzi element where` answers.
 */
export const locateElements = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): WrittenElement[] => {
  const author = new SpaceAuthor(spec, options);
  const { schema } = author.write();

  // A component's own tree is a document of its own: its parts are written by the project's code like any other, and
  // are in the component — their `rootId` is its root element's, which nobody names.
  const elements = [
    ...Object.values(schema.flat).map(element => ({ element, rootId: element.definition.rootId })),
    ...Object.entries(schema.components).flatMap(([componentId, component]) =>
      Object.values(component.flat).map(element => ({ element, rootId: componentId }))
    )
  ];

  return elements.map(({ element, rootId }) => {
    const written = author.specOf(element.id);
    const calls = written ? writtenCalls(written) : [];
    const position = calls.at(0);
    const content = element.attributes.content;
    const templates = Object.values(element.definition.bindings ?? {}).flatMap(bindings =>
      bindings.flatMap(binding =>
        (binding.transformers ?? []).flatMap(transformer =>
          Object.values(transformer.params).filter((param): param is string => typeof param === 'string')
        )
      )
    );

    return {
      elementId: element.id,
      type: element.definition.type,
      rootId,
      classes: element.definition.styleSelectors.base.split(/\s+/).filter(Boolean),
      ...(typeof content === 'string' && content !== '' ? { content } : {}),
      templates,
      words: wordsOf(element, templates),
      attributes: element.attributes,
      children: element.definition.items ?? [],
      ...(isBoxless(author, element) ? { boxless: true as const } : {}),
      targets: Object.values(element.definition.interactions ?? {}).flatMap(node =>
        node.type === 'callback' && node.elementId !== null && node.elementId !== element.id
          ? [{ elementId: node.elementId, step: node.action }]
          : []
      ),
      bound: (element.definition.bindings?.attributes ?? []).map(binding => binding.to),
      through: calls.slice(1),
      ...(position ? { at: `${position.file}:${String(position.line)}`, position } : {})
    };
  });
};

/** One class of the space, and where the author's code declares it. */
export interface WrittenClass {
  name: string;
  /** Where it was declared: `src/space/styles.ts:118`. Absent for one no `styles()` call wrote (a space-wide object). */
  at?: string;
  position?: WrittenPosition;
}

/**
 * Every class the space declares, with the `styles()` call that wrote it — read from the code as it is now, as
 * `locateElements` reads the elements. What `plitzi element where` answers of a class: who wears it, and where it is written.
 */
export const locateClasses = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): WrittenClass[] => {
  const author = new SpaceAuthor(spec, options);
  author.write();

  return author.declaredClasses().map(([name, declaration]) => {
    const position = declaration ? writtenAtPosition(declaration) : undefined;

    return { name, ...(position ? { at: `${position.file}:${String(position.line)}`, position } : {}) };
  });
};
