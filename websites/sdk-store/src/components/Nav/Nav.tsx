import { NAV_LINKS, NPM_URL, REPO_URL } from '../../content';

const Nav = () => (
  <header className="border-ink-700/60 bg-ink-950/70 sticky top-0 z-50 border-b backdrop-blur-xl">
    <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
      <a href="#top" className="flex items-center gap-2.5 font-semibold text-white">
        <span className="from-brand-400 to-brand-700 flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br text-sm font-bold text-white shadow-lg">
          P
        </span>
        <span className="text-sm">
          sdk-store<span className="text-zinc-500"> / plitzi</span>
        </span>
      </a>

      <div className="hidden items-center gap-7 md:flex">
        {NAV_LINKS.map(link => (
          <a key={link.href} href={link.href} className="text-sm font-medium text-zinc-400 transition hover:text-white">
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
          className="border-ink-600 bg-ink-800 hover:border-brand-500 hover:bg-ink-700 rounded-lg border px-3.5 py-1.5 text-sm font-medium text-white transition"
        >
          GitHub
        </a>
      </div>
    </nav>
  </header>
);

export default Nav;
