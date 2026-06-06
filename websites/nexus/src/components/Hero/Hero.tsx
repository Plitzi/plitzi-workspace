import { useCallback, useState } from 'react';

import { INSTALL_COMMAND, NPM_URL, REPO_URL } from '../../content';
import CodeBlock from '../CodeBlock';
import Logo from '../Logo';

const HERO_SNIPPET = `import { createStoreHook } from '@plitzi/nexus';

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
      <div className="bg-grid absolute inset-0 mask-[radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="aura absolute top-0 left-1/2 -z-10 h-120 w-205 -translate-x-1/2 rounded-full opacity-25 blur-[120px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <Logo size={64} className="mb-6 drop-shadow-[0_8px_24px_rgba(124,58,237,0.45)]" />

          <a
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            className="border-ink-600 bg-ink-800/60 hover:border-brand-500 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-zinc-300 transition"
          >
            <span className="bg-brand-400 h-1.5 w-1.5 rounded-full" />
            MIT licensed
          </a>

          <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            The type-safe
            <br />
            <span className="text-gradient">React store</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-400">
            Subscribe to a{' '}
            <code className="bg-ink-800 text-brand-300 rounded px-1.5 py-0.5 font-mono text-sm">dot-path</code> and
            re-render only when it changes. Scoped stores, time-travel, derived values, persistence and a middleware
            pipeline — zero boilerplate, end-to-end typed, on React’s own{' '}
            <code className="bg-ink-800 text-brand-300 rounded px-1.5 py-0.5 font-mono text-sm">
              useSyncExternalStore
            </code>
            .
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              'Path subscriptions',
              'Scoped stores',
              'Derived values',
              'Async / Suspense',
              'Persistence',
              'Time-travel',
              'Middleware',
              'Batching'
            ].map(pill => (
              <span
                key={pill}
                className="border-ink-700 bg-ink-900/60 rounded-full border px-3 py-1 text-xs font-medium text-zinc-400"
              >
                {pill}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleCopyInstall}
              className="group border-ink-600 bg-ink-900 hover:border-brand-500 flex items-center gap-3 rounded-xl border px-4 py-3 font-mono text-sm text-zinc-200 transition"
            >
              <span className="text-brand-400">$</span>
              {INSTALL_COMMAND}
              <span className="group-hover:text-brand-300 ml-1 text-xs text-zinc-500">
                {copied ? 'copied!' : 'copy'}
              </span>
            </button>
            <a
              href="#demo"
              className="bg-brand-600 shadow-brand-900/40 hover:bg-brand-500 rounded-xl px-5 py-3 text-center text-sm font-semibold text-white shadow-lg transition"
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
