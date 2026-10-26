import { describe, expect, it } from 'vitest';

import { buildSpace, capturing, checkBatch } from './helpers';
import { readResource } from '../resources';
import { apply } from '../tools';
import { upsertPageOp } from '../tools/operations/schema/pages/upsertPage';

import type { Space } from '../helpers';
import type { AIFolder, AIPageSkeleton, AIPageSummary } from '../types';

describe('MCP settings (space-level customCss + auth config)', () => {
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

  // The look of the toasts is written as a rule inside customCss, the way authoring writes it — and each one reads and
  // changes on its own: new notifications keep the CSS, new CSS keeps the notifications.
  it('dresses the notifications apart from the custom CSS, each kept when the other changes', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          { type: 'patchSettings', customCss: '.a{}', notifications: { background: 'var(--card)', radius: '12px' } }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    await apply(
      { operations: [{ type: 'patchSettings', notifications: { radius: null, border: '1px solid var(--line)' } }] },
      cap.saved(),
      cap.persisters
    );
    await apply({ operations: [{ type: 'patchSettings', customCss: '.b{}' }] }, cap.saved(), cap.persisters);
    const settings = readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data as {
      customCss?: string;
      notifications?: Record<string, string>;
    };

    expect(settings.customCss).toBe('.b{}');
    expect(settings.notifications).toEqual({ background: 'var(--card)', border: '1px solid var(--line)' });
    expect(cap.saved().schema.settings.customCss).toContain('--toastify-color-light: var(--card);');
  });

  it('refuses a notifications value that is not one CSS value, and a field it does not take', () => {
    const broken = checkBatch(
      { operations: [{ type: 'patchSettings', notifications: { background: 'red; } body { display: none' } }] },
      buildSpace()
    );
    const unknown = checkBatch(
      { operations: [{ type: 'patchSettings', notifications: { colour: 'red' } }] },
      buildSpace()
    );

    expect(broken.valid).toBe(false);
    expect(broken.errors[0]?.message).toContain('not one CSS value');
    expect(unknown.valid).toBe(false);
  });

  it('keeps state per space, leaving out the keys it is told never to keep', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchSettings', keepState: true, transientState: ['tourStep'] }] },
      buildSpace(),
      cap.persisters
    );
    const settings = readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data as { transientState?: string[] };
    expect(settings.transientState).toEqual(['tourStep']);
  });

  // The runtime compares top-level keys: a dotted one would match nothing and the state would be kept regardless.
  it('refuses a dotted transient key', () => {
    const res = checkBatch({ operations: [{ type: 'patchSettings', transientState: ['tour.step'] }] }, buildSpace());
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('no dots'))).toBe(true);
  });

  // The kept keys the first paint shows: written like the transient ones, and never one of them.
  it('keeps the painted keys the server draws with', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchSettings', keepState: true, paintedState: ['toolPick'] }] },
      buildSpace(),
      cap.persisters
    );
    const settings = readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data as { paintedState?: string[] };
    expect(settings.paintedState).toEqual(['toolPick']);
  });

  it('refuses a painted key that is dotted, or also transient', () => {
    const dotted = checkBatch({ operations: [{ type: 'patchSettings', paintedState: ['tool.pick'] }] }, buildSpace());
    expect(dotted.errors.some(e => e.path.endsWith('paintedState[0]') && e.message.includes('no dots'))).toBe(true);

    const both = checkBatch(
      { operations: [{ type: 'patchSettings', paintedState: ['toolPick'], transientState: ['toolPick'] }] },
      buildSpace()
    );
    expect(both.valid).toBe(false);
    expect(both.errors.some(e => e.message.includes('both paintedState and transientState'))).toBe(true);
  });

  it('declares realtime channels pattern by pattern, and takes one out with null', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          {
            type: 'patchSettings',
            channels: {
              'board:{id}': { access: { mode: 'public' }, publish: 'server' },
              'room:{id}': { access: { mode: 'public' }, presence: true }
            }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    await apply(
      { operations: [{ type: 'patchSettings', channels: { 'board:{id}': null } }] },
      cap.saved(),
      cap.persisters
    );
    const settings = readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data as { channels?: object };
    expect(settings.channels).toEqual({ 'room:{id}': { access: { mode: 'public' }, presence: true } });
  });

  // The pattern is what the server matches topics against: one it cannot read opens nothing, silently.
  it('refuses a channel the server could not serve, saying how to write it', () => {
    const res = checkBatch(
      { operations: [{ type: 'patchSettings', channels: { 'board {id}': { access: { mode: 'public' } } } }] },
      buildSpace()
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('`board:{id}`'))).toBe(true);
  });

  // A link to a space pasted in a chat showed no picture and Plitzi's icon, and an agent had no field to say otherwise.
  it('writes how a link to the site shows — its name, language, icon, picture, colour — and its robots.txt', async () => {
    const cap = capturing(buildSpace());
    const identity = {
      siteName: 'Acme',
      language: 'en',
      favicon: '/favicon.svg',
      shareImage: '/og.png',
      themeColor: { light: '#fbf7f0', dark: '#0b0a10' },
      robotsTxt: 'User-agent: *\nAllow: /\n'
    };
    const res = await apply({ operations: [{ type: 'patchSettings', ...identity }] }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    expect(readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data).toMatchObject(identity);
  });

  it('refuses an identity a head cannot read, saying how to write it', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'patchSettings', favicon: 'favicon.svg' }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0]?.message).toContain('neither a file of the site nor an address');
  });

  it('names the page drawn in place of one withheld, refuses one the space has not, and takes it out with ""', async () => {
    const cap = capturing(buildSpace());
    const named = await apply(
      { operations: [{ type: 'patchSettings', withheldPage: 'home' }] },
      buildSpace(),
      cap.persisters
    );
    expect(named.applied).toBe(true);
    expect(readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data).toMatchObject({ withheldPage: 'home' });

    const unknown = await apply(
      { operations: [{ type: 'patchSettings', withheldPage: 'nowhere' }] },
      buildSpace(),
      cap.persisters
    );
    expect(unknown.applied).toBe(false);
    expect(unknown.errors?.[0]?.message).toContain('is no page of the space');

    const cleared = await apply(
      { operations: [{ type: 'patchSettings', withheldPage: '' }] },
      cap.saved(),
      cap.persisters
    );
    expect(cleared.applied).toBe(true);
    expect(readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data).not.toHaveProperty('withheldPage');
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
describe('MCP page enable/disable (attributes.enabled)', () => {
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
describe('MCP page documentScroll', () => {
  const skeleton = (space: Space, ref: string) =>
    readResource(space, 'main', `plitzi://schema/main/pages/${ref}`)?.data as AIPageSkeleton;

  it('holds a page still, reads it back, and lets it scroll again with null', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'upsertPage', ref: 'desk', documentScroll: 'locked' }] },
      buildSpace(),
      cap.persisters
    );
    expect(skeleton(cap.saved(), 'desk').documentScroll).toBe('locked');

    await apply({ operations: [{ type: 'upsertPage', ref: 'desk', label: 'Desk' }] }, cap.saved(), cap.persisters);
    expect(skeleton(cap.saved(), 'desk').documentScroll).toBe('locked');

    await apply(
      { operations: [{ type: 'upsertPage', ref: 'desk', documentScroll: null }] },
      cap.saved(),
      cap.persisters
    );
    expect(skeleton(cap.saved(), 'desk').documentScroll).toBeUndefined();
    expect(cap.saved().schema.flat.desk.attributes).not.toHaveProperty('documentScroll');
  });

  it('refuses a value no page reads', () => {
    expect(upsertPageOp.safeParse({ type: 'upsertPage', ref: 'home', documentScroll: 'fixed' }).success).toBe(false);
  });

  /** A page write is held to the lint of the page it leaves, as an element write is: two pages at one address. */
  it('refuses a page written onto an address another page answers', () => {
    const home = checkBatch({ operations: [{ type: 'upsertPage', ref: 'home', slug: 'about' }] }, buildSpace());
    expect(home.valid).toBe(true);

    const res = checkBatch(
      {
        operations: [
          { type: 'upsertPage', ref: 'about', slug: 'about' },
          { type: 'upsertPage', ref: 'home', slug: 'about' }
        ]
      },
      buildSpace()
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some(error => error.message.includes('page-route-taken'))).toBe(true);
  });
});
describe('MCP page slug is relative (leading slash stripped)', () => {
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
describe('MCP patchElement (I3/R3 — partial merge)', () => {
  it('changes only the listed prop, preserving the rest', async () => {
    const space = buildSpace();
    space.schema.flat.home.definition.items = ['c1', 'img'];
    space.schema.flat.img = {
      id: 'img',
      attributes: { src: 'https://cdn.example.com/a.png', alt: 'Before' },
      definition: {
        rootId: 'home',
        parentId: 'home',
        label: 'Image',
        type: 'image',
        items: [],
        styleSelectors: { base: '' }
      }
    };
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'img', props: { alt: 'After' } }] },
      space
    );
    const el = res.elements?.find(e => e.ref === 'img');
    expect(el?.props).toEqual({ src: 'https://cdn.example.com/a.png', alt: 'After' });
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
      {
        operations: [
          { type: 'upsertDefinition', ref: 'extra', desktop: { color: 'red' } },
          { type: 'patchElement', pageRef: 'home', ref: 'c1', style: { base: ['box', 'extra'] } }
        ]
      },
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
describe('MCP page folders (create, nest, delete, move)', () => {
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
    const r = checkBatch({ operations: [{ type: 'upsertPage', ref: 'x', folder: 'ghost' }] }, buildSpace());
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain('Folder "ghost" does not exist');
  });

  it('rejects nesting a folder under itself', () => {
    const r = checkBatch({ operations: [{ type: 'upsertFolder', ref: 'blog', parentId: 'blog' }] }, buildSpace());
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
describe('MCP page.folder is always "" (root) or a valid id', () => {
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
    expect(checkBatch({ operations: [{ type: 'upsertPage', ref: 'p', folder: '' }] }, buildSpace()).valid).toBe(true);
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
