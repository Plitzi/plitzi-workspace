import { rendersNoTag } from '@plitzi/sdk-schema';
import { getPageFullPath } from '@plitzi/sdk-shared/navigation';
import { anchorOf, isAnchor, resolveLayoutChain, markdownHeadings } from '@plitzi/sdk-shared/schema';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/**
 * Whether an element is drawn in a list's rows — a list with `items`, which draws its row once per item: its anchor is
 * then each row's own, named after the row (`faq-answer-luna`), and no link can name one of them by its anchor.
 */
const inRows = (ctx: LintContext, id: string): boolean =>
  [...ctx.ancestors(id)].some(each => {
    const element = ctx.element(each);

    return element?.definition.type === 'list' && element.attributes.source === 'controlled';
  });

const FORMAT = 'lowercase letters, digits and "-", starting with a letter';

const attributeText = (element: Element, key: string): string => {
  const value: unknown = element.attributes[key];

  return typeof value === 'string' ? value : '';
};

/**
 * Every anchor a rendered page carries — its own tree and the layouts around it — with the elements that carry it: an
 * element's own `anchor`, and the `id` of every heading a Markdown element renders. One in a list's rows is not the
 * page's: each row's is its own (`rowAnchors`).
 */
const anchorsOfPage = (ctx: LintContext, pageId: string, rowAnchors?: Set<string>): Map<string, string[]> => {
  const page = ctx.element(pageId);
  const chain = page
    ? resolveLayoutChain(id => ctx.element(id), attributeText(page, 'layout'), attributeText(page, 'layoutContainer'))
    : [];
  const roots = new Set([pageId, ...chain.map(link => link.layout)]);
  const anchors = new Map<string, string[]>();
  Object.values(ctx.flat).forEach(element => {
    if (!roots.has(element.definition.rootId)) {
      return;
    }

    if (element.definition.anchor && inRows(ctx, element.id)) {
      rowAnchors?.add(element.definition.anchor);

      return;
    }

    const own = element.definition.anchor ? [element.definition.anchor] : [];
    const headings =
      element.definition.type === 'markdown'
        ? markdownHeadings(attributeText(element, 'content')).map(heading => heading.anchor)
        : [];
    [...own, ...headings].forEach(anchor => anchors.set(anchor, [...(anchors.get(anchor) ?? []), element.id]));
  });

  return anchors;
};

/** One element's own anchor: well formed, on something that renders, and rendered once. */
const lintOwnAnchor = (ctx: LintContext, element: Element, anchor: string): void => {
  const where = ctx.describe(element.id);
  if (!isAnchor(anchor)) {
    ctx.error(
      'anchor-invalid',
      `${where} has the anchor ${JSON.stringify(anchor)}. An anchor is the element's id in the URL (\`/page#anchor\`): ${FORMAT} — "${anchorOf(anchor)}".`,
      element.id
    );
  }

  if (rendersNoTag(element)) {
    ctx.error(
      'anchor-no-tag',
      `${where} has the anchor "${anchor}" but renders no element of its own (no \`subType\`), so there is nothing to scroll to. Put the anchor on the section it wraps, or give it a tag.`,
      element.id
    );
  }

  if (ctx.component) {
    ctx.error(
      'anchor-repeated',
      `${where} has the anchor "${anchor}", and a component renders its tree once per instance — two instances would put the same id in the page twice. Put the anchor on the element around the instance, on the page.`,
      element.id
    );

    return;
  }
};

/** A link to a section: a well-formed anchor that the page it goes to carries. */
const lintLinkHash = (
  ctx: LintContext,
  link: Element,
  anchorsByPage: (pageId: string) => { anchors: Map<string, string[]>; rows: Set<string> }
): void => {
  const hash = attributeText(link, 'hash');
  if (!hash || attributeText(link, 'mode') === 'external') {
    return;
  }

  const where = ctx.describe(link.id);
  if (!isAnchor(hash)) {
    ctx.error(
      'anchor-invalid',
      `${where} goes to the section ${JSON.stringify(hash)}: an anchor is ${FORMAT}, written without the "#".`,
      link.id
    );

    return;
  }

  if ((attributeText(link, 'mode') || 'page') !== 'page') {
    return;
  }

  // Resolved as the link resolves it: a page id or that page's path both name it.
  const { flat, schema } = ctx;
  const path = getPageFullPath(flat, schema.pageFolders, attributeText(link, 'href'), true);
  const pageId = [...ctx.pageIds].find(id => getPageFullPath(flat, schema.pageFolders, id, true) === path);
  if (!pageId) {
    return;
  }

  const { anchors, rows } = anchorsByPage(pageId);
  if (!anchors.has(hash) && rows.has(hash)) {
    ctx.error(
      'anchor-in-row',
      `${where} goes to "${pageId}#${hash}", an anchor a list draws in each of its rows — named after its row there (\`${hash}-<row>\`), so the link would land at the top. Link to the list's own anchor, or to one outside it.`,
      link.id
    );

    return;
  }

  if (!anchors.has(hash)) {
    const available = [...anchors.keys()];
    ctx.error(
      'anchor-missing',
      `${where} goes to "${pageId}#${hash}", and nothing on that page or its layouts has the anchor "${hash}", so it would land at the top. ${
        available.length > 0
          ? `Anchors there: ${available.map(name => `"${name}"`).join(', ')}.`
          : `That page has no anchors yet: give the section \`anchor: '${hash}'\`.`
      }`,
      link.id
    );
  }
};

/**
 * Anchors: the `id` an element carries in the DOM, so a URL fragment lands on it. One per rendered page — the page's
 * tree and every layout around it, which render as one document — on an element that renders, never repeated by a list
 * or a component, and every link to a section naming one that is there.
 */
/**
 * A button's `controls` is `aria-controls`: an id the DOM carries, which on a page is an anchor. One naming no anchor
 * points a screen reader at nothing — authoring resolves an element's id to its anchor, a hand-written document does
 * not.
 */
const lintControls = (ctx: LintContext): void => {
  const anchors = new Set(Object.values(ctx.flat).flatMap(element => element.definition.anchor ?? []));
  Object.values(ctx.flat).forEach(element => {
    const controls = attributeText(element, 'controls');
    if (element.definition.type !== 'button' || controls === '' || anchors.has(controls)) {
      return;
    }

    ctx.warn(
      'controls-no-anchor',
      `${ctx.describe(element.id)} controls "${controls}", and no element carries that anchor, so a screen reader is pointed at nothing. Give the element it shows and hides \`anchor: '${anchorOf(controls)}'\` and name that.`,
      element.id
    );
  });
};

export const lintAnchors = (ctx: LintContext): void => {
  Object.values(ctx.flat).forEach(element => {
    const { anchor } = element.definition;
    if (anchor !== undefined) {
      lintOwnAnchor(ctx, element, anchor);
    }
  });
  lintControls(ctx);

  if (ctx.component) {
    return;
  }

  const byPage = new Map<string, { anchors: Map<string, string[]>; rows: Set<string> }>();
  const anchorsByPage = (pageId: string): { anchors: Map<string, string[]>; rows: Set<string> } => {
    const known = byPage.get(pageId);
    if (known) {
      return known;
    }

    const rows = new Set<string>();
    const found = { anchors: anchorsOfPage(ctx, pageId, rows), rows };
    byPage.set(pageId, found);

    return found;
  };

  const told = new Set<string>();
  ctx.pageIds.forEach(pageId => {
    anchorsByPage(pageId).anchors.forEach((ids, anchor) => {
      const key = `${anchor}:${ids.join(',')}`;
      if (ids.length < 2 || told.has(key)) {
        return;
      }

      told.add(key);
      ctx.error(
        'anchor-duplicate',
        `The anchor "${anchor}" is on ${ids.map(id => ctx.describe(id)).join(' and ')}, which render on the same page — a URL fragment can land on only one. Rename all but one.`,
        ids[1]
      );
    });
  });

  Object.values(ctx.flat)
    .filter(element => element.definition.type === 'link')
    .forEach(link => lintLinkHash(ctx, link, anchorsByPage));
};
