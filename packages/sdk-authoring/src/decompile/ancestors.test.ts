import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { container, text } from '../elements';
import { authorSpace } from '../index';
import { styles } from '../style';
import { compareSpaces } from './compareSpaces';
import { specFromSpace } from './specFromSpace';
import { specToSource } from './specToSource';

import type { SpaceSpec } from '../schema';

const card = styles('card', { css: { padding: '16px' } });
const sidebar = styles('sidebar', { css: { width: '240px' } });
const icon = styles('card-icon', {
  css: { transition: 'transform 180ms' },
  ancestors: {
    [card.name]: { states: { hover: { transform: 'translateX(3px)' } } },
    [sidebar.name]: { variants: { collapsed: { css: { display: 'none' }, states: { hover: { display: 'block' } } } } }
  }
});

const space: SpaceSpec = {
  name: 'Ancestors',
  permanentUrl: 'ancestors',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [container({ class: sidebar, children: [container({ class: card, children: [text('→', { class: icon })] })] })]
    }
  ]
};

/** A space whose conditions live in customCss, as they did before a class could hold them. */
const legacy = (customCss: string, iconRules: SpaceSpec['classes'] = {}): SpaceSpec => ({
  name: 'Legacy',
  permanentUrl: 'legacy',
  classes: { card: { padding: '16px' }, sidebar: { width: '240px' }, icon: { color: 'black' }, ...iconRules },
  customCss,
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [container({ class: 'sidebar', children: [container({ class: 'card', children: [text('→', { class: 'icon' })] })] })]
    }
  ]
});

describe('specFromSpace / ancestor conditions', () => {
  it('reads them back into a spec that authors the same space', () => {
    const documents = authorSpace(space);
    const { spec, corrections } = specFromSpace(documents);

    expect(corrections).toEqual([]);
    expect(spec.classes?.['card-icon']).toMatchObject({
      ancestors: {
        card: { states: { hover: { transform: 'translateX(3px)' } } },
        sidebar: { variants: { collapsed: { css: { display: 'none' }, states: { hover: { display: 'block' } } } } }
      }
    });
    expect(compareSpaces(documents, authorSpace(spec))).toEqual([]);
  });

  it('keeps a class another names as its ancestor a class, even when one element wears it', () => {
    const { spec } = specFromSpace(authorSpace(space));

    expect(spec.classes).toHaveProperty('card');
    expect(spec.classes).toHaveProperty('sidebar');
  });

  it('counts a changed ancestor condition as a difference', () => {
    const moved = styles('card-icon', {
      css: { transition: 'transform 180ms' },
      ancestors: { [card.name]: { states: { hover: { transform: 'translateX(6px)' } } } }
    });
    const changed: SpaceSpec = {
      ...space,
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          body: [container({ class: sidebar, children: [container({ class: card, children: [text('→', { class: moved })] })] })]
        }
      ]
    };

    expect(compareSpaces(authorSpace(space), authorSpace(changed))).not.toEqual([]);
  });
});

describe('specFromSpace / folding ancestor rules out of customCss', () => {
  it('moves an ancestor state or variant rule into the class it styles', () => {
    const { spec, corrections } = specFromSpace(
      authorSpace(
        legacy(
          '.card:hover .icon { transform: translateX(3px); }\n\n' +
            '.sidebar[data-variant=\'collapsed\'] .icon { display: none; }\n\n' +
            '.sidebar[data-variant="collapsed"]:hover .icon { display: block; }\n'
        )
      )
    );

    expect(spec.classes?.icon).toMatchObject({
      ancestors: {
        card: { states: { hover: { transform: 'translateX(3px)' } } },
        sidebar: { variants: { collapsed: { css: { display: 'none' }, states: { hover: { display: 'block' } } } } }
      }
    });
    expect(spec.customCss).toBeUndefined();
    expect(corrections.map(correction => correction.message)).toContain(
      'The customCss rule for ".card:hover .icon" is now part of its class.'
    );
  });

  it('leaves what is not a condition of a class the space has', () => {
    const kept =
      '.card .icon { color: red; }\n\n.card:hover .icon::after { opacity: 1; }\n\n.card:hover .missing { color: red; }\n\n.nav:hover .icon { color: red; }\n';
    const { spec } = specFromSpace(authorSpace(legacy(kept)));

    expect(spec.customCss).toBe(kept);
  });

  it('leaves a rule the class own state would now outweigh', () => {
    const rule = '.card:hover .icon { color: red; }\n';
    const { spec } = specFromSpace(authorSpace(legacy(rule, { icon: { css: { color: 'black' }, states: { focus: { color: 'blue' } } } })));

    expect(spec.customCss).toBe(rule);
  });
});

describe('specToSource / ancestor conditions', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const scratch = mkdtempSync(join(tmpdir(), 'spec-ancestors-'));

  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it('names each ancestor by its declaration, declared first, and authors the same space', async () => {
    const documents = authorSpace(space);
    const { spec } = specFromSpace(documents);
    const files = specToSource(spec, { exportName: 'ancestors', packageName: join(here, '..', 'index.ts') });
    const source = files['index.ts'];

    expect(source).toContain('[card.name]: { states: { hover:');
    expect(source.indexOf('const card =')).toBeLessThan(source.indexOf('const cardIcon ='));
    expect(source.indexOf('const sidebar =')).toBeLessThan(source.indexOf('const cardIcon ='));

    const root = join(scratch, 'ancestors');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'index.ts'), source);
    const module = (await import(join(root, 'index.ts'))) as Record<string, SpaceSpec>;

    expect(compareSpaces(documents, authorSpace(module.ancestors))).toEqual([]);
  });
});
