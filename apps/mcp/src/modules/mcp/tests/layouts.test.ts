import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply, search } from '../tools';

import type { Space } from '../helpers';
import type { AILayoutSummary, AIPageSkeleton, AIPageSummary } from '../types';

/**
 * The shared layout: the chrome a page is rendered inside rather than the elements it contains.
 *
 * It is the one part of a space the tools could not see at all. A layout shell is a root nobody owns and that no
 * page holds, so every walk that started from the pages missed it: its elements belonged to no `pageRef`, search
 * reported them as 'unknown', and an op naming the shell was refused as "page does not exist". An agent asked to
 * put something in the sidebar could read the page, find no sidebar, and had nothing left to try.
 */

/** A space whose two pages share one shell: sidebar + a slot each page's body is rendered into. */
const withLayout = async (): Promise<Space> => {
  const cap = capturing(buildSpace());
  const res = await apply(
    {
      operations: [
        { type: 'upsertLayout', ref: 'main-layout', label: 'Main layout' },
        {
          type: 'upsertElement',
          pageRef: 'main-layout',
          element: {
            ref: 'shell',
            type: 'container',
            children: [
              { ref: 'sidebar', type: 'container', children: [{ ref: 'nav-home', type: 'link' }] },
              { ref: 'page-slot', type: 'container' }
            ]
          }
        },
        { type: 'upsertPage', ref: 'home', layout: 'main-layout', layoutContainer: 'page-slot' },
        { type: 'upsertPage', ref: 'pricing', slug: 'pricing', layout: 'main-layout', layoutContainer: 'page-slot' }
      ]
    },
    buildSpace(),
    cap.persisters
  );

  expect(res.applied, JSON.stringify(res.errors)).toBe(true);

  return cap.saved();
};

describe('mcp-ai shared layouts', () => {
  it('lists the shells and the pages rendered inside each', async () => {
    const space = await withLayout();
    const layouts = readResource(space, 'main', 'plitzi://schema/main/layouts')?.data as AILayoutSummary[];

    expect(layouts).toHaveLength(1);
    expect(layouts[0]).toMatchObject({
      ref: 'main-layout',
      label: 'Main layout',
      usedBy: ['home', 'pricing'],
      slots: ['page-slot']
    });
    // The shell's own tree, not the pages': container + sidebar + link + slot.
    expect(layouts[0].elementCount).toBe(4);
  });

  it('names the shell on the page that renders inside it', async () => {
    const space = await withLayout();
    const pages = readResource(space, 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[];

    expect(pages.find(page => page.ref === 'pricing')).toMatchObject({
      layout: 'main-layout',
      layoutSlot: 'page-slot'
    });
  });

  it('reads a shell as a page does — same URI, same skeleton', async () => {
    const space = await withLayout();
    const shell = readResource(space, 'main', 'plitzi://schema/main/pages/main-layout')?.data as AIPageSkeleton;

    expect(shell.ref).toBe('main-layout');
    expect(JSON.stringify(shell)).toContain('sidebar');
  });

  it('edits the chrome through the shell, and every page sees it', async () => {
    const cap = capturing(await withLayout());
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'main-layout',
            parentRef: 'sidebar',
            element: { ref: 'upgrade-card', type: 'container', children: [{ ref: 'upgrade-copy', type: 'text' }] }
          }
        ]
      },
      await withLayout(),
      cap.persisters
    );

    expect(res.applied, JSON.stringify(res.errors)).toBe(true);
    const shell = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/main-layout')?.data as AIPageSkeleton;
    expect(JSON.stringify(shell)).toContain('upgrade-card');
  });

  it('reports a layout element under the layout, not as belonging to nothing', async () => {
    const space = await withLayout();
    const hits = search({ query: 'sidebar' }, space, 'main');

    expect(hits.results.some(hit => hit.ref === 'sidebar' && hit.pageRef === 'main-layout')).toBe(true);
  });

  it('refuses a slot that is not part of the shell it is meant to be in', async () => {
    const cap = capturing(await withLayout());
    // `c1` is an element of the `home` PAGE, not of the shell. Stored, the page body would be rendered into a
    // container the shell never shows — an empty page with working chrome, and nothing to explain it.
    const res = await apply(
      { operations: [{ type: 'upsertPage', ref: 'home', layout: 'main-layout', layoutContainer: 'c1' }] },
      await withLayout(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('is not an element of layout "main-layout"');
  });

  it('detaches a page from its shell', async () => {
    const cap = capturing(await withLayout());
    await apply(
      { operations: [{ type: 'upsertPage', ref: 'home', layout: null }] },
      await withLayout(),
      cap.persisters
    );
    const pages = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[];

    expect(pages.find(page => page.ref === 'home')?.layout).toBeUndefined();
  });

  it('refuses to delete a shell that pages still render inside, and names them', async () => {
    const cap = capturing(await withLayout());
    const res = await apply(
      { operations: [{ type: 'deleteLayout', ref: 'main-layout' }] },
      await withLayout(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    // Deleted anyway, those pages would render with no chrome and nothing in the document saying why.
    expect(res.errors?.[0].message).toContain('home, pricing');
  });

  it('deletes a shell once nothing renders inside it', async () => {
    const cap = capturing(await withLayout());
    const res = await apply(
      {
        operations: [
          { type: 'upsertPage', ref: 'home', layout: null },
          { type: 'upsertPage', ref: 'pricing', layout: null },
          { type: 'deleteLayout', ref: 'main-layout' }
        ]
      },
      await withLayout(),
      cap.persisters
    );

    expect(res.applied, JSON.stringify(res.errors)).toBe(true);
    const layouts = readResource(cap.saved(), 'main', 'plitzi://schema/main/layouts')?.data as AILayoutSummary[];
    expect(layouts).toEqual([]);
    // The chrome went with it, rather than being left behind with nothing to hang off.
    expect(readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/main-layout')).toBeNull();
  });

  it('refuses a page pointed at a shell that does not exist', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'upsertPage', ref: 'home', layout: 'nope' }] },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(res.errors?.[0]).toMatchObject({ path: 'operations[0].layout' });
    expect(res.errors?.[0].message).toContain('Layout "nope" not found');
  });
});
