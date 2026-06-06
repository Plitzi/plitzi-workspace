import { useEffect, useMemo, useState } from 'react';

import { DOCS_META } from '../../docsMeta';
import useMeta from '../../useMeta';
import { DOCS_SEARCH_INDEX } from './docsSearchIndex';
import ApiReference from './pages/ApiReference';
import Faq from './pages/Faq';
import GettingStarted from './pages/GettingStarted';
import GuidesDataFetching from './pages/GuidesDataFetching';
import GuidesForms from './pages/GuidesForms';
import GuidesNextJs from './pages/GuidesNextJs';
import Migration from './pages/Migration';
import Testing from './pages/Testing';

import type { ComponentType } from 'react';

type DocPageSection = { id: string; label: string };

type DocPage = {
  slug: string;
  label: string;
  Component: ComponentType;
  sections?: DocPageSection[];
  group?: string;
};

const PAGES: DocPage[] = [
  { slug: 'getting-started', label: 'Getting Started', Component: GettingStarted },
  { slug: 'api', label: 'API Reference', Component: ApiReference },
  {
    slug: 'guides-forms',
    label: 'Forms',
    Component: GuidesForms,
    group: 'Patterns',
    sections: [
      { id: 'simple-field', label: 'Simple field' },
      { id: 'nested-fields', label: 'Nested fields & arrays' },
      { id: 'validation', label: 'Validation & errors' },
      { id: 'submit', label: 'Submit & dirty detect' }
    ]
  },
  {
    slug: 'guides-data-fetching',
    label: 'Data Fetching',
    Component: GuidesDataFetching,
    group: 'Patterns',
    sections: [
      { id: 'basic-fetch', label: 'Basic fetch' },
      { id: 'race-conditions', label: 'Race conditions' },
      { id: 'dependent-queries', label: 'Dependent queries' },
      { id: 'mutation', label: 'Mutations' }
    ]
  },
  {
    slug: 'guides-nextjs',
    label: 'Next.js',
    Component: GuidesNextJs,
    group: 'Patterns',
    sections: [
      { id: 'app-router', label: 'App Router' },
      { id: 'server-data', label: 'Hydrating from server' },
      { id: 'persistence', label: 'Client persistence' },
      { id: 'server-actions', label: 'Server Actions' }
    ]
  },
  {
    slug: 'migration',
    label: 'Migration',
    Component: Migration,
    sections: [
      { id: 'from-zustand', label: 'From Zustand' },
      { id: 'from-redux', label: 'From Redux / RTK' },
      { id: 'from-jotai-valtio', label: 'From Jotai / Valtio' },
      { id: 'from-mobx', label: 'From MobX' },
      { id: 'from-context', label: 'From React Context' },
      { id: 'general-checklist', label: 'General checklist' }
    ]
  },
  { slug: 'testing', label: 'Testing', Component: Testing },
  { slug: 'faq', label: 'FAQ & Troubleshooting', Component: Faq }
];

export const DOCS_HOME = `#/docs/${PAGES[0].slug}`;

const searchPages = (query: string): typeof PAGES => {
  if (!query.trim()) {
    return PAGES;
  }

  const lower = query.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  return PAGES.filter(page => {
    const entry = DOCS_SEARCH_INDEX.find(e => e.slug === page.slug);
    if (!entry) {
      return false;
    }

    return words.every(
      word =>
        entry.label.toLowerCase().includes(word) ||
        entry.description.toLowerCase().includes(word) ||
        entry.keywords.some(k => k.toLowerCase().includes(word))
    );
  });
};

// `hash` is the full location hash, e.g. `#/docs/api` or `#/docs/migration?anchor=from-mobx`.
// The slug is the segment after `/docs/`; an `?anchor=` query param triggers an in-page scroll.
const Docs = ({ hash }: { hash: string }) => {
  const [base, query] = hash.split('?');
  const slug = base.replace(/^#\/docs\/?/, '') || PAGES[0].slug;
  const active = PAGES.find(page => page.slug === slug) ?? PAGES[0];
  const ActivePage = active.Component;
  const anchor = query?.startsWith('anchor=') ? query.slice(7) : undefined;

  useMeta(DOCS_META[active.slug] ?? { title: active.label, description: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [visibleSection, setVisibleSection] = useState<string | undefined>(anchor);

  const filteredPages = useMemo(() => searchPages(searchQuery), [searchQuery]);

  // Agrupa páginas por `group`, respetando el orden del array original.
  const groups = useMemo(() => {
    const standalone: DocPage[] = [];
    const groupMap = new Map<string, DocPage[]>();

    for (const page of filteredPages) {
      if (page.group) {
        const list = groupMap.get(page.group);
        if (list) {
          list.push(page);
        } else {
          groupMap.set(page.group, [page]);
        }
      } else {
        standalone.push(page);
      }
    }

    return { standalone, groupMap };
  }, [filteredPages]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setVisibleSection(undefined);
  }, [active.slug]);

  // Scroll spy: IntersectionObserver marca la sección visible en el sidebar.
  useEffect(() => {
    const sections = active.sections;
    if (!sections || sections.length === 0) {
      return;
    }

    const ids = sections.map(s => s.id);
    const elements = ids.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        let best: string | undefined;
        let bestTop = Infinity;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.boundingClientRect.top < bestTop) {
            bestTop = entry.boundingClientRect.top;
            best = entry.target.id;
          }
        }

        if (best) {
          setVisibleSection(best);
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (anchor) {
      const id = setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      return () => clearTimeout(id);
    }
  }, [anchor]);

  const isGroupActive = (label: string) => {
    const groupPages = groups.groupMap.get(label);
    return groupPages?.some(p => p.slug === active.slug) ?? false;
  };

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
            <span className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-zinc-600 uppercase">
              Docs
            </span>

            <div className="relative mb-2 px-3">
              <svg
                className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                placeholder="Search docs…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-ink-700 bg-ink-900 py-1.5 pl-8 pr-3 text-sm text-zinc-300 placeholder-zinc-600 transition focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            {/* Páginas standalone */}
            {groups.standalone.map(page => (
              <div key={page.slug}>
                <a
                  href={`#/docs/${page.slug}`}
                  aria-current={page.slug === active.slug ? 'page' : undefined}
                  className={`block ${
                    page.slug === active.slug
                      ? 'bg-ink-800 rounded-lg px-3 py-1.5 text-sm font-medium text-white'
                      : 'hover:bg-ink-900 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:text-white'
                  }`}
                >
                  {page.label}
                </a>

                {page.slug === active.slug && page.sections && (
                  <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-ink-700 pl-2">
                    {page.sections.map(section => (
                      <a
                        key={section.id}
                        href={`#/docs/${page.slug}?anchor=${section.id}`}
                        aria-current={section.id === visibleSection ? 'true' : undefined}
                        className={
                          section.id === visibleSection
                            ? 'rounded px-2 py-1 text-xs font-medium text-brand-300'
                            : 'rounded px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-ink-900 hover:text-zinc-300'
                        }
                      >
                        {section.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Grupos — se despliegan solo cuando una página del grupo está activa (como Migration) */}
            {Array.from(groups.groupMap.entries()).map(([groupLabel, pages]) => {
              const groupActive = isGroupActive(groupLabel);

              const firstSlug = pages[0].slug;

              return (
                <div key={groupLabel}>
                  <a
                    href={`#/docs/${firstSlug}`}
                    className={`block rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      groupActive
                        ? 'bg-ink-800 text-white'
                        : 'text-zinc-400 hover:bg-ink-900 hover:text-white'
                    }`}
                  >
                    {groupLabel}
                  </a>

                  {groupActive && (
                    <div className="ml-2 flex flex-col gap-0.5 border-l border-ink-700 pl-2">
                      {pages.map(page => {
                        const isActive = page.slug === active.slug;

                        return (
                          <div key={page.slug}>
                            <a
                              href={`#/docs/${page.slug}`}
                              aria-current={isActive ? 'page' : undefined}
                              className={`rounded px-2 py-1 text-xs font-medium transition ${
                                isActive
                                  ? 'text-brand-300'
                                  : 'text-zinc-500 hover:bg-ink-900 hover:text-zinc-300'
                              }`}
                            >
                              {page.label}
                            </a>

                            {isActive && page.sections && (
                              <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-ink-800 pl-2">
                                {page.sections.map(section => (
                                  <a
                                    key={section.id}
                                    href={`#/docs/${page.slug}?anchor=${section.id}`}
                                    aria-current={section.id === visibleSection ? 'true' : undefined}
                                    className={
                                      section.id === visibleSection
                                        ? 'rounded px-2 py-1 text-xs font-medium text-brand-200'
                                        : 'rounded px-2 py-1 text-xs font-medium text-zinc-600 transition hover:text-zinc-400'
                                    }
                                  >
                                    {section.label}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredPages.length === 0 && (
              <p className="px-3 text-xs text-zinc-500">No results for &quot;{searchQuery}&quot;</p>
            )}
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
