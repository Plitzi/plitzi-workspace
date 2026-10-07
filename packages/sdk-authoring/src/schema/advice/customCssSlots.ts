/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import { HTML_TAG_PARTS } from '@plitzi/sdk-elements/elements/basic/RichText/classHtmlParts';

import { stateAndPseudoOf } from '../../decompile/customCss';

import type { Suggestion } from './types';
import type { Schema } from '@plitzi/sdk-shared';

type PartSlot = { type: string; slot: string };

/** The class names the SDK gives the parts of its elements that a slot of the element reaches. */
const PART_CLASSES: Readonly<Record<string, PartSlot>> = {
  'input-container__input': { type: 'formControl', slot: 'field' },
  'select-container__select': { type: 'formControl', slot: 'field' },
  'form-input__icon': { type: 'formControl', slot: 'icon' },
  'form-control__label--required': { type: 'formControl', slot: 'requiredMark' },
  'plitzi-component__pagination-page': { type: 'pagination', slot: 'page' },
  'plitzi-component__pagination-page--current': { type: 'pagination', slot: 'page' },
  'plitzi-component__pagination-prev': { type: 'pagination', slot: 'previous' },
  'plitzi-component__pagination-next': { type: 'pagination', slot: 'next' },
  'plitzi-component__pagination-more': { type: 'pagination', slot: 'loadMore' },
  'markdown-code': { type: 'markdown', slot: 'codeBlockFrame' },
  'markdown-code-header': { type: 'markdown', slot: 'codeBlockHeader' },
  'markdown-code-language': { type: 'markdown', slot: 'codeBlockLanguage' },
  'markdown-code-copy': { type: 'markdown', slot: 'codeBlockCopy' }
};

/** The elements whose document is written as tags, each of which is a part with a slot of its own. */
const DOCUMENT_TYPES = new Set(['markdown', 'richText']);

const COMMENT = /\/\*[\s\S]*?\*\//g;

/** What comes before a `{`: a rule's selectors, or an at-rule's prelude, which names no class and so matches nothing. */
const PRELUDE = /([^{};]+)\{/g;

const CLASS = /\.(-?[_a-zA-Z][\w-]*)/g;

/** A class, then — inside it or right under it — the tag that opens the selector's next step: `.prose h2`, `.doc > p`. */
const CLASS_THEN_TAG = /^\.([\w-]+)\s*>?\s*([a-z][a-z0-9]*)(?![\w-])/;

/** The classes the document elements wear, by the type that wears them — `.prose` on a markdown. */
const documentClasses = (schema: Schema): Map<string, string> => {
  const classes = new Map<string, string>([['markdown', 'markdown']]);
  for (const flat of [schema.flat, ...Object.values(schema.components).map(component => component.flat)]) {
    for (const element of Object.values(flat)) {
      const { type, styleSelectors } = element.definition;
      if (DOCUMENT_TYPES.has(type)) {
        styleSelectors.base
          .split(/\s+/)
          .filter(Boolean)
          .forEach(name => classes.set(name, type));
      }
    }
  }

  return classes;
};

/**
 * The slot a selector dresses by the SDK's names, when it does and the slot's class can say the rest: its part's
 * class, or a tag inside a document — then nothing more, a state of it or a pseudo-element of it (`:hover`,
 * `::placeholder`). `.prose > p:first-of-type` and `.prose pre code` say what no class on the slot can.
 */
const slotOf = (selector: string, documents: Map<string, string>): PartSlot | undefined => {
  for (const match of selector.matchAll(CLASS)) {
    const name = match[1];
    if (Object.hasOwn(PART_CLASSES, name)) {
      return stateAndPseudoOf(selector.slice(match.index + match[0].length)) ? PART_CLASSES[name] : undefined;
    }
  }

  const match = CLASS_THEN_TAG.exec(selector);
  if (!match || !stateAndPseudoOf(selector.slice(match[0].length))) {
    return undefined;
  }

  const [, name, tag] = match;
  const type = documents.get(name);
  const parts = Object.hasOwn(HTML_TAG_PARTS, tag) ? HTML_TAG_PARTS[tag] : undefined;

  return type && parts?.length ? { type, slot: parts[parts.length - 1] } : undefined;
};

/**
 * A part of a built-in element dressed in `customCss` by the names the SDK renders it with — the `<input>` inside a
 * form control's box, a pager's buttons, the headings of a markdown under the class it wears — where the element has
 * a slot for that part. On the slot the rule is a class the style editor shows and a breakpoint can change, and it
 * goes on being right when the SDK's markup changes, which a rule on its class names does not.
 */
export const suggestCustomCssSlots = (schema: Schema): Suggestion[] => {
  const customCss = schema.settings.customCss.replace(COMMENT, '');
  if (!customCss.trim()) {
    return [];
  }

  const documents = documentClasses(schema);
  const found = new Map<string, string>();
  for (const [, prelude] of customCss.matchAll(PRELUDE)) {
    for (const selector of prelude.split(',').map(part => part.trim())) {
      const part = selector.startsWith('@') ? undefined : slotOf(selector, documents);
      if (part && !found.has(selector)) {
        found.set(selector, `\`${selector}\` (a ${part.type}'s \`${part.slot}\`)`);
      }
    }
  }

  if (found.size === 0) {
    return [];
  }

  const parts = [...found.values()];

  return [
    {
      code: 'custom-css-slot',
      elementIds: [],
      saves: 0,
      message:
        `\`customCss\` dresses parts of built-in elements by the SDK's own markup: ${parts.slice(0, 4).join(', ')}` +
        `${parts.length > 4 ? ', …' : ''}. Each is a slot of its element: give it a class there — ` +
        '`slots: { field: input }` on the element, `elements.formControl.slots` for every one of a type — and write ' +
        "its hover, its `current` page or its `disabled` button as the class's `states`. `plitzi explain <type>` " +
        'lists the slots.'
    }
  ];
};
