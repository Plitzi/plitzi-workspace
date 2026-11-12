import { markdownHeadings } from '@plitzi/sdk-shared/schema';

import { walkDrawn } from './drawn';

import type { Suggestion } from './types';
import type { Element, Schema } from '@plitzi/sdk-shared';

/** A heading of a page as it is drawn: where it comes from, its level, and what hides it until something shows it. */
type OutlineHeading = {
  id: string;
  level: number;
  /** The words of a heading a `markdown` draws: one element holds several. */
  text?: string;
  hiddenBy: string | undefined;
};

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

const boundAttributes = (element: Element): Set<string> =>
  new Set(Object.values(element.definition.bindings ?? {}).flatMap(list => list.map(binding => binding.to)));

/** The level a `heading` (an `h1` unless it says) or a container drawn as one renders. */
const headingLevel = (element: Element): number | undefined => {
  const { type } = element.definition;
  if (type !== 'heading' && type !== 'container') {
    return undefined;
  }

  const tag = textOf(element.attributes.subType) || (type === 'heading' ? 'h1' : 'div');

  return HEADING_TAGS.has(tag) ? Number(tag.slice(1)) : undefined;
};

/** What starts hidden: `visible: false`, shown later by a binding or a flow — and so is everything inside it. */
const startsHidden = (element: Element): boolean => element.definition.initialState?.visibility === false;

/**
 * A page's headings in the order a visitor meets them, as the page is drawn inside its shells (`walkDrawn`): a header's
 * `h1` above a page whose first heading is an `h3` skips two.
 *
 * Read off what the document says: a `heading`, a container drawn as one, and the headings of a `markdown` whose text is
 * written out (one bound to data says nothing here). A decorative container is skipped with what it holds: assistive
 * technology is told to.
 */
const outlineOf = (flat: Schema['flat'], pageId: string): OutlineHeading[] => {
  const outline: OutlineHeading[] = [];
  walkDrawn<{ hiddenBy: string | undefined }>(flat, pageId, { hiddenBy: undefined }, (element, { hiddenBy }) => {
    if (element.definition.type === 'container' && element.attributes.decorative === true) {
      return undefined;
    }

    const hidden = hiddenBy ?? (startsHidden(element) ? element.id : undefined);
    const level = headingLevel(element);
    if (level !== undefined) {
      outline.push({ id: element.id, level, hiddenBy: hidden });
    }

    const { content } = element.attributes;
    if (
      element.definition.type === 'markdown' &&
      typeof content === 'string' &&
      !boundAttributes(element).has('content')
    ) {
      markdownHeadings(content).forEach(heading =>
        outline.push({ id: element.id, level: heading.level, text: heading.text, hiddenBy: hidden })
      );
    }

    return { hiddenBy: hidden };
  });

  return outline;
};

/** Each heading more than one level below the one before it, with the one before it. */
const skipsIn = (outline: OutlineHeading[]): { heading: OutlineHeading; previous: OutlineHeading }[] =>
  outline.flatMap((heading, index) =>
    index > 0 && heading.level > outline[index - 1].level + 1 ? [{ heading, previous: outline[index - 1] }] : []
  );

const named = (heading: OutlineHeading): string =>
  heading.text === undefined ? `"${heading.id}"` : `"${heading.id}"'s "${heading.text}"`;

/**
 * Headings that skip a level — an `h2` straight to an `h4`. Screen readers and browser agents read a page's outline from
 * its headings and jump between them by level, and a skipped one reads as a missing section; Lighthouse says it as
 * "Heading elements are not in a sequentially-descending order". Nothing is wrong with the elements, and the page
 * renders as written: a better outline is offered, as every suggestion is.
 *
 * Read as each page is drawn, its shells around it (`outlineOf`), and twice: with every heading, and with only those
 * that show as the page arrives — a heading hidden until its data says so (a checklist, a notice) is not there for
 * whoever reads the page before, nor for one whose data never shows it. Each element is offered once, however many
 * pages its shell wraps.
 */
export const suggestHeadingOrder = (schema: Schema): Suggestion[] => {
  const offered = new Map<string, Suggestion>();
  const offer = (heading: OutlineHeading, previous: OutlineHeading, message: string): void => {
    if (!offered.has(heading.id)) {
      offered.set(heading.id, {
        code: 'heading-level-skipped',
        elementIds: [heading.id, previous.id],
        saves: 0,
        message
      });
    }
  };

  for (const pageId of schema.pages) {
    const outline = outlineOf(schema.flat, pageId);
    const always = skipsIn(outline);
    always.forEach(({ heading, previous }) => {
      offer(
        heading,
        previous,
        `${named(heading)} is an h${String(heading.level)} right after ${named(previous)}, an h${String(previous.level)}, on the page "${pageId}" as it is drawn: its outline skips a level, and a screen reader or a browser agent reading it by headings finds a section missing. Make it an h${String(previous.level + 1)}, and size it with its class rather than its level.`
      );
    });

    const skippedAlways = new Set(always.map(({ heading }) => heading.id));
    skipsIn(outline.filter(heading => heading.hiddenBy === undefined)).forEach(({ heading, previous }) => {
      if (skippedAlways.has(heading.id)) {
        return;
      }

      const from = outline.indexOf(previous);
      const to = outline.indexOf(heading);
      const hiddenBy = outline.slice(from + 1, to).find(each => each.hiddenBy !== undefined)?.hiddenBy ?? '';
      offer(
        heading,
        previous,
        `${named(heading)} is an h${String(heading.level)} after ${named(previous)}, an h${String(previous.level)}, on the page "${pageId}" whenever "${hiddenBy}" is hidden: it starts hidden, and the heading between them is inside it, so the outline the page arrives with skips a level — and so does every visit it never shows for. Make it an h${String(previous.level + 1)}.`
      );
    });
  }

  return [...offered.values()];
};
