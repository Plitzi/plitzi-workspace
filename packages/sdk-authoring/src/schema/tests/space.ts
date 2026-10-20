import type { ElementSpec, SpaceSpec } from '../index';

export const text = (content: string, css?: ElementSpec['css']): ElementSpec => ({
  type: 'text',
  attributes: { content },
  ...(css ? { css } : {})
});

export const heading = (content: string, subType: string, css?: ElementSpec['css']): ElementSpec => ({
  type: 'heading',
  attributes: { subType, content },
  ...(css ? { css } : {})
});

export const container = (children: ElementSpec[], css?: ElementSpec['css']): ElementSpec => ({
  type: 'container',
  attributes: { subType: 'div' },
  children,
  ...(css ? { css } : {})
});

export const minimal = (overrides: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Test Space',
  permanentUrl: 'test-space',
  pages: [
    {
      name: 'Home',
      slug: '',
      seoTitle: 'Home — Test',
      seoDescription: 'A description.',
      css: { desktop: { display: 'flex' } },
      body: [
        container([heading('Hello', 'h1', { desktop: { 'font-size': '48px' } })], { desktop: { 'row-gap': '10px' } })
      ]
    },
    ...(overrides.pages ?? [])
  ],
  ...overrides,
  ...(overrides.pages ? { pages: overrides.pages } : {})
});
