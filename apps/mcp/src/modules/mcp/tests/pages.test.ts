import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply, validate } from '../tools';

import type { Space } from '../helpers';
import type { AIFolder, AIPageSkeleton, AIPageSummary } from '../types';

describe('mcp-ai settings (space-level customCss + auth config)', () => {
  it('patchSettings merges customCss without dropping other settings', async () => {
    const cap = capturing(buildSpace());
    const css = '@keyframes spin { to { transform: rotate(360deg); } }';
    const res = await apply({ operations: [{ type: 'patchSettings', customCss: css }] }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    const settings = readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data as { customCss?: string };
    expect(settings.customCss).toBe(css);
  });

  it('a later patch preserves earlier keys (merge, not replace)', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'patchSettings', customCss: '.a{}' }] }, buildSpace(), cap.persisters);
    await apply({ operations: [{ type: 'patchSettings', keepState: true }] }, cap.saved(), cap.persisters);
    const settings = readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data as {
      customCss?: string;
      keepState?: boolean;
    };
    expect(settings.customCss).toBe('.a{}');
    expect(settings.keepState).toBe(true);
  });

  it('exposes settings in the cold-start primer', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'patchSettings', customCss: '.z{}' }] }, buildSpace(), cap.persisters);
    const primer = readResource(cap.saved(), 'main', 'plitzi://primer/main')?.data as {
      settings: { customCss?: string };
    };
    expect(primer.settings.customCss).toBe('.z{}');
  });
});

describe('mcp-ai page enable/disable (attributes.enabled)', () => {
  it('a new page defaults to enabled', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertPage', ref: 'about', label: 'About' }] }, buildSpace(), cap.persisters);
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/about')?.data as AIPageSkeleton;
    expect(page.enabled).toBe(true);
  });

  it('disables a page with enabled:false and re-enables it', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertPage', ref: 'home', enabled: false }] }, buildSpace(), cap.persisters);
    let home = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(home.enabled).toBe(false);
    const summary = (readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[]).find(
      p => p.ref === 'home'
    );
    expect(summary?.enabled).toBe(false);

    await apply({ operations: [{ type: 'upsertPage', ref: 'home', enabled: true }] }, cap.saved(), cap.persisters);
    home = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(home.enabled).toBe(true);
  });

  it('leaves enabled untouched when the field is omitted', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertPage', ref: 'home', enabled: false }] }, buildSpace(), cap.persisters);
    await apply({ operations: [{ type: 'upsertPage', ref: 'home', label: 'Renamed' }] }, cap.saved(), cap.persisters);
    const home = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(home.label).toBe('Renamed');
    expect(home.enabled).toBe(false);
  });
});

describe('mcp-ai page slug is relative (leading slash stripped)', () => {
  it('strips a leading slash so the slug persists relative on create', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'upsertPage', ref: 'pricing', label: 'Pricing', slug: '/pricing' }] },
      buildSpace(),
      cap.persisters
    );
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/pricing')?.data as AIPageSkeleton;
    expect(page.slug).toBe('pricing');
  });

  it('keeps a route-param slug intact while dropping the leading slash', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'upsertPage', ref: 'post-detail', label: 'Post', slug: '/posts/:postId' }] },
      buildSpace(),
      cap.persisters
    );
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/post-detail')?.data as AIPageSkeleton;
    expect(page.slug).toBe('posts/:postId');
    expect(page.routeParams).toEqual(['postId']);
  });
});

describe('mcp-ai patchElement (I3/R3 — partial merge)', () => {
  it('changes only the listed prop, preserving the rest', async () => {
    const space = buildSpace();
    (space.schema.flat.c1.attributes as Record<string, unknown>).extra = 'keep';
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { title: 'Renamed' } }] },
      space
    );
    const el = res.elements?.find(e => e.ref === 'c1');
    expect(el?.props).toEqual({ title: 'Renamed', extra: 'keep' });
  });

  it('unsets a prop when its value is null', async () => {
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { title: null } }] },
      buildSpace()
    );
    expect(res.elements?.find(e => e.ref === 'c1')?.props).toBeUndefined();
  });

  it('merges style.base without touching other selectors', async () => {
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', style: { base: ['box', 'extra'] } }] },
      buildSpace()
    );
    expect(res.elements?.find(e => e.ref === 'c1')?.style.base).toEqual(['box', 'extra']);
  });

  it('fails (does not create) when the element does not exist', async () => {
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'ghost', props: { x: 1 } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('not found');
  });
});

describe('mcp-ai page folders (create, nest, delete, move)', () => {
  it('creates a folder (ref becomes its id) and lists it, slug and all', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'upsertFolder', ref: 'blog', name: 'Blog' }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const folders = readResource(cap.saved(), 'main', 'plitzi://folders/main')?.data as AIFolder[];
    expect(folders).toEqual([{ ref: 'blog', name: 'Blog', slug: 'blog', parentId: undefined }]);
    const one = readResource(cap.saved(), 'main', 'plitzi://folders/main/blog')?.data as AIFolder;
    expect(one.name).toBe('Blog');
  });

  it('places a page in a folder (by its id) and reflects it in the page summary', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          { type: 'upsertFolder', ref: 'docs', name: 'Docs' },
          { type: 'upsertPage', ref: 'guide', label: 'Guide', folder: 'docs' }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    const pages = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[];
    expect(pages.find(p => p.ref === 'guide')?.folder).toBe('docs');
  });

  it('nests folders parent-before-child (valid ordering) and applies', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertFolder', ref: 'docs', name: 'Docs' },
          { type: 'upsertFolder', ref: 'guides', name: 'Guides', parentId: 'docs' }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const folders = readResource(cap.saved(), 'main', 'plitzi://folders/main')?.data as AIFolder[];
    expect(folders.map(f => f.ref)).toEqual(['docs', 'guides']);
    expect(folders[1].parentId).toBe('docs');
  });

  it('rejects a page joining a folder that does not exist', () => {
    const r = validate({ operations: [{ type: 'upsertPage', ref: 'x', folder: 'ghost' }] }, buildSpace());
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain('Folder "ghost" does not exist');
  });

  it('rejects nesting a folder under itself', () => {
    const r = validate({ operations: [{ type: 'upsertFolder', ref: 'blog', parentId: 'blog' }] }, buildSpace());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('cannot be nested under itself'))).toBe(true);
  });

  it('deleteFolder promotes child folders and pages up to the parent', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          { type: 'upsertFolder', ref: 'docs', name: 'Docs' },
          { type: 'upsertFolder', ref: 'guides', name: 'Guides', parentId: 'docs' },
          { type: 'upsertPage', ref: 'intro', label: 'Intro', folder: 'guides' }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    const afterCreate = cap.saved();
    const res = await apply({ operations: [{ type: 'deleteFolder', ref: 'guides' }] }, afterCreate, cap.persisters);
    expect(res.applied).toBe(true);
    const folders = readResource(cap.saved(), 'main', 'plitzi://folders/main')?.data as AIFolder[];
    expect(folders.map(f => f.ref)).toEqual(['docs']);
    const pages = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[];
    expect(pages.find(p => p.ref === 'intro')?.folder).toBe('docs');
  });

  it('resolves an existing folder ref by name and moves a page to the root with null', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertFolder', ref: 'blog', name: 'Blog' }] }, buildSpace(), cap.persisters);
    await apply({ operations: [{ type: 'upsertPage', ref: 'post', folder: 'Blog' }] }, cap.saved(), cap.persisters);
    expect(
      (readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[]).find(
        p => p.ref === 'post'
      )?.folder
    ).toBe('blog');

    await apply({ operations: [{ type: 'upsertPage', ref: 'post', folder: null }] }, cap.saved(), cap.persisters);
    expect(
      (readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[]).find(
        p => p.ref === 'post'
      )?.folder
    ).toBeUndefined();
  });
});

describe('mcp-ai page.folder is always "" (root) or a valid id', () => {
  const folderOf = (space: Space, ref: string): unknown =>
    Object.values(space.schema.flat).find(el => el.id === ref)?.attributes.folder;

  it('stores "" (not a missing key) for a new page with no folder', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertPage', ref: 'plain', label: 'Plain' }] }, buildSpace(), cap.persisters);
    expect(folderOf(cap.saved(), 'plain')).toBe('');
  });

  it('accepts an explicit empty-string folder as root (not a missing-folder error)', async () => {
    const res = await apply({ operations: [{ type: 'upsertPage', ref: 'p', label: 'P', folder: '' }] }, buildSpace());
    expect(res.applied).toBe(true);
    expect(validate({ operations: [{ type: 'upsertPage', ref: 'p', folder: '' }] }, buildSpace()).valid).toBe(true);
  });

  it('detects (rejects) a folder that is not a real folder ref, via apply', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertPage', ref: 'p', label: 'P', folder: 'not-a-real-folder' }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.some(e => e.message.includes('not-a-real-folder') && /does not exist/.test(e.message))).toBe(
      true
    );
  });

  it('detects a non-existent folder id when updating an existing page', async () => {
    const res = await apply({ operations: [{ type: 'upsertPage', ref: 'home', folder: 'ghost-id' }] }, buildSpace());
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].path).toContain('folder');
  });

  it('guards at mutate time when the folder op is ordered after the page (validation cannot see order)', async () => {
    const res = await apply(
      {
        operations: [
          { type: 'upsertPage', ref: 'post', folder: 'blog' },
          { type: 'upsertFolder', ref: 'blog', name: 'Blog' }
        ]
      },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.some(e => e.message.includes('not found'))).toBe(true);
  });

  it('moving a page to the root stores "" (round-trips through the summary as no folder)', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          { type: 'upsertFolder', ref: 'blog', name: 'Blog' },
          { type: 'upsertPage', ref: 'post', folder: 'blog' }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    await apply({ operations: [{ type: 'upsertPage', ref: 'post', folder: '' }] }, cap.saved(), cap.persisters);
    expect(folderOf(cap.saved(), 'post')).toBe('');
    const summary = (readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[]).find(
      p => p.ref === 'post'
    );
    expect(summary?.folder).toBeUndefined();
  });
});

describe('mcp-ai element names (the name IS the id, and the runtime wiring key)', () => {
  it('stores the chosen name as the element id, which is also its key in the document', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [{ type: 'upsertElement', pageRef: 'home', element: { ref: 'products-api', type: 'apiContainer' } }]
      },
      buildSpace(),
      cap.persisters
    );
    const el = Object.values(cap.saved().schema.flat).find(e => e.definition.type === 'apiContainer');
    expect(el?.id).toBe('products-api');
    // No translation anywhere: the name the agent wrote is the flat key.
    expect(cap.saved().schema.flat['products-api']).toBeDefined();
  });

  it('a binding source written against the ref matches the key the runtime registers', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'products-api', type: 'apiContainer' } },
          {
            type: 'upsertElement',
            pageRef: 'home',
            parentRef: 'products-api',
            element: { ref: 'row-title', type: 'text' }
          },
          {
            type: 'upsertBinding',
            pageRef: 'home',
            ref: 'row-title',
            category: 'attributes',
            binding: { to: 'content', source: 'apiContainer_products-api.data.name' }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);

    const saved = cap.saved();
    const api = Object.values(saved.schema.flat).find(e => e.definition.type === 'apiContainer');
    const child = Object.values(saved.schema.flat).find(e => e.id === 'row-title');
    const storedSource = child?.definition.bindings?.attributes?.[0].source;
    // What ApiContainer registers at runtime is `apiContainer_${idRef ?? id}` — the binding must target exactly that.
    const runtimeSourceName = api ? `apiContainer_${api.id}` : '';
    expect(storedSource?.startsWith(`${runtimeSourceName}.`)).toBe(true);
    expect(child?.definition.parentId).toBe(api?.id);
  });

  it('rejects a new ref whose charset would break the source/interaction path grammar', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertElement', pageRef: 'home', element: { ref: 'hero.cta', type: 'text' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('not a valid element name');
  });

  it('rejects a new name already used elsewhere in the space (a name is a global wiring key)', async () => {
    // "home" is the existing page's name: reusing it for a new element would make the wiring key ambiguous.
    const res = await apply(
      { operations: [{ type: 'upsertElement', pageRef: 'home', element: { ref: 'home', type: 'text' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('already used');
  });

  it('rejects duplicate refs within one element tree (validator)', async () => {
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'home',
            element: { ref: 'dup', type: 'container', children: [{ ref: 'dup', type: 'text' }] }
          }
        ]
      },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('Duplicate ref');
  });

  it('upserting an existing ref on its own page still updates it (not a uniqueness collision)', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'c1', type: 'container', label: 'Renamed' } }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    expect(cap.saved().schema.flat.c1.definition.label).toBe('Renamed');
  });

  it('patchElement renames an element, re-keying the document under the new name', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', rename: 'hero-box' }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    expect(cap.saved().schema.flat.c1).toBeUndefined();
    expect(cap.saved().schema.flat['hero-box'].id).toBe('hero-box');
    // The parent's items moved with it — a rename that left the tree behind would orphan the element.
    expect(cap.saved().schema.flat.home.definition.items).toContain('hero-box');
  });

  it('patchElement rejects a new name that is taken or malformed, leaving the element untouched', async () => {
    for (const [rename, message] of [
      ['home', 'already used'],
      ['hero.box', 'not a valid name']
    ]) {
      const res = await apply(
        { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', rename }] },
        buildSpace()
      );
      expect(res.applied).toBe(false);
      expect(res.errors?.[0].message).toContain(message);
    }
  });

  it('patchElement renaming an element to its own name is a no-op, not a collision', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', rename: 'c1', label: 'Renamed' }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    expect(cap.saved().schema.flat.c1.definition.label).toBe('Renamed');
  });

  it('patchElement renaming repoints the bindings and interactions that named the old id', async () => {
    const space = buildSpace();
    space.schema.flat.home.definition.bindings = {
      attributes: [{ id: 'b1', source: 'container_c1.data', to: 'items' }]
    };
    space.schema.flat.home.definition.interactions = {
      n1: {
        id: 'n1',
        title: 'Hide',
        type: 'callback',
        action: 'setVisibility',
        elementId: 'c1',
        params: {},
        preview: {},
        beforeNode: '',
        afterNode: '',
        flowId: 'n1',
        enabled: true
      }
    };
    const cap = capturing(space);

    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', rename: 'catalog-api' }] },
      cap.saved(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const page = cap.saved().schema.flat.home.definition;
    expect(page.bindings?.attributes?.[0].source).toBe('container_catalog-api.data');
    expect(page.interactions?.n1.elementId).toBe('catalog-api');
  });
});

describe('mcp-ai write response element versions (R1)', () => {
  it('returns each element with its own uri and stateVersion, ready for the next edit', async () => {
    const res = await apply(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'c1', type: 'container', props: { title: 'X' } } }
        ]
      },
      buildSpace()
    );
    const el = res.elements?.find(e => e.ref === 'c1');
    expect(el?.uri).toBe('plitzi://schema/main/elements/c1');
    expect(el?.stateVersion).toMatch(/^[a-f0-9]{12}$/);
  });
});
