import { createEntityStore } from '@plitzi/nexus';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useDebug, useRenderCount } from './heroDebug';
import { isPaused } from './heroPause';
import { pushLog } from './heroLog';
import { sfx } from './heroSfx';

import type { EntityStore } from '@plitzi/nexus';

// Mole Hunt showcases `createEntityStore`: each tile is an entity in a normalized collection. Activating or clearing
// one wakes only that tile's `useOne` subscriber — O(1). `Cell` is `memo`'d so a parent render (score/timer ticking)
// never touches it; with debug on you can watch a single tile's render count climb while its 19 neighbours stay
// frozen. Reactivity proven, not claimed.
type MoleKind = 'mole' | 'bomb';
type MoleCell = { id: string; active: boolean; until: number; kind: MoleKind };

const GRID = 20;
const GAME_SECONDS = 30;

const makeCells = (): MoleCell[] =>
  Array.from({ length: GRID }, (_, i) => ({ id: String(i), active: false, until: 0, kind: 'mole' }));

const Cell = memo(({ store, id, onHit }: { store: EntityStore<MoleCell>; id: string; onHit: (id: string) => void }) => {
  const cell = store.useOne(id);
  const debug = useDebug();
  const renders = useRenderCount();
  const active = cell?.active ?? false;
  const bomb = cell?.kind === 'bomb';

  let surface = 'border-ink-700 bg-ink-800/40';
  if (active) {
    surface = bomb
      ? 'mole-pop border-red-400 bg-red-500/25 text-red-200 shadow-[0_0_16px_rgba(248,113,113,0.5)]'
      : 'mole-pop border-brand-400 bg-brand-500/30 text-brand-100 shadow-[0_0_16px_rgba(139,92,246,0.5)]';
  }

  return (
    <button
      type="button"
      onClick={() => active && onHit(id)}
      className={`relative flex aspect-square items-center justify-center rounded-lg border text-xl transition ${surface}`}
    >
      {active && <span>{bomb ? '✸' : '◎'}</span>}
      {debug && <span className="absolute right-1 bottom-0.5 font-mono text-[8px] text-emerald-400">{renders}</span>}
    </button>
  );
});
Cell.displayName = 'MoleCell';

const MoleHunt = () => {
  const [store] = useState(() => createEntityStore<MoleCell>(makeCells()));
  const ids = store.useIds();
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [running, setRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const scoreRef = useRef(0);
  const missRef = useRef(0);

  useEffect(() => () => store.destroy(), [store]);

  const start = useCallback(() => {
    store.batch(() => {
      for (const cell of store.getAll()) {
        if (cell.active) {
          store.updateOne(cell.id, { active: false, until: 0 });
        }
      }
    });
    scoreRef.current = 0;
    missRef.current = 0;
    setScore(0);
    setMisses(0);
    setTimeLeft(GAME_SECONDS);
    setEnded(false);
    setRunning(true);
  }, [store]);

  const hit = useCallback(
    (id: string) => {
      const cell = store.getOne(id);
      store.updateOne(id, { active: false, until: 0 });
      if (cell?.kind === 'bomb') {
        // Clicking a bomb costs you points.
        scoreRef.current = Math.max(0, scoreRef.current - 3);
        sfx.hurt();
      } else {
        scoreRef.current += 1;
        sfx.hit();
      }

      setScore(scoreRef.current);
      pushLog(`mole[${id}]`, false);
    },
    [store]
  );

  // Countdown.
  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = window.setInterval(() => {
      if (isPaused()) {
        return;
      }

      setTimeLeft(v => {
        if (v <= 1) {
          setRunning(false);
          setEnded(true);

          return 0;
        }

        return v - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running]);

  // Spawn + expiry loop. Reads score via ref so the interval isn't torn down every point.
  useEffect(() => {
    if (!running) {
      return;
    }

    const loop = window.setInterval(() => {
      if (isPaused()) {
        return;
      }

      const now = performance.now();
      let activeCount = 0;
      for (const cell of store.getAll()) {
        if (cell.active) {
          if (now > cell.until) {
            store.updateOne(cell.id, { active: false, until: 0 });
            missRef.current += 1;
            setMisses(missRef.current);
          } else {
            activeCount += 1;
          }
        }
      }

      // Calm start, then a gentle incremental ramp: moles live a touch shorter, appear a touch more often, and more
      // can share the board as the score climbs.
      const moleLife = Math.max(820, 1900 - scoreRef.current * 14);
      const spawnChance = Math.min(0.42, 0.12 + scoreRef.current * 0.006);
      const maxActive = Math.min(5, 2 + Math.floor(scoreRef.current / 8));
      if (activeCount < maxActive && Math.random() < spawnChance) {
        const idle = store.getAll().filter(cell => !cell.active);
        if (idle.length) {
          const cell = idle[Math.floor(Math.random() * idle.length)];
          // ~38% of spawns are bombs — don't whack those.
          const kind: MoleKind = Math.random() < 0.38 ? 'bomb' : 'mole';
          store.updateOne(cell.id, { active: true, until: now + moleLife, kind });
          pushLog(`mole[${cell.id}]`, true);
        }
      }
    }, 200);

    return () => window.clearInterval(loop);
  }, [running, store]);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center">
        <div className="mb-3 flex w-full items-center gap-5">
          <div className="flex flex-col">
            <span className="text-[9px] tracking-[0.16em] text-zinc-500 uppercase">Score</span>
            <span key={score} className="stat-pop text-brand-200 font-mono text-lg font-bold">
              {score}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] tracking-[0.16em] text-zinc-500 uppercase">Missed</span>
            <span className="font-mono text-lg font-bold text-zinc-400">{misses}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] tracking-[0.16em] text-zinc-500 uppercase">Time</span>
            <span className="text-brand-200 font-mono text-lg font-bold">{timeLeft}s</span>
          </div>
          <button
            type="button"
            onClick={start}
            className={`border-ink-600 bg-ink-800 hover:border-brand-500 ml-auto rounded-lg border px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:text-white ${
              ended ? 'attention border-brand-500 text-white' : ''
            }`}
          >
            {running ? 'restart' : ended ? 'play again' : 'start'}
          </button>
        </div>

        <div className="relative w-full">
          <div className="grid grid-cols-5 gap-2">
            {ids.map(id => (
              <Cell key={id} store={store} id={id} onHit={hit} />
            ))}
          </div>

          {ended && (
            <div className="bg-ink-950/70 absolute inset-0 flex flex-col items-center justify-center rounded-xl backdrop-blur-sm">
              <span className="text-sm text-zinc-400">Time!</span>
              <span className="text-brand-200 font-mono text-2xl font-bold">{score} hits</span>
            </div>
          )}
        </div>

        <p className="mt-3 font-mono text-[10px] text-zinc-600">
          <span className="text-brand-300">◎</span> hit · <span className="text-red-400">✸</span> bomb (−3, avoid) ·
          each tile is a Nexus entity
        </p>
      </div>
    </div>
  );
};

export default MoleHunt;
