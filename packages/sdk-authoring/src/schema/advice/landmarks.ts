import { walkDrawn } from './drawn';
import { isOpaque } from '../lint/accessibility';

import type { Suggestion } from './types';
import type { Element, Schema } from '@plitzi/sdk-shared';

/** Drawn as `main`: a container, a provider — whatever element takes its tag from `subType`. */
const isMain = (element: Element): boolean => element.attributes.subType === 'main';

/** A component an instance draws, when the element is one: its own tree, which the page's `flat` does not hold. */
const componentOf = (schema: Schema, element: Element) =>
  element.definition.type === 'reference' && element.attributes.referenceType === 'component'
    ? schema.components[String(element.attributes.referenceId)]
    : undefined;

/** What a page draws, read for a `main`: found, none — or nothing to say, when part of it is markup the linter cannot read. */
const mainOf = (schema: Schema, pageId: string): 'found' | 'none' | 'unreadable' => {
  const read = { found: false, unreadable: false };
  walkDrawn(schema.flat, pageId, true, element => {
    const component = componentOf(schema, element);
    const drawn = component ? Object.values(component.flat) : [element];
    read.found ||= drawn.some(isMain);
    read.unreadable ||= drawn.some(each => isOpaque(each.definition.type) && !componentOf(schema, each));

    return true;
  });

  if (read.found) {
    return 'found';
  }

  return read.unreadable ? 'unreadable' : 'none';
};

/**
 * A page that draws no `main` — neither it nor its layouts: the landmark a screen reader's "skip to the content" and a
 * browser agent go to, where the page's own content starts after the bar and the menus. Nothing is wrong with what is
 * drawn, and it renders as written: the landmark is offered, as every suggestion is. A page with markup the linter cannot
 * read (raw HTML, a plugin's element) is not judged — it may well hold one.
 */
export const suggestMain = (schema: Schema): Suggestion[] =>
  schema.pages.flatMap(pageId =>
    mainOf(schema, pageId) === 'none'
      ? [
          {
            code: 'page-without-main' as const,
            elementIds: [pageId],
            saves: 0,
            message: `The page "${pageId}" draws no \`main\`, nor do its layouts: a screen reader's jump to the content and a browser agent find no place where the page's own content starts. Draw the container that holds it as one — \`container({ subType: 'main', children })\`, in the layout's slot when every page of it shares the shell, once a page.`
          }
        ]
      : []
  );
