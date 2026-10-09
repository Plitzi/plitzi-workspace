/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { Suggestion } from './types';
import type { Style } from '@plitzi/sdk-shared';

/** The types the SDK gives no colour of their own: whatever they hold reads in the colour of the page around them. */
const INHERITING = new Set(['text', 'heading', 'paragraph', 'fontAwesome', 'link', 'list', 'listItem', 'container']);

/** An element type's own colour, as the space writes it for the type — at the widest breakpoint, before any state. */
const colourOf = (style: Style, type: string): unknown => {
  if (!Object.hasOwn(style.platform.desktop, type)) {
    return undefined;
  }

  const item = style.platform.desktop[type];
  if (item.type !== 'element' || !isRecord(item.attributes.base)) {
    return undefined;
  }

  const rules = item.attributes.base.default;

  return isRecord(rules) ? rules.color : undefined;
};

/**
 * `elements` giving a type the colour it already takes: `inherit`, or the very colour the page has. Every element of
 * these types reads in the page's colour by itself — a link's words included — so the rule says nothing, and a reader
 * takes it for a choice. A theme's colour named once on the page is what follows the scheme.
 */
export const suggestElementColours = (style: Style): Suggestion[] => {
  const page = colourOf(style, 'page');
  const restated = [...INHERITING].filter(type => {
    const colour = colourOf(style, type);

    return colour === 'inherit' || (colour !== undefined && colour === page);
  });

  return restated.length === 0
    ? []
    : [
        {
          code: 'element-color-inherited',
          elementIds: [],
          saves: 0,
          subjects: restated,
          message:
            `\`elements\` gives ${restated.map(type => `\`${type}\``).join(', ')} the colour ${restated.length === 1 ? 'it takes' : 'they take'} ` +
            "from the page anyway. Remove it: every element reads in the page's colour by itself, a link's words " +
            'included — name the colour once, on `elements.page`.'
        }
      ];
};
