/* eslint-disable no-console */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { USE_CASES } from '../src/content';
import ApiReference from '../src/components/Docs/pages/ApiReference';
import ChoosingApi from '../src/components/Docs/pages/ChoosingApi';
import Faq from '../src/components/Docs/pages/Faq';
import GettingStarted from '../src/components/Docs/pages/GettingStarted';
import GuidesDataFetching from '../src/components/Docs/pages/GuidesDataFetching';
import GuidesForms from '../src/components/Docs/pages/GuidesForms';
import Migration from '../src/components/Docs/pages/Migration';
import Testing from '../src/components/Docs/pages/Testing';
import NextJs from '../src/components/Docs/pages/frameworks/NextJs';
import RscSsr from '../src/components/Docs/pages/frameworks/RscSsr';

import type { ComponentType } from 'react';

// A dependency-free render + cross-reference check (run with `npm run check:docs`). It renders every docs page to
// static markup (catching render-time throws) and verifies that every deep-link into the "Choosing the right API"
// guide — from the landing use-case band, from the API Reference cross-links, and from the page's own table of
// contents — points to an anchor that actually exists. Broken `?anchor=` links are otherwise invisible until a user
// clicks one.

const ALL_PAGES: Record<string, ComponentType> = {
  'getting-started': GettingStarted,
  choosing: ChoosingApi,
  api: ApiReference,
  'guides-forms': GuidesForms,
  'guides-data-fetching': GuidesDataFetching,
  'frameworks-rsc-ssr': RscSsr,
  'guides-nextjs': NextJs,
  migration: Migration,
  testing: Testing,
  faq: Faq
};

// Section ids the docs sidebar declares for the "choosing" page (kept in sync with Docs.tsx by this check).
const CHOOSING_TOC = ['reading', 'writing', 'collections', 'multiple-stores', 'async', 'cross-cutting', 'cheatsheet'];

const render = (Component: ComponentType): string => renderToStaticMarkup(createElement(Component));

const idsIn = (markup: string): Set<string> => {
  const ids = new Set<string>();
  for (const match of markup.matchAll(/id="([^"]+)"/g)) {
    ids.add(match[1]);
  }

  return ids;
};

const choosingAnchorsIn = (markup: string): string[] => {
  const anchors: string[] = [];
  for (const match of markup.matchAll(/#\/docs\/choosing\?anchor=([a-z-]+)/g)) {
    anchors.push(match[1]);
  }

  return anchors;
};

const errors: string[] = [];

// 1. Every page renders without throwing.
const rendered = new Map<string, string>();
for (const [slug, Component] of Object.entries(ALL_PAGES)) {
  try {
    rendered.set(slug, render(Component));
  } catch (err) {
    errors.push(`page "${slug}" failed to render: ${String(err)}`);
  }
}

const choosingMarkup = rendered.get('choosing') ?? '';
const choosingIds = idsIn(choosingMarkup);

// 2. The choosing page exposes every anchor its own sidebar TOC links to.
for (const id of CHOOSING_TOC) {
  if (!choosingIds.has(id)) {
    errors.push(`Docs.tsx lists choosing section "${id}" but ChoosingApi has no element with that id`);
  }
}

// 3. Every landing use-case card links to a real anchor.
for (const useCase of USE_CASES) {
  if (!choosingIds.has(useCase.anchor)) {
    errors.push(`USE_CASES "${useCase.job}" → #${useCase.anchor} does not exist in ChoosingApi`);
  }
}

// 4. Every API Reference cross-link points to a real anchor.
for (const anchor of choosingAnchorsIn(rendered.get('api') ?? '')) {
  if (!choosingIds.has(anchor)) {
    errors.push(`ApiReference cross-link → #${anchor} does not exist in ChoosingApi`);
  }
}

if (errors.length > 0) {
  console.error(`\n✗ docs check failed (${errors.length}):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }

  process.exit(1);
}

console.log(`✓ docs check passed — ${rendered.size} pages render; choosing anchors all resolve.`);
