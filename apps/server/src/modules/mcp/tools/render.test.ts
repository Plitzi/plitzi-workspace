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
    expect(result.offlineData.schema.flat['hero-cta']).toBeDefined();
    expect(result.offlineData.schema.flat['hero-cta'].definition.type).toBe('button');
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
