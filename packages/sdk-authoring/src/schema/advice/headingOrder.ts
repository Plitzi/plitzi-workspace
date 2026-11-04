import { markdownHeadings, resolveLayoutChain } from '@plitzi/sdk-shared/schema';

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
 * A page's headings in the order a visitor meets them: its shells' — the outermost first — with the page inside the
 * container each one takes it in, after what that container holds of its own, as the page is drawn. The shells are part
 * of the page's outline as a browser builds it: a header's `h1` above a page whose first heading is an `h3` skips two.
 *
 * Read off what the document says: a `heading`, a container drawn as one, and the headings of a `markdown` whose text is
 * written out (one bound to data says nothing here). A decorative container is skipped with what it holds: assistive
 * technology is told to.
 */
const outlineOf = (flat: Schema['flat'], pageId: string): OutlineHeading[] => {
  const page = flat[pageId] as Element | undefined;
  if (!page) {
    return [];
  }

  // Innermost first: what each shell takes in its container is the next one in, and the last one takes the page.
  const shells = resolveLayoutChain(
    id => flat[id],
    textOf(page.attributes.layout),
    textOf(page.attributes.layoutContainer)
  );
  const inside = new Map<string, string>();
  shells.forEach((link, index) => inside.set(link.slot, index === 0 ? pageId : shells[index - 1].layout));

  const outline: OutlineHeading[] = [];
  const seen = new Set<string>();
  const walk = (id: string, hiddenBy: string | undefined): void => {
    const element = flat[id] as Element | undefined;
    if (!element || seen.has(id)) {
      return;
    }

    seen.add(id);
    if (element.definition.type === 'container' && element.attributes.decorative === true) {
      return;
    }

    const hidden = hiddenBy ?? (startsHidden(element) ? id : undefined);
    const level = headingLevel(element);
    if (level !== undefined) {
      outline.push({ id, level, hiddenBy: hidden });
    }

    const { content } = element.attributes;
    if (
      element.definition.type === 'markdown' &&
      typeof content === 'string' &&
      !boundAttributes(element).has('content')
    ) {
      markdownHeadings(content).forEach(heading =>
        outline.push({ id, level: heading.level, text: heading.text, hiddenBy: hidden })
      );
    }

    (element.definition.items ?? []).forEach(item => walk(item, hidden));
    const body = inside.get(id);
    if (body !== undefined) {
      walk(body, hidden);
    }
  };
  walk(shells.length > 0 ? shells[shells.length - 1].layout : pageId, undefined);

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
