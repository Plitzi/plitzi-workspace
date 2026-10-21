/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** Pages, folders, layouts and links. */
export const PAGE_CODES = {
  'page-without-slug': {
    kind: 'refused',
    means: 'a page with no `slug`',
    fix: "`slug: ''` for the home page, its path for any other: `'about'`, `'blog/:slug'`"
  },
  'page-route-taken': {
    kind: 'refused',
    means: 'two pages at one address for the same visitors',
    fix: "another slug — or `accessLevel` `'public'` on one and `'authenticated'` on the other"
  },
  'page-route-reserved': {
    kind: 'refused',
    means: "a page under `/fn`, where the space's functions answer",
    fix: 'another slug'
  },
  'page-access-level': {
    kind: 'refused',
    means: 'an `accessLevel` that is not one the router reads',
    fix: 'one of the values the message lists'
  },
  'page-access': {
    kind: 'refused',
    means: 'a page `access` the server cannot keep: no permissions, or one that is not a name',
    fix: "`access: { permissions: ['…'] }` with at least one permission name, or no `access` for a page anybody may see"
  },
  'page-target-unknown': {
    kind: 'refused',
    means: 'a link or `navigate` to a page id that does not exist',
    fix: "an existing page id, or a path with its slash (`'/about'`)"
  },
  'page-path-unknown': {
    kind: 'warned',
    means: 'a link or `navigate` to a path no page of the space answers — a page not made yet, or a typo',
    fix: "a path a page answers (its folder and slug), the page's id, or `mode: 'external'` for one the server answers itself"
  },
  'page-target-url': {
    kind: 'refused',
    means: 'a URL, `mailto:` or `tel:` in a link left in page mode',
    fix: "`mode: 'external'`"
  },
  'redirect-target-unknown': {
    kind: 'refused',
    means: 'a page that sends visitors it is not for to a page the space does not have',
    fix: "a page's id or slug (`''` is the home page), or a full URL"
  },
  'robots-unknown': {
    kind: 'refused',
    means: "a page's `robots` with a directive no search engine reads, or none",
    fix: "`robots: 'noindex'`, `'noindex, nofollow'` — or leave it out, and the page is indexed"
  },
  'robots-txt-line': {
    kind: 'refused',
    means: "a line of the space's `settings.robotsTxt` that no crawler reads, or one with no `User-agent`",
    fix: "`User-agent: *` then `Allow: /`, `Disallow: /overlay` — each line `Field: value`, or a comment"
  },
  'structured-data-shape': {
    kind: 'refused',
    means: "a page's `structuredData` item with no `@context` or `@type`, or a value JSON cannot carry",
    fix: "`structuredData: { '@context': 'https://schema.org', '@type': 'SportsEvent', name: '…' }`"
  },
  'page-template': {
    kind: 'refused',
    means:
      "a template in a page's `seoTitle`, `seoDescription`, `notFound` or a text of its `structuredData` that reads what is not there when the server answers — anything but the page's `runtime: 'server'` providers and `navigation` — or cannot be read",
    fix: "read the record from a provider with `runtime: 'server'` on the page or its layout — `'{{ apiContainer_post.title }} — Blog'` — or words of its own"
  },
  'declared-callback-target': {
    kind: 'refused',
    means:
      'a `declaredCallback` target with a key beside `on` and `params` — read nowhere, so the step runs without it',
    fix: "the value in `params`: `{ on: 'calendar', params: { date } }`"
  },
  'folder-undeclared': {
    kind: 'refused',
    means: 'a page, a layout or a folder filed in a folder the space does not declare',
    fix: "declare it on the space — `pageFolders: [{ id: 'docs', name: 'Docs' }]`, its slug starting its pages' addresses — or use the name it suggests"
  },
  'page-nav-invalid': {
    kind: 'refused',
    means: "a page's `nav` without a label, with an order that is no number, or on a page with no one address to list",
    fix: "`nav: { label: 'Pets', order: 3 }` on a page whose path takes no param — a page per record is reached from its list"
  },
  'folder-cycle': {
    kind: 'refused',
    means: 'a page folder inside itself',
    fix: 'a `parent` that leads to the top'
  },
  'layout-undeclared': {
    kind: 'refused',
    means: 'a page or a layout inside a layout the space does not declare',
    fix: "the layout's id, or declare it in `layouts`"
  },
  'layout-slot-unknown': {
    kind: 'refused',
    means: 'a layout `slot` that is not an element inside that layout',
    fix: 'the id of the element in the shell where the body goes'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
