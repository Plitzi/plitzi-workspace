import { useCallback, useState } from 'react';

import { INSTALL_COMMAND, NPM_URL, REPO_URL } from '../../content';
import CodeBlock from '../CodeBlock';

const HERO_SNIPPET = `import { createStoreHook } from '@plitzi/sdk-store';

const { useStore } = createStoreHook<State>();

function Counter() {
  // Re-renders only when \`count\` changes
  const [count, setCount] = useStore('count');

  return (
    <button onClick={() => setCount(c => c + 1)}>
      count is {count}
    </button>
  );
}`;

const Hero = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyInstall = useCallback(() => {
    navigator.clipboard
      .writeText(INSTALL_COMMAND)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  }, []);

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-brand-700/20 blur-[120px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <a
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-800/60 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-brand-500"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Part of the Plitzi SDK · MIT licensed
          </a>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            A tiny, type-safe
            <br />
            <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-brand-600 bg-clip-text text-transparent">
              React store
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-400">
            Built on <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-sm text-brand-300">
              useSyncExternalStore
            </code>. Path-based subscriptions, scoped stores, and time-travel — with zero boilerplate and end-to-end
            type safety.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleCopyInstall}
              className="group flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 font-mono text-sm text-zinc-200 transition hover:border-brand-500"
            >
              <span className="text-brand-400">$</span>
              {INSTALL_COMMAND}
              <span className="ml-1 text-xs text-zinc-500 group-hover:text-brand-300">
                {copied ? 'copied!' : 'copy'}
              </span>
            </button>
            <a
              href="#demo"
              className="rounded-xl bg-brand-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-brand-900/40 transition hover:bg-brand-500"
            >
              See it live →
            </a>
          </div>

          <div className="mt-8 flex items-center gap-6 text-sm text-zinc-500">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition hover:text-zinc-300">
              ★ Star on GitHub
            </a>
            <span>React 19 · ESM · SSR-ready · ~0 deps</span>
          </div>
        </div>

        <div className="relative">
          <div className="glow rounded-2xl">
            <CodeBlock code={HERO_SNIPPET} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
