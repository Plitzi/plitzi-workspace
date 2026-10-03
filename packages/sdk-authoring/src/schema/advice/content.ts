/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import type { Suggestion } from './types';
import type { Schema } from '@plitzi/sdk-shared';

/** The elements that draw words of their own: a child that is only those words is an element more than needed. */
const WITH_CONTENT = new Set(['button', 'link']);

/**
 * A button or a link holding one `text` and nothing else — the commonest element spent for nothing. Its words are
 * its own `content`; only a text that does something of its own (a binding, a flow, a condition) is left alone, since
 * that would not move with the words.
 */
export const suggestContent = (schema: Schema): Suggestion[] => {
  const { flat } = schema;
  const found: { id: string; textClass: string }[] = [];
  for (const [id, element] of Object.entries(flat)) {
    const items = element.definition.items ?? [];
    if (!WITH_CONTENT.has(element.definition.type) || items.length !== 1) {
      continue;
    }

    const child = flat[items[0]];
    const { definition } = child;
    const busy =
      Object.values(definition.bindings ?? {}).some(list => list.length > 0) ||
      Object.keys(definition.interactions ?? {}).length > 0 ||
      definition.initialState?.visibility === false ||
      (definition.items?.length ?? 0) > 0;
    if (definition.type === 'text' && !busy) {
      found.push({ id, textClass: definition.styleSelectors.base.trim() });
    }
  }

  if (found.length === 0) {
    return [];
  }

  const classed = found.filter(entry => entry.textClass);
  const example = found[0].id;

  return [
    {
      code: 'content-attribute',
      elementIds: found.map(entry => entry.id),
      saves: found.length,
      message:
        `${String(found.length)} button${found.length === 1 ? '' : 's'} or link${found.length === 1 ? '' : 's'} ` +
        `hold one text and nothing else ("${example}"${found.length > 1 ? ' and the rest' : ''}): the words are ` +
        "their own `content` — `button({ content: 'Save' })`, `link({ href: '/pricing', content: 'Pricing' })` — " +
        `one element each instead of two.${
          classed.length > 0
            ? ` Where the text wears a class (${String(classed.length)} of them), add that class to the button or ` +
              'link: `class: [button, label]`.'
            : ''
        }`
    }
  ];
};
