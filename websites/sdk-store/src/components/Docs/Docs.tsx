import { useEffect } from 'react';

import ApiReference from './pages/ApiReference';
import Faq from './pages/Faq';
import GettingStarted from './pages/GettingStarted';
import Migration from './pages/Migration';
import Testing from './pages/Testing';

import type { ComponentType } from 'react';

type DocPage = { slug: string; label: string; Component: ComponentType };

const PAGES: DocPage[] = [
  { slug: 'getting-started', label: 'Getting Started', Component: GettingStarted },
  { slug: 'api', label: 'API Reference', Component: ApiReference },
  { slug: 'testing', label: 'Testing', Component: Testing },
  { slug: 'faq', label: 'FAQ & Troubleshooting', Component: Faq },
  { slug: 'migration', label: 'Migration', Component: Migration }
];

export const DOCS_HOME = `#/docs/${PAGES[0].slug}`;

// `hash` is the full location hash, e.g. `#/docs/api`. The slug is the segment after `/docs/`.
const Docs = ({ hash }: { hash: string }) => {
  const slug = hash.replace(/^#\/docs\/?/, '') || PAGES[0].slug;
  const active = PAGES.find(page => page.slug === slug) ?? PAGES[0];
  const ActivePage = active.Component;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [active.slug]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="grid gap-10 md:grid-cols-[14rem_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <a
            href="#top"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-white"
          >
            ← Back to home
          </a>
          <nav className="flex flex-col gap-0.5">
            <span className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-zinc-600 uppercase">Docs</span>
            {PAGES.map(page => (
              <a
                key={page.slug}
                href={`#/docs/${page.slug}`}
                aria-current={page.slug === active.slug ? 'page' : undefined}
                className={
                  page.slug === active.slug
                    ? 'bg-ink-800 rounded-lg px-3 py-1.5 text-sm font-medium text-white'
                    : 'hover:bg-ink-900 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:text-white'
                }
              >
                {page.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">{active.label}</h1>
          <ActivePage />
        </article>
      </div>
    </main>
  );
};

export default Docs;
