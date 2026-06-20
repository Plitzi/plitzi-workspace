import { StoreProvider, loggerMiddleware } from '@plitzi/nexus';
import { useCallback, useEffect, useRef, useState } from 'react';

import { setControl, toggleControl, useControl } from './arcadeControls';
import { GAMES } from './heroGames';
import { useArcadeKeys } from './heroKeys';
import { pushLog } from './heroLog';
import { type HeroState, HERO_INITIAL } from './heroStore';
import { setHeroVisible } from './heroVisibility';
import ArcadeMenu from './ArcadeMenu';
import GameSwitcher from './GameSwitcher';
import LogDock from './LogDock';
import PowerLegend from './PowerLegend';
import Scoreboard from './Scoreboard';
import { GITHUB_URL, INSTALL_COMMAND } from '../../content';
import { GithubStars, NpmDownloads } from '../StatBadge';

// Wiring the logger once, at module scope, keeps the middleware array stable across renders. Its sink forwards every
// committed change to the on-screen log panel — the feature, demonstrated live.
const HERO_MIDDLEWARES = [loggerMiddleware<HeroState>(change => pushLog(change.path ?? '(root)', change.next))];

const Hero = () => {
  const [copied, setCopied] = useState(false);
  // Every global toggle is read straight from the Nexus controls store, so the UI and the game loops share one source
  // of truth and each flip lands in the log panel.
  const muted = useControl('muted');
  const lowPerf = useControl('lowPerf');
  const debug = useControl('debug');
  const autoIdle = useControl('autoIdle');
  const paused = useControl('paused');
  const [gameId, setGameId] = useState(GAMES[0].id);
  // The hero lands on the arcade menu; a game only boots once the visitor picks a cabinet.
  const [playing, setPlaying] = useState(false);
  const active = GAMES.find(game => game.id === gameId) ?? GAMES[0];
  const ActiveGame = active.Component;
  const sectionRef = useRef<HTMLElement>(null);

  // Keyboard control is live while a game is on screen (accessibility).
  useArcadeKeys(playing);

  // Freeze the running game when the hero scrolls out of view — no off-screen game burns CPU/GPU.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(el);

    return () => {
      observer.disconnect();
      setHeroVisible(true);
    };
  }, []);

  const resume = useCallback(() => setControl('paused', false), []);

  const handlePlay = useCallback(
    (id: string) => {
      setGameId(id);
      setPlaying(true);
      resume();
    },
    [resume]
  );

  const handleExit = useCallback(() => {
    setPlaying(false);
    resume();
  }, [resume]);

  const handleSelect = useCallback(
    (id: string) => {
      setGameId(id);
      resume();
    },
    [resume]
  );

  const togglePause = useCallback(() => toggleControl('paused'), []);

  // 'P' toggles pause while a game is on screen.
  useEffect(() => {
    if (!playing) {
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'p' || e.key === 'P') && !e.repeat) {
        togglePause();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [playing, togglePause]);

  const toggleMute = useCallback(() => toggleControl('muted'), []);
  const togglePerf = useCallback(() => toggleControl('lowPerf'), []);
  const toggleDebug = useCallback(() => toggleControl('debug'), []);
  const toggleAutoIdle = useCallback(() => toggleControl('autoIdle'), []);

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
    <section
      ref={sectionRef}
      id="top"
      className="bg-noise relative flex min-h-[94vh] w-full items-center overflow-hidden"
    >
      <div className="hero-wash pointer-events-none absolute inset-0" />

      <StoreProvider value={HERO_INITIAL} middlewares={HERO_MIDDLEWARES}>
        {/* Full-bleed backdrop, but the playable area is shifted off the right edge so it reads as a centered, framed
            playfield. It stops short of the bottom so the controls sit in a clear strip below it, not over the game. */}
        <div className="absolute top-0 right-0 bottom-24 w-full lg:right-12 lg:w-[52%]">
          {playing ? <ActiveGame key={gameId} /> : <ArcadeMenu games={GAMES} onPlay={handlePlay} />}
          {/* Subtle side rails marking where the play area ends. */}
          <span className="pointer-events-none absolute inset-y-10 left-0 w-px bg-linear-to-b from-transparent via-brand-500/25 to-transparent" />
          <span className="pointer-events-none absolute inset-y-10 right-0 w-px bg-linear-to-b from-transparent via-brand-500/25 to-transparent" />

          {/* Paused overlay — clicking it resumes. */}
          {playing && paused && (
            <button
              type="button"
              onClick={togglePause}
              className="bg-ink-950/55 absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
            >
              <span className="text-brand-200 text-4xl">❚❚</span>
              <span className="font-mono text-xs tracking-[0.3em] text-zinc-300 uppercase">Paused</span>
              <span className="font-mono text-[10px] text-zinc-500">click or press P to resume</span>
            </button>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-ink-950 to-transparent" />

        {/* Power-up legend, pinned to the top-left of the play area for games that drop them. */}
        {playing && active.powerups && (
          <div className="pointer-events-none absolute top-16 right-0 z-10 flex w-full justify-start px-4 lg:right-12 lg:w-[52%]">
            <PowerLegend powerups={active.powerups} />
          </div>
        )}

        {/* Exit + pause, top-right of the play area. */}
        {playing && (
          <div className="pointer-events-none absolute top-4 right-0 z-40 flex w-full justify-end gap-2 px-4 lg:right-12 lg:w-[52%]">
            <button
              type="button"
              onClick={togglePause}
              aria-pressed={paused}
              aria-keyshortcuts="P"
              className="border-ink-700 bg-ink-900/70 hover:border-brand-500 pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] text-zinc-400 backdrop-blur transition hover:text-white"
            >
              {paused ? '▶ resume' : '❚❚ pause'}
              <kbd className="border-ink-600 bg-ink-800/80 rounded border px-1 text-[9px] text-zinc-500">P</kbd>
            </button>
            <button
              type="button"
              onClick={handleExit}
              className="border-ink-700 bg-ink-900/70 hover:border-brand-500 pointer-events-auto rounded-full border px-3 py-1 font-mono text-[11px] text-zinc-400 backdrop-blur transition hover:text-white"
            >
              ← arcade
            </button>
          </div>
        )}

        {/* Scoreboard centered over the play area (canvas games only — 2048 carries its own). */}
        {playing && !active.hideScoreboard && (
          <div className="pointer-events-none absolute top-16 right-0 z-10 flex w-full justify-center lg:right-12 lg:w-[52%]">
            <Scoreboard stats={active.stats} />
          </div>
        )}

        {/* Game switcher + the feature each game showcases + toggles, in the clear strip below the play area. */}
        {playing && (
        <div className="pointer-events-none absolute right-0 bottom-4 z-10 flex w-full flex-col items-center gap-3 lg:right-12 lg:w-[52%]">
          <GameSwitcher games={GAMES} active={gameId} onSelect={handleSelect} />
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
              aria-pressed={lowPerf}
              aria-label="Toggle 30fps low-performance mode"
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
              aria-pressed={debug}
              aria-label="Toggle debug render counters"
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
              aria-pressed={autoIdle}
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
        )}

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
