import { createEntityStore } from '@plitzi/nexus';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useDebug, useRenderCount } from './heroDebug';
import { pushLog } from './heroLog';
import { sfx } from './heroSfx';

import type { EntityStore } from '@plitzi/nexus';

// Mole Hunt showcases `createEntityStore`: each tile is an entity in a normalized collection. Activating or clearing
// one wakes only that tile's `useOne` subscriber — O(1) — so with debug on you can watch a single tile's render count
// tick while its 19 neighbours stay frozen. Reactivity proven, not claimed.
type MoleCell = { id: string; active: boolean; until: number };

const GRID = 20;
const GAME_SECONDS = 30;

const makeCells = (): MoleCell[] =>
  Array.from({ length: GRID }, (_, i) => ({ id: String(i), active: false, until: 0 }));

const Cell = ({ store, id, onHit }: { store: EntityStore<MoleCell>; id: string; onHit: (id: string) => void }) => {
  const cell = store.useOne(id);
  const debug = useDebug();
  const renders = useRenderCount();
  const active = cell?.active ?? false;

  return (
    <button
      type="button"
      onClick={() => active && onHit(id)}
      className={`relative flex aspect-square items-center justify-center rounded-lg border text-xl transition ${
        active
          ? 'mole-pop border-brand-400 bg-brand-500/30 text-brand-100 shadow-[0_0_16px_rgba(139,92,246,0.5)]'
          : 'border-ink-700 bg-ink-800/40'
      }`}
    >
      {active && <span>◎</span>}
      {debug && <span className="absolute right-1 bottom-0.5 font-mono text-[8px] text-emerald-400">{renders}</span>}
    </button>
  );
};

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
      store.updateOne(id, { active: false, until: 0 });
      scoreRef.current += 1;
      setScore(scoreRef.current);
      sfx.hit();
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
          store.updateOne(cell.id, { active: true, until: now + moleLife });
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
          <span key={score} className="stat-pop text-brand-200 font-mono text-lg font-bold">{score}</span>
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
          className={`border-ink-600 bg-ink-800 hover:border-brand-500 hover:text-white ml-auto rounded-lg border px-3 py-1.5 font-mono text-xs text-zinc-300 transition ${
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

      <p className="mt-3 font-mono text-[10px] text-zinc-600">each tile is a Nexus entity · useOne wakes only its own</p>
      </div>
    </div>
  );
};

export default MoleHunt;
