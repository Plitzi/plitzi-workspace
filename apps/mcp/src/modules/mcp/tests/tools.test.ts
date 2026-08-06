import { describe, it, expect } from 'vitest';

import { createMemoryDraftStore } from '@plitzi/sdk-server/ssr';

import { buildSpace } from './helpers';
import { createPreview } from '../../../preview/createPreview';
import { tools } from '../tools';

import type { Persisters, SearchResponse } from '../tools';

describe('mcp-ai tool registry (defineTool descriptors)', () => {
  const ctx = () => ({ space: buildSpace(), env: 'main' as const, persisters: {} as Persisters });

  it('registers every tool with name, modes metadata and an execute', () => {
    expect(tools.map(t => t.name).sort()).toEqual([
      'plitzi_apply',
      'plitzi_preview',
      'plitzi_read',
      'plitzi_render',
      'plitzi_screenshot',
      'plitzi_search',
      'plitzi_validate'
    ]);
    expect(tools.every(t => typeof t.execute === 'function')).toBe(true);
    expect(tools.find(t => t.name === 'plitzi_apply')?.access).toBe('write');
    expect(tools.find(t => t.name === 'plitzi_search')?.access).toBe('read');
  });

  it('execute validates raw args against the shape, then runs the typed tool', () => {
    const searchTool = tools.find(t => t.name === 'plitzi_search');
    const result = searchTool?.execute({ query: 'box' }, ctx()) as SearchResponse;
    expect(result.results.some(r => r.ref === 'c1')).toBe(true);
  });

  it('execute rejects args that do not match the shape', () => {
    const readTool = tools.find(t => t.name === 'plitzi_read');
    expect(() => readTool?.execute({}, ctx())).toThrow();
  });
});

describe('mcp-ai draft store (one-shot preview tokens)', () => {
  it('returns the stashed draft exactly once, then nothing', () => {
    const store = createMemoryDraftStore();
    const data = { schema: buildSpace().schema, style: buildSpace().style };
    void store.put('tok', data, 60000);
    expect(store.take('tok')).toBe(data);
    expect(store.take('tok')).toBeUndefined();
  });

  it('drops an expired token', () => {
    const store = createMemoryDraftStore();
    void store.put('tok', { schema: buildSpace().schema, style: buildSpace().style }, -1);
    expect(store.take('tok')).toBeUndefined();
  });
});

describe('mcp-ai createPreview (draft build, pre-render error paths)', () => {
  const configWith = (offline: unknown) =>
    ({ adapters: { getOfflineData: () => Promise.resolve(offline) } }) as unknown as Parameters<
      typeof createPreview
    >[1];
  const unusedRender = (() => '') as unknown as Parameters<typeof createPreview>[2];
  const unusedPlugins = {} as Parameters<typeof createPreview>[3];
  const unusedCaches = {} as Parameters<typeof createPreview>[4];

  it('reports NO_DATA when the space has no offline data', async () => {
    const res = await createPreview({ spaceId: 1 }, configWith(undefined), unusedRender, unusedPlugins, unusedCaches);
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ error: 'NO_DATA' });
  });

  it('rejects unapplicable operations with teachable errors, before any render', async () => {
    const offline = { schema: buildSpace().schema, style: buildSpace().style };
    const res = await createPreview(
      {
        spaceId: 1,
        operations: [{ type: 'upsertElement', pageRef: 'no-such-page', element: { ref: 'x', type: 'button' } }]
      },
      configWith(offline),
      unusedRender,
      unusedPlugins,
      unusedCaches
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(['INVALID_OPERATIONS', 'APPLY_FAILED']).toContain(res.error);
      expect(res.errors?.length).toBeGreaterThan(0);
    }
  });
});

describe('mcp-ai plitzi_preview tool', () => {
  const previewToolDef = () => tools.find(t => t.name === 'plitzi_preview');

  it('is registered as a read tool', () => {
    expect(previewToolDef()?.access).toBe('read');
  });

  it('reports PREVIEW_UNAVAILABLE when no preview client is wired', async () => {
    const res = (await previewToolDef()?.execute({}, { space: buildSpace(), env: 'main', persisters: {} })) as {
      error?: string;
    };
    expect(res.error).toBe('PREVIEW_UNAVAILABLE');
  });

  it('forwards to the preview client and returns its html + meta', async () => {
    const preview = {
      render: () =>
        Promise.resolve({ ok: true as const, pagePath: '/', html: '<!doctype html><html></html>', stateVersion: 'v1' })
    };
    const res = (await previewToolDef()?.execute(
      { pageRef: 'home' },
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview }
    )) as { html?: string; pagePath?: string; stateVersion?: string };
    expect(res.html).toContain('<!doctype html>');
    expect(res.pagePath).toBe('/');
    expect(res.stateVersion).toBe('v1');
  });
});

describe('mcp-ai plitzi_screenshot tool', () => {
  const screenshotToolDef = () => tools.find(t => t.name === 'plitzi_screenshot');
  const okPreview = {
    render: () =>
      Promise.resolve({
        ok: true as const,
        token: 't',
        pagePath: '/',
        html: '<!doctype html><html></html>',
        stateVersion: 'v1'
      })
  };

  it('declares a screenshot capability requirement', () => {
    expect(screenshotToolDef()?.requires).toBe('screenshot');
  });

  it('returns image content when the browser service succeeds', async () => {
    const screenshot = {
      capture: () =>
        Promise.resolve({ ok: true as const, images: [{ label: 'desktop', mimeType: 'image/png', data: 'AAAA' }] })
    };
    const res = (await screenshotToolDef()?.execute(
      { viewport: 'desktop' },
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview: okPreview, screenshot }
    )) as { content?: Array<{ type: string; data?: string; mimeType?: string }> };
    const image = res.content?.find(c => c.type === 'image');
    expect(image).toMatchObject({ type: 'image', data: 'AAAA', mimeType: 'image/png' });
  });

  it('falls back to the HTML preview with a warning when the browser service fails', async () => {
    const screenshot = {
      capture: () => Promise.resolve({ ok: false as const, error: 'SCREENSHOT_UNREACHABLE', message: 'pod down' })
    };
    const res = (await screenshotToolDef()?.execute(
      {},
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview: okPreview, screenshot }
    )) as { warning?: string; html?: string };
    expect(res.warning).toBe('SCREENSHOT_UNAVAILABLE');
    expect(res.html).toContain('<!doctype html>');
  });

  it('falls back to HTML when no browser service is wired', async () => {
    const res = (await screenshotToolDef()?.execute(
      {},
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview: okPreview }
    )) as { warning?: string; html?: string };
    expect(res.warning).toBe('SCREENSHOT_DISABLED');
    expect(res.html).toContain('<!doctype html>');
  });
});
