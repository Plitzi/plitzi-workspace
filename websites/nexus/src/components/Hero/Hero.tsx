import { useCallback, useState } from 'react';

import Arcade from './Arcade';
import LogDock from './LogDock';
import { GITHUB_URL, INSTALL_COMMAND } from '../../content';
import { GithubStars, NpmDownloads } from '../StatBadge';

const Hero = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(INSTALL_COMMAND)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  }, []);

  return (
    <section id="top" className="bg-noise relative flex min-h-[94vh] w-full items-center overflow-hidden">
      <div className="hero-wash pointer-events-none absolute inset-0" />

      {/* The arcade is one self-contained, movable component. Here it sits in the right column, shifted off the edge so
          it reads as a centered, framed playfield; drop it into any sized container and it fills it. */}
      <div className="absolute top-0 right-0 bottom-0 w-full lg:right-12 lg:w-[52%]">
        <Arcade />
      </div>

      <div className="from-ink-950 pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t to-transparent" />

      <LogDock />

      <div className="pointer-events-none relative z-10 mx-auto w-full max-w-400 px-6 py-28 lg:px-12">
        <div className="max-w-xl">
          <div className="border-ink-700 bg-ink-900/70 pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
            <span className="live-dot bg-brand-400 h-1.5 w-1.5 rounded-full" />
            Next-generation state management
          </div>

          <h1 className="mt-6 text-5xl leading-[0.95] font-extrabold tracking-tight text-white sm:text-6xl xl:text-7xl">
            Give your state
            <br />
            <span className="text-gradient">an address.</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-300/90">
            Reach any value by its path — get it, set it, watch it — and re-render only what changed. One model from a
            vanilla store to React. This whole arcade is <span className="text-white">a single Nexus store</span>: the
            scoreboard reads it, the logger streams every write.
          </p>

          <div className="pointer-events-auto mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="#core-api"
              className="bg-brand-600 shadow-brand-900/50 hover:bg-brand-500 rounded-xl px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
            >
              Start building →
            </a>
            <button
              onClick={handleCopy}
              className="group border-ink-600 bg-ink-900/70 hover:border-brand-500 flex items-center gap-3 rounded-xl border px-4 py-3.5 font-mono text-sm text-zinc-200 backdrop-blur transition"
            >
              <span className="text-brand-400">$</span>
              {INSTALL_COMMAND}
              <span className="group-hover:text-brand-300 ml-1 text-xs text-zinc-500">
                {copied ? 'copied!' : 'copy'}
              </span>
            </button>
          </div>

          <div className="pointer-events-auto mt-8 flex flex-wrap items-center gap-3">
            <GithubStars />
            <NpmDownloads />
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-zinc-500 transition hover:text-zinc-300"
            >
              View source →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
