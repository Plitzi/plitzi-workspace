import { loggerMiddleware } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { setControl, toggleControl, useControl } from './arcadeControls';
import { purgeArcadeData } from './arcadePersist';
import { GAMES } from './heroGames';
import { useArcadeKeys } from './heroKeys';
import { pushLog } from './heroLog';
import { type HeroState, HERO_INITIAL } from './heroStore';
import { setHeroVisible } from './heroVisibility';
import ArcadeMenu from './ArcadeMenu';
import GameCanvas from './GameCanvas';
import GameSwitcher from './GameSwitcher';
import PowerLegend from './PowerLegend';
import Scoreboard from './Scoreboard';

// Wiring the logger once, at module scope, keeps the middleware array stable across renders. Its sink forwards every
// committed change to the on-screen log panel — the feature, demonstrated live.
const HERO_MIDDLEWARES = [loggerMiddleware<HeroState>(change => pushLog(change.path ?? '(root)', change.next))];

// The whole arcade as one self-contained, movable component: it owns the cabinet menu, the active game, the scoreboard,
// the switcher and every global toggle, all positioned relative to its own box. Drop it into any sized container. The
// shared Nexus store lives here too, so the scoreboard and the game engines read/write one source of truth.
const Arcade = () => {
  // Every global toggle is read straight from the Nexus controls store, so the UI and the game loops share one source
  // of truth and each flip lands in the log panel.
  const muted = useControl('muted');
  const lowPerf = useControl('lowPerf');
  const debug = useControl('debug');
  const autoIdle = useControl('autoIdle');
  const paused = useControl('paused');
  const [gameId, setGameId] = useState(GAMES[0].id);
  // The arcade lands on the cabinet menu; a game only boots once the visitor picks one.
  const [playing, setPlaying] = useState(false);
  const active = GAMES.find(game => game.id === gameId) ?? GAMES[0];
  const rootRef = useRef<HTMLDivElement>(null);

  // Keyboard control is live while a game is on screen (accessibility).
  useArcadeKeys(playing);

  // Freeze the running game when the arcade scrolls out of view — no off-screen game burns CPU/GPU.
  useEffect(() => {
    const el = rootRef.current;
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

  // Wipes every persisted store (settings, scores, saved games, the reactor) and reloads.
  const purgeData = useCallback(() => {
    if (window.confirm('Clear all saved arcade data — settings, scores and saved games?')) {
      purgeArcadeData();
    }
  }, []);

  // Canvas games run through the shared GameCanvas host; self-contained games render their own component. Keyed by id so
  // switching cabinets remounts the engine.
  const gameNode =
    'engine' in active ? <GameCanvas key={gameId} engine={active.engine} /> : <active.Component key={gameId} />;

  return (
    <StoreProvider value={HERO_INITIAL} middlewares={HERO_MIDDLEWARES}>
      <div ref={rootRef} className="relative h-full w-full">
        {/* Playfield, stopping short of the bottom so the switcher + toggles sit in a clear strip below it. */}
        <div className="absolute inset-x-0 top-0 bottom-24">
          {playing ? gameNode : <ArcadeMenu games={GAMES} onPlay={handlePlay} onPurge={purgeData} />}
          {/* Subtle side rails marking where the play area ends. */}
          <span className="via-brand-500/25 pointer-events-none absolute inset-y-10 left-0 w-px bg-linear-to-b from-transparent to-transparent" />
          <span className="via-brand-500/25 pointer-events-none absolute inset-y-10 right-0 w-px bg-linear-to-b from-transparent to-transparent" />

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

        {/* Power-up legend, pinned to the top-left for games that drop them. */}
        {playing && active.powerups && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-start px-4">
            <PowerLegend powerups={active.powerups} />
          </div>
        )}

        {/* Exit + pause, top-right. */}
        {playing && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-end gap-2 px-4">
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

        {/* Scoreboard centered over the play area (canvas games only — others carry their own). */}
        {playing && !active.hideScoreboard && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center">
            <Scoreboard stats={active.stats} />
          </div>
        )}

        {/* Game switcher + the feature each game showcases + toggles, in the clear strip below the play area. */}
        {playing && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-3">
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
      </div>
    </StoreProvider>
  );
};

export default Arcade;
