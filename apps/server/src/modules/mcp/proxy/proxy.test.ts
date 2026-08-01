import { describe, expect, it, vi } from 'vitest';

import { grantUrl, readGrant } from './grant';
import { isPrivateAddress, isPublicHost } from './guard';
import { rewriteText } from './rewrite';
import { connectionId } from './sign';
import { render } from '../tools/render';

import type { ResourceProxy } from './types';
import type { Operation } from '../tools/operations';

const proxy: ResourceProxy = {
  endpoint: 'https://mcp.example.com/__proxy',
  secret: 'test-secret',
  identity: 'conn1',
  ttl: 3600,
  tools: ['plitzi_render']
};

const param = (url: string): string => new URL(url).searchParams.get('i') ?? '';

describe('the grant a proxied URL carries', () => {
  it('round-trips the target and its kind', () => {
    const target = 'https://images.example.com/photo.jpg?w=800&h=600';

    expect(readGrant(param(grantUrl(target, proxy)), proxy.secret)).toEqual({ kind: 'asset', target });
    expect(readGrant(param(grantUrl(target, proxy, 'data')), proxy.secret)).toEqual({ kind: 'data', target });
  });

  // The endpoint sits on a public origin: without this it would fetch anything for anyone who found it.
  it('refuses what it did not sign', () => {
    const forged = `x.a.zzzz.conn1.${encodeURIComponent('https://internal.example.com/secret.png')}`;

    expect(readGrant(forged, proxy.secret)).toBeUndefined();
    expect(readGrant(param(grantUrl('https://a.example.com/x.png', proxy)), 'another-secret')).toBeUndefined();
    expect(readGrant(undefined, proxy.secret)).toBeUndefined();
  });

  // Swapping the target while keeping a signature minted for a different one.
  it('refuses a signature that belongs to another target', () => {
    const parts = param(grantUrl('https://a.example.com/x.png', proxy)).split('.');
    const swapped = [...parts.slice(0, 4), encodeURIComponent('https://b.example.com/y.png')].join('.');

    expect(readGrant(swapped, proxy.secret)).toBeUndefined();
  });

  // A grant minted for an image must not become a way to read an API through the same endpoint.
  it('refuses a target replayed under another kind', () => {
    const parts = param(grantUrl('https://a.example.com/x.png', proxy)).split('.');
    const swapped = [parts[0], 'd', ...parts.slice(2)].join('.');

    expect(readGrant(swapped, proxy.secret)).toBeUndefined();
  });

  it('stops working once it expires', () => {
    const url = grantUrl('https://a.example.com/x.png', { ...proxy, ttl: 60 });

    vi.setSystemTime(Date.now() + 61_000);
    expect(readGrant(param(url), proxy.secret)).toBeUndefined();
    vi.useRealTimers();
  });

  // An apiContainer URL is substituted in the browser, so the signature covers the one part the substitution
  // cannot change — and stays scoped to that host.
  it('grants a {{token}} URL over its origin, not over any host', () => {
    const templated = 'https://api.example.com/items/{{id}}';
    const url = grantUrl(templated, proxy, 'data');

    expect(url).toContain('{{id}}');

    const resolved = param(url).replace('{{id}}', '42');
    expect(readGrant(resolved, proxy.secret)).toEqual({ kind: 'data', target: 'https://api.example.com/items/42' });

    const elsewhere = param(url).replace('api.example.com', 'evil.example.com');
    expect(readGrant(elsewhere, proxy.secret)).toBeUndefined();
  });

  // Grants minted by one MCP connection are distinct from another's: the identity is signed in.
  it('binds the grant to the connection that minted it', () => {
    const other = { ...proxy, identity: connectionId('Bearer someone-else', proxy.secret) };

    expect(param(grantUrl('https://a.example.com/x.png', proxy))).not.toBe(
      param(grantUrl('https://a.example.com/x.png', other))
    );
    expect(connectionId(undefined, proxy.secret)).toBe('anon');
  });

  // Two parameters would put an `&` in URLs that end up inside HTML attributes and markdown links.
  it('carries everything in one query parameter', () => {
    expect(grantUrl('https://a.example.com/x.png', proxy)).not.toContain('&');
  });
});

describe('rewriting authored URLs', () => {
  it('rewrites CSS url(), markup src= and markdown images', () => {
    expect(rewriteText('background-image: url("https://cdn.example.com/bg.png")', proxy)).toContain(
      `url("${proxy.endpoint}?i=`
    );
    expect(rewriteText('<img src="https://cdn.example.com/a.png" alt="a">', proxy)).toContain(
      `src="${proxy.endpoint}?i=`
    );
    expect(rewriteText('![a](https://cdn.example.com/a.png)', proxy)).toContain(`![a](${proxy.endpoint}?i=`);
  });

  // A widget is re-rendered on every patch, so a rewrite that wrapped its own output would nest one proxied URL
  // inside another with each iteration.
  it('leaves an already proxied URL alone', () => {
    const once = rewriteText('<img src="https://cdn.example.com/a.png">', proxy);

    expect(rewriteText(once, proxy)).toBe(once);
  });

  // What a browser fetches from `src="…&amp;…"` is the unescaped URL, so that is what has to be signed.
  it('unescapes HTML entities before signing', () => {
    const html = rewriteText('<img src="https://cdn.example.com/a.png?w=1&amp;h=2">', proxy);
    const rewritten = /src="([^"]+)"/u.exec(html)?.[1] ?? '';

    expect(readGrant(param(rewritten), proxy.secret)?.target).toBe('https://cdn.example.com/a.png?w=1&h=2');
  });

  it('leaves data: and relative URLs untouched', () => {
    const untouched = '<img src="data:image/png;base64,AAA"><img src="/local.png">';

    expect(rewriteText(untouched, proxy)).toBe(untouched);
  });
});

describe('a rendered widget', () => {
  const widget: Operation[] = [
    { type: 'upsertDefinition', ref: 'hero', desktop: { 'background-image': 'url(https://cdn.example.com/bg.png)' } },
    {
      type: 'upsertElement',
      pageRef: 'render',
      element: {
        ref: 'shot',
        type: 'image',
        props: { src: 'https://cdn.example.com/photo.png', alt: 'a' },
        style: { base: ['hero'] }
      }
    },
    {
      type: 'upsertElement',
      pageRef: 'render',
      element: { ref: 'feed', type: 'apiContainer', props: { query: 'https://api.example.com/items' } }
    }
  ] as Operation[];

  type Rendered = { schema: { flat: Record<string, { idRef?: string; attributes: Record<string, unknown> }> } };

  const attributeOf = (data: Rendered, ref: string, name: string) =>
    Object.values(data.schema.flat).find(element => element.idRef === ref)?.attributes[name];

  it('loads everything external through the endpoint the host CSP declares', () => {
    const result = render({ operations: widget }, { proxy });

    expect(result.rendered).toBe(true);
    if (!result.rendered) {
      return;
    }

    expect(attributeOf(result.offlineData, 'shot', 'src')).toContain(`${proxy.endpoint}?i=`);
    expect(attributeOf(result.offlineData, 'feed', 'query')).toContain(`${proxy.endpoint}?i=`);
    // The compiled cache is what the offline SDK paints from, so the rewrite has to land before it is generated.
    expect(result.offlineData.style.cache).toContain(`url(${proxy.endpoint}?i=`);
    expect(result.offlineData.style.cache).not.toContain('url(https://cdn.example.com');
  });

  // Relaying those faithfully is not something the hop can do, so the widget keeps calling directly — and the
  // model is told, because that request may not run.
  it('leaves a credentialed or non-GET fetch alone, with a warning', () => {
    const result = render(
      {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'render',
            element: {
              ref: 'writer',
              type: 'apiContainer',
              props: { query: 'https://api.example.com/items', method: 'post' }
            }
          }
        ] as Operation[]
      },
      { proxy }
    );

    expect(result.rendered).toBe(true);
    if (!result.rendered) {
      return;
    }

    expect(attributeOf(result.offlineData, 'writer', 'query')).toBe('https://api.example.com/items');
    expect(result.warnings?.join(' ')).toContain('POST');
  });

  // A host that wired no endpoint still renders: the URLs travel as authored.
  it('keeps the authored URLs when no endpoint is configured', () => {
    const result = render({ operations: widget });

    expect(result.rendered).toBe(true);
    if (!result.rendered) {
      return;
    }

    expect(attributeOf(result.offlineData, 'shot', 'src')).toBe('https://cdn.example.com/photo.png');
  });
});

describe('the endpoint guard', () => {
  it('refuses the addresses that never name the public internet', () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.5',
      '192.168.1.10',
      '169.254.169.254',
      '172.16.0.1',
      '::1',
      'fd00::1'
    ]) {
      expect(isPrivateAddress(address)).toBe(true);
    }

    for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) {
      expect(isPrivateAddress(address)).toBe(false);
    }
  });

  it('refuses hostnames that resolve inside the deployment', async () => {
    expect(await isPublicHost('localhost')).toBe(false);
    expect(await isPublicHost('redis.default.svc.cluster.local')).toBe(false);
    expect(await isPublicHost('127.0.0.1')).toBe(false);
    expect(await isPublicHost('')).toBe(false);
  });
});
