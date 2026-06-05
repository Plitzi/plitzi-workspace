import { useEffect, useState } from 'react';

import { NAV_LINKS, NPM_URL, REPO_URL } from '../../content';

const Nav = () => {
  const [activeId, setActiveId] = useState('');

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
    <header className="sticky top-0 z-50 border-b border-ink-700/60 bg-ink-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2.5 font-semibold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-400 to-brand-700 text-sm font-bold text-white shadow-lg">
            P
          </span>
          <span className="text-sm">
            sdk-store<span className="text-zinc-500"> / plitzi</span>
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              aria-current={activeId === link.href.slice(1) ? 'true' : undefined}
              className={
                activeId === link.href.slice(1)
                  ? 'rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:text-white'
              }
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
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
            className="rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-1.5 text-sm font-medium text-white transition hover:border-brand-500 hover:bg-ink-700"
          >
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
};

export default Nav;
