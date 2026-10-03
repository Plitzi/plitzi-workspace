import { rendersNoTag } from '@plitzi/sdk-schema/helpers/styleWithoutTag';
import { getPageFullPath } from '@plitzi/sdk-shared/navigation';
import { isAnchor } from '@plitzi/sdk-shared/schema/anchor';
import { resolveLayoutChain } from '@plitzi/sdk-shared/schema/layoutChain';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/** The element types that render their children once per row, so an `id` inside them would repeat in the DOM. */
const REPEATERS = new Set(['list']);

const FORMAT = 'lowercase letters, digits and "-", starting with a letter';

/** The anchor someone probably meant: the same words, in the form an anchor takes. */
const asAnchor = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^[^a-z]+|-+$/g, '') || 'section';

const attributeText = (element: Element, key: string): string => {
  const value: unknown = element.attributes[key];

  return typeof value === 'string' ? value : '';
};

/** Every anchor a rendered page carries — its own tree and the layouts around it — with the elements that carry it. */
const anchorsOfPage = (ctx: LintContext, pageId: string): Map<string, string[]> => {
  const page = ctx.element(pageId);
  const chain = page
    ? resolveLayoutChain(id => ctx.element(id), attributeText(page, 'layout'), attributeText(page, 'layoutContainer'))
    : [];
  const roots = new Set([pageId, ...chain.map(link => link.layout)]);
  const anchors = new Map<string, string[]>();
  Object.values(ctx.flat).forEach(element => {
    const { anchor } = element.definition;
    if (anchor && roots.has(element.definition.rootId)) {
      anchors.set(anchor, [...(anchors.get(anchor) ?? []), element.id]);
    }
  });

  return anchors;
};

/** One element's own anchor: well formed, on something that renders, and rendered once. */
const lintOwnAnchor = (ctx: LintContext, element: Element, anchor: string): void => {
  const where = ctx.describe(element.id);
  if (!isAnchor(anchor)) {
    ctx.error(
      'anchor-invalid',
      `${where} has the anchor ${JSON.stringify(anchor)}. An anchor is the element's id in the URL (\`/page#anchor\`): ${FORMAT} — "${asAnchor(anchor)}".`,
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

  const repeater = [...ctx.ancestors(element.id)].find(id => REPEATERS.has(ctx.element(id)?.definition.type ?? ''));
  if (repeater) {
    ctx.error(
      'anchor-repeated',
      `${where} has the anchor "${anchor}" inside the list "${repeater}", which renders it once per row — the same id would be in the page as many times. Put the anchor on the list itself, or on the element around it.`,
      element.id
    );
  }
};

/** A link to a section: a well-formed anchor that the page it goes to carries. */
const lintLinkHash = (
  ctx: LintContext,
  link: Element,
  anchorsByPage: (pageId: string) => Map<string, string[]>
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

  const anchors = anchorsByPage(pageId);
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
export const lintAnchors = (ctx: LintContext): void => {
  Object.values(ctx.flat).forEach(element => {
    const { anchor } = element.definition;
    if (anchor !== undefined) {
      lintOwnAnchor(ctx, element, anchor);
    }
  });

  if (ctx.component) {
    return;
  }

  const byPage = new Map<string, Map<string, string[]>>();
  const anchorsByPage = (pageId: string): Map<string, string[]> => {
    const known = byPage.get(pageId);
    if (known) {
      return known;
    }

    const anchors = anchorsOfPage(ctx, pageId);
    byPage.set(pageId, anchors);

    return anchors;
  };

  const told = new Set<string>();
  ctx.pageIds.forEach(pageId => {
    anchorsByPage(pageId).forEach((ids, anchor) => {
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
