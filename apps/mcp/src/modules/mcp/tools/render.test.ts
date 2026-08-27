import { describe, expect, it } from 'vitest';

import { render, renderTool } from './render';
import { emptySpace } from '../helpers';
import { validateOperations } from './shared/validator';

import type { Operation } from './operations';
import type { ToolContext } from './shared/tool';

const widget: Operation[] = [
  { type: 'upsertDefinition', ref: 'btn-hero', desktop: { 'background-color': '#3b82f6' } },
  {
    type: 'upsertElement',
    pageRef: 'render',
    element: { ref: 'hero-cta', type: 'button', props: { content: 'Go' }, style: { base: ['btn-hero'] } }
  }
] as Operation[];

// plitzi_render is spaceless — it authors a throwaway space of its own — so the context it is handed is inert.
const context: ToolContext = { space: emptySpace(), env: 'main', persisters: {} };

describe('plitzi_render', () => {
  it('renders a self-contained widget from operations', () => {
    const result = render({ operations: widget });

    expect(result.rendered).toBe(true);
    if (!result.rendered) {
      return;
    }

    expect(result.rootRef).toBe('render');
    expect(result.elementCount).toBe(1);
    // The name the agent chose IS the element's id, so the flat key is exactly what it asked for.
    const element = result.offlineData.schema.flat['hero-cta'];
    expect(element.definition.type).toBe('button');
    // The style cache is compiled into the payload, so the offline SDK can paint with no backend.
    expect(result.offlineData.style.cache).toContain('background-color');
  });

  it('returns teachable errors when an op targets a missing page (never throws)', () => {
    const result = render({
      operations: [
        { type: 'upsertElement', pageRef: 'nope', element: { ref: 'x', type: 'container', props: {} } }
      ] as Operation[]
    });

    expect(result.rendered).toBe(false);
    if (result.rendered) {
      return;
    }

    expect(result.errors.length).toBeGreaterThan(0);
  });

  // The handle is what makes iterating stateless: the model carries it, so any replica can answer a patch and no
  // server has to remember which widget "the last one" was.
  it('mints a fresh handle per render, so two widgets are never confused for each other', () => {
    const first = renderTool.execute({ operations: widget }, context) as { structuredContent: { renderId: string } };
    const second = renderTool.execute({ operations: widget }, context) as { structuredContent: { renderId: string } };

    expect(first.structuredContent.renderId).toMatch(/^r[0-9a-f]{8}$/u);
    expect(first.structuredContent.renderId).not.toBe(second.structuredContent.renderId);
  });

  it('keeps the handle the view sends back, so a widget holds one id across every iteration', () => {
    const result = renderTool.execute({ operations: widget, renderId: 'r0f1e2d' }, context) as {
      structuredContent: { renderId: string };
    };

    expect(result.structuredContent.renderId).toBe('r0f1e2d');
  });

  it('refuses a patch that names no widget instead of merging it into whatever is there', () => {
    const result = renderTool.execute({ operations: widget, patch: true }, context) as { structuredContent?: unknown };

    expect(result.structuredContent).toBeUndefined();
  });

  // The icon fonts are ~330 KB the page shell no longer carries, so every widget's iframe boots that much
  // lighter — but a widget that draws an icon still has to get them from somewhere.
  it('sends the icon fonts only with the widgets that draw an icon', () => {
    const withIcon = renderTool.execute(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'render', element: { ref: 'star', type: 'fontAwesome', props: {} } }
        ] as Operation[]
      },
      context
    ) as { structuredContent: { iconCss?: string } };
    const withoutIcon = renderTool.execute({ operations: widget }, context) as {
      structuredContent: { iconCss?: string };
    };

    expect(withIcon.structuredContent.iconCss).toContain('@font-face');
    expect(withIcon.structuredContent.iconCss).toContain('Font Awesome');
    expect(withoutIcon.structuredContent.iconCss).toBeUndefined();
  });

  // Vector graphics are the one thing a widget cannot fake with CSS, and blockHtml is the only route to them —
  // so the type has to survive validation intact, markup and all.
  it('renders an inline svg authored in a blockHtml element', () => {
    const result = render({
      operations: [
        {
          type: 'upsertDefinitions',
          definitions: { mark: { desktop: { display: 'flex', width: '32px', height: '32px', color: '#3b82f6' } } }
        },
        {
          type: 'upsertElement',
          pageRef: 'render',
          element: {
            ref: 'trend',
            type: 'blockHtml',
            style: { base: ['mark'] },
            props: {
              content:
                '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor">' +
                '<path d="M3 17l6-6 4 4 8-8"/></svg>'
            }
          }
        }
      ] as Operation[]
    });

    expect(result.rendered).toBe(true);
    if (!result.rendered) {
      return;
    }

    // Warnings are what the model reads back, so a legitimate drawing must produce none.
    expect(result.warnings).toBeUndefined();
    const element = result.offlineData.schema.flat['trend'];
    expect(element.attributes.content).toContain('<svg');
  });

  // The markup is injected with dangerouslySetInnerHTML into a view running inside the host's chat UI: inert
  // drawings are the point of the escape hatch here, executable markup is not.
  it.each([
    ['a script tag', '<svg/><script>fetch("https://evil.test")</script>'],
    ['an inline handler', '<svg onload="fetch(1)"></svg>'],
    ['a javascript: url', '<svg><a href="javascript:alert(1)"><rect/></a></svg>']
  ])('refuses %s in a widget’s raw markup', (_case, content) => {
    const operations = [
      { type: 'upsertElement', pageRef: 'render', element: { ref: 'mark', type: 'blockHtml', props: { content } } }
    ] as Operation[];
    const result = render({ operations });

    expect(result.rendered).toBe(false);
    if (result.rendered) {
      return;
    }

    expect(result.errors[0]?.path).toBe('operations[0].element.props.content');
    expect(result.errors[0]?.hint).toContain('upsertInteractionFlow');
    // The same markup in a SPACE is the escape hatch working as intended — the rule is the widget's, not the type's.
    const spaceErrors = validateOperations(emptySpace(), operations).errors;
    expect(spaceErrors.some(error => error.path.endsWith('props.content'))).toBe(false);
  });

  it('is registered as a read-only, space-independent tool', () => {
    expect(renderTool.name).toBe('plitzi_render');
    expect(renderTool.access).toBe('read');
    expect(renderTool.requires).toBeUndefined();
  });
});

// A design token declares any of default/light/dark. The side it does NOT declare must not be written out: a
// custom property accepts almost any token sequence, so a literal `undefined` was not ignored — it overrode the
// value that WAS given, and every declaration reading that var computed to nothing.
describe('style variables (design tokens) compile per theme', () => {
  const compile = (value: unknown): string => {
    const res = render({
      operations: [
        { type: 'upsertStyleVariable', name: 'ink', value, category: 'color' },
        { type: 'upsertDefinitions', definitions: { tone: { desktop: { color: 'var(--ink)' } } } }
      ]
    } as never);

    expect(res.rendered).toBe(true);

    return res.rendered ? res.offlineData.style.cache : '';
  };

  it('writes only the sides a light/dark token declares', () => {
    const css = compile({ light: '#000', dark: '#fff' });

    expect(css).not.toContain('undefined');
    expect(css).toContain('--ink: #000;');
    expect(css).toContain('--ink: #fff;');
  });

  it('leaves a default-only token alone instead of undoing it per scheme', () => {
    const css = compile({ default: 'light-dark(#000, #fff)' });

    expect(css).toContain('--ink: light-dark(#000, #fff);');
    expect(css).not.toContain('prefers-color-scheme');
  });
});
