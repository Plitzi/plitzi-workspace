import { StoreProvider, loggerMiddleware } from '@plitzi/nexus';
import { useCallback, useState } from 'react';

import { setIdleAutoplay } from './heroAutoplay';
import { setDebug } from './heroDebug';
import { GAMES } from './heroGames';
import { pushLog } from './heroLog';
import { setLowPerf } from './heroPerf';
import { setMuted } from './heroSfx';
import { type HeroState, HERO_INITIAL } from './heroStore';
import GameSwitcher from './GameSwitcher';
import LogDock from './LogDock';
import Scoreboard from './Scoreboard';
import { GITHUB_URL, INSTALL_COMMAND } from '../../content';
import { GithubStars, NpmDownloads } from '../StatBadge';

// Wiring the logger once, at module scope, keeps the middleware array stable across renders. Its sink forwards every
// committed change to the on-screen log panel — the feature, demonstrated live.
const HERO_MIDDLEWARES = [loggerMiddleware<HeroState>(change => pushLog(change.path ?? '(root)', change.next))];

const Hero = () => {
  const [copied, setCopied] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [lowPerf, setLowPerfState] = useState(false);
  const [debug, setDebugState] = useState(false);
  const [autoIdle, setAutoIdleState] = useState(false);
  const [gameId, setGameId] = useState(GAMES[0].id);
  const active = GAMES.find(game => game.id === gameId) ?? GAMES[0];
  const ActiveGame = active.Component;

  const toggleMute = useCallback(() => {
    setMutedState(prev => {
      const next = !prev;
      setMuted(next);

      return next;
    });
  }, []);

  const togglePerf = useCallback(() => {
    setLowPerfState(prev => {
      const next = !prev;
      setLowPerf(next);

      return next;
    });
  }, []);

  const toggleDebug = useCallback(() => {
    setDebugState(prev => {
      const next = !prev;
      setDebug(next);

      return next;
    });
  }, []);

  const toggleAutoIdle = useCallback(() => {
    setAutoIdleState(prev => {
      const next = !prev;
      setIdleAutoplay(next);

      return next;
    });
  }, []);

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

      <StoreProvider value={HERO_INITIAL} middlewares={HERO_MIDDLEWARES}>
        {/* Full-bleed backdrop, but the playable area is shifted off the right edge so it reads as a centered, framed
            playfield. It stops short of the bottom so the controls sit in a clear strip below it, not over the game. */}
        <div className="absolute top-0 right-0 bottom-24 w-full lg:right-12 lg:w-[52%]">
          <ActiveGame key={gameId} />
          {/* Subtle side rails marking where the play area ends. */}
          <span className="pointer-events-none absolute inset-y-10 left-0 w-px bg-linear-to-b from-transparent via-brand-500/25 to-transparent" />
          <span className="pointer-events-none absolute inset-y-10 right-0 w-px bg-linear-to-b from-transparent via-brand-500/25 to-transparent" />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-ink-950 to-transparent" />

        {/* Scoreboard centered over the play area (canvas games only — 2048 carries its own). */}
        {!active.hideScoreboard && (
          <div className="pointer-events-none absolute top-16 right-0 z-10 flex w-full justify-center lg:right-12 lg:w-[52%]">
            <Scoreboard stats={active.stats} />
          </div>
        )}

        {/* Game switcher + the feature each game showcases + toggles, in the clear strip below the play area. */}
        <div className="pointer-events-none absolute right-0 bottom-4 z-10 flex w-full flex-col items-center gap-3 lg:right-12 lg:w-[52%]">
          <GameSwitcher games={GAMES} active={gameId} onSelect={setGameId} />
          <div className="pointer-events-auto flex items-center gap-2">
            <p className="mr-1 font-mono text-[11px] text-zinc-500">
              showcasing <span className="text-brand-300">{active.feature}</span>
            </p>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="border-ink-700 bg-ink-900/70 hover:border-brand-500 rounded-full border px-2 py-1 text-xs text-zinc-400 backdrop-blur transition hover:text-white"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              type="button"
              onClick={togglePerf}
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] backdrop-blur transition ${
                lowPerf
                  ? 'border-brand-500 bg-brand-500/15 text-brand-200'
                  : 'border-ink-700 bg-ink-900/70 text-zinc-400 hover:text-white'
              }`}
            >
              {lowPerf ? '30fps' : '60fps'}
            </button>
            <button
              type="button"
              onClick={toggleDebug}
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] backdrop-blur transition ${
                debug
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : 'border-ink-700 bg-ink-900/70 text-zinc-400 hover:text-white'
              }`}
            >
              debug
            </button>
            <button
              type="button"
              onClick={toggleAutoIdle}
              title="Let the AI take over when the cursor rests on the game"
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] backdrop-blur transition ${
                autoIdle
                  ? 'border-brand-500 bg-brand-500/15 text-brand-200'
                  : 'border-ink-700 bg-ink-900/70 text-zinc-400 hover:text-white'
              }`}
            >
              auto-idle
            </button>
          </div>
        </div>

        <LogDock />

        <div className="pointer-events-none relative z-10 mx-auto w-full max-w-400 px-6 py-28 lg:px-12">
          <div className="max-w-xl">
            <div className="pointer-events-auto border-ink-700 bg-ink-900/70 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
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
      </StoreProvider>
    </section>
  );
};

export default Hero;
