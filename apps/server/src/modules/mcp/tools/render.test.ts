import { describe, expect, it } from 'vitest';

import { render, renderTool } from './render';

import type { Operation } from './operations';

const widget: Operation[] = [
  { type: 'upsertDefinition', ref: 'btn-hero', desktop: { 'background-color': '#3b82f6' } },
  {
    type: 'upsertElement',
    pageRef: 'render',
    element: { ref: 'hero-cta', type: 'button', props: { content: 'Go' }, style: { base: ['btn-hero'] } }
  }
] as Operation[];

describe('plitzi_render', () => {
  it('renders a self-contained widget from operations', () => {
    const result = render({ operations: widget });

    expect(result.rendered).toBe(true);
    if (!result.rendered) {
      return;
    }

    expect(result.rootRef).toBe('render');
    expect(result.elementCount).toBe(1);
    // Elements are keyed by generated id; the agent's `ref` lives on as the element's idRef.
    const element = Object.values(result.offlineData.schema.flat).find(entry => entry.idRef === 'hero-cta');
    expect(element?.definition.type).toBe('button');
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
