import { INSTALL_COMMAND, NPM_URL, REPO_URL, STORE_DIR_URL } from '../../content';

const Footer = () => (
  <footer className="border-t border-ink-800">
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-sm">
        <div className="flex items-center gap-2.5 font-semibold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white">
            P
          </span>
          @plitzi/sdk-store
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-500">
          A tiny, type-safe React store built on useSyncExternalStore. Open source under the MIT license.
        </p>
        <code className="mt-4 inline-block rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 font-mono text-xs text-zinc-400">
          {INSTALL_COMMAND}
        </code>
      </div>

      <div className="flex gap-16">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Links</span>
          <a href={STORE_DIR_URL} target="_blank" rel="noreferrer" className="text-sm text-zinc-400 hover:text-white">
            Documentation
          </a>
          <a href={NPM_URL} target="_blank" rel="noreferrer" className="text-sm text-zinc-400 hover:text-white">
            npm
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-sm text-zinc-400 hover:text-white">
            GitHub
          </a>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Explore</span>
          <a href="#features" className="text-sm text-zinc-400 hover:text-white">
            Features
          </a>
          <a href="#api" className="text-sm text-zinc-400 hover:text-white">
            API
          </a>
          <a href="#demo" className="text-sm text-zinc-400 hover:text-white">
            Live Demo
          </a>
        </div>
      </div>
    </div>

    <div className="border-t border-ink-800/60">
      <div className="mx-auto max-w-6xl px-5 py-6 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} Plitzi. Built with @plitzi/sdk-store.
      </div>
    </div>
  </footer>
);

export default Footer;
