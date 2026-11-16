import { describe, expect, it } from 'vitest';

import { buildStaticSite, cssFilesOf, fileOf, linksOf } from './staticSite';

import type { FetchedPage } from './staticSite';

const encode = (text: string) => new TextEncoder().encode(text);
const html = (body: string): FetchedPage => ({ status: 200, type: 'text/html; charset=utf-8', body: encode(body) });

const SITE: Record<string, FetchedPage> = {
  '/': html(
    '<link rel="stylesheet" href="/_plitzi/style/a1.css"><script type="importmap">{"imports":{"react":"/sdk-assets/vendor.js?v=1"}}</script><a href="/menu">Menu</a><a href="https://elsewhere.com/x">x</a><img srcset="/img/a.png 1x, /img/b.png 2x">'
  ),
  '/menu': html('<a href="/blog/first-post#top">Post</a><a href="/">Home</a>'),
  '/blog/first-post': html('<p>Post</p>'),
  '/_plitzi/style/a1.css': { status: 200, type: 'text/css', body: encode('@font-face{src:url(../fonts/f.woff2)}') },
  '/_plitzi/fonts/f.woff2': { status: 200, type: 'font/woff2', body: new Uint8Array([1, 2]) },
  '/sdk-assets/vendor.js?v=1': { status: 200, type: 'text/javascript', body: encode('export {}') },
  '/img/a.png': { status: 200, type: 'image/png', body: new Uint8Array([1]) },
  '/img/b.png': { status: 200, type: 'image/png', body: new Uint8Array([2]) }
};

const fetchPage = (path: string): Promise<FetchedPage> =>
  Promise.resolve(SITE[path] ?? { status: 404, type: 'text/html', body: encode('<p>Not here</p>') });

describe('a site prerendered', () => {
  it('keeps every page it reaches by following links, and every file they load, at the paths they ask', async () => {
    const log: string[] = [];
    const site = await buildStaticSite({
      fetchPage,
      routes: ['/menu', '/blog/:slug', '/shop/:id'],
      log: line => log.push(line),
      version: 'production@3'
    });

    expect(site.files.map(file => file.path)).toEqual([
      '404.html',
      '_plitzi/fonts/f.woff2',
      '_plitzi/style/a1.css',
      'blog/first-post/index.html',
      'img/a.png',
      'img/b.png',
      'index.html',
      'menu/index.html',
      'sdk-assets/vendor.js'
    ]);
    expect(site.files.find(file => file.path === 'sdk-assets/vendor.js')?.cache).toBe('immutable');
    expect(site.unreached).toEqual(['/shop/:id']);
    expect(log.join('\n')).toContain('Not prerendered — no page links to an address of: /shop/:id');
  });

  it('is fingerprinted by what it holds: the same pages, the same fingerprint', async () => {
    const one = await buildStaticSite({ fetchPage, routes: [], log: () => undefined, version: 'production@3' });
    const two = await buildStaticSite({ fetchPage, routes: [], log: () => undefined, version: 'production@3' });

    expect(one.fingerprint.digest).toBe(two.fingerprint.digest);
  });

  it('names files by path, a page as its folder’s index', () => {
    expect(fileOf('/', true)).toBe('index.html');
    expect(fileOf('/menu/', true)).toBe('menu/index.html');
    expect(fileOf('/a.js?v=2', false)).toBe('a.js');
  });

  it('reads the links and files of a page, and the files of a stylesheet', () => {
    expect(linksOf('<a href="/x?y=1">x</a><script src="/s.js"></script><a href="//cdn.com/a">a</a>')).toEqual({
      pages: ['/x?y=1'],
      files: ['/s.js']
    });
    expect(
      cssFilesOf('a{background:url("/i.png")} b{background:url(data:x)} @import "./c.css";', '/css/a.css')
    ).toEqual(['/i.png', '/css/c.css']);
  });
});
