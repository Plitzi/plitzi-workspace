import { useEffect, useState } from 'react';

import { DOCS_HOME } from '../Docs';
import Logo from '../Logo';
import ThemeToggle from '../ThemeToggle';
import { NAV_LINKS, NPM_URL, REPO_URL } from '../../content';
import { useHashRoute } from '../../useHashRoute';

const Nav = () => {
  const [activeId, setActiveId] = useState('');
  const hash = useHashRoute();
  const onDocs = hash.startsWith('#/docs');

  useEffect(() => {
    const sections = NAV_LINKS.map(link => document.getElementById(link.href.slice(1))).filter(
      (el): el is HTMLElement => el !== null
    );

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      // Mark a section active once its middle band crosses the viewport center.
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.5, 1] }
    );

    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <header className="border-ink-700/60 bg-ink-950/70 sticky top-0 z-50 border-b backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2.5 font-semibold text-white">
          <Logo size={32} className="drop-shadow-md" />
          <span className="text-sm">@plitzi/nexus</span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              aria-current={!onDocs && activeId === link.href.slice(1) ? 'true' : undefined}
              className={
                !onDocs && activeId === link.href.slice(1)
                  ? 'bg-ink-800 rounded-lg px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:text-white'
              }
            >
              {link.label}
            </a>
          ))}
          <a
            href={DOCS_HOME}
            aria-current={onDocs ? 'true' : undefined}
            className={
              onDocs
                ? 'bg-ink-800 rounded-lg px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:text-white'
            }
          >
            Docs
          </a>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:text-white sm:block"
          >
            npm
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="border-ink-600 bg-ink-800 hover:border-brand-500 hover:bg-ink-700 rounded-lg border px-3.5 py-1.5 text-sm font-medium text-white transition"
          >
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
};

export default Nav;
