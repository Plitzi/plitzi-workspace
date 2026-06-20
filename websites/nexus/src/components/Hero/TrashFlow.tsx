import { StoreProvider, createEntityStore, loggerMiddleware } from '@plitzi/nexus';
import { useEffect, useRef, useState } from 'react';

import { pushLog } from './heroLog';
import {
  type StatKey,
  type TrashFlowState,
  makeTrashFlowInitial,
  upgradeCost,
  useTrashFlow as useTrashState,
  useTrashPublish
} from './trashFlowStore';
import useTrashFlow, { type Scrap, type TrashFlowApi } from './useTrashFlow';

import type { EntityStore } from '@plitzi/nexus';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';

const MIDDLEWARES = [loggerMiddleware<TrashFlowState>(change => pushLog(change.path ?? '(root)', change.next))];

const LEVEL_CAP = 10;
const LEVEL_COLORS = [
  '#7c3aed',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#f87171',
  '#fb923c',
  '#f59e0b',
  '#fbbf24'
];

const HEX_CLIP = 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)';

// Hand-drawn SVG icons, themed to the arcade — no emojis.
const Icon = ({ kind }: { kind: StatKey }) => {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'battery':
      return (
        <svg {...common}>
          <rect x="2.5" y="7.5" width="16" height="9" rx="2.2" />
          <line x1="21" y1="10.5" x2="21" y2="13.5" />
          <path d="M10.5 9.5 8 12.5h3l-2.5 3" fill="none" />
        </svg>
      );
    case 'pipe':
      return (
        <svg {...common}>
          <path d="M3 12h18" />
          <path d="M7 8l-4 4 4 4" />
          <path d="M17 8l4 4-4 4" />
        </svg>
      );
    case 'air':
      return (
        <svg {...common}>
          <path d="M3 8h10a3 3 0 1 0-3-3" />
          <path d="M3 12h15a3 3 0 1 1-3 3" />
          <path d="M3 16h8" />
        </svg>
      );
    case 'radius':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.5 9.2A2.6 2.2 0 0 0 12 8h-.6a2 2 0 0 0 0 4h1.2a2 2 0 0 1 0 4H12a2.6 2.2 0 0 1-2.5-1.2" />
          <path d="M12 6.5v11" />
        </svg>
      );
  }
};

const PointsHud = () => {
  const [points] = useTrashState('hud.points');
  const [value] = useTrashState('hud.value');

  return (
    <div className="border-ink-700/70 bg-ink-900/60 pointer-events-none absolute top-14 left-4 rounded-xl border px-4 py-2.5 backdrop-blur-md">
      <span className="text-[9px] tracking-[0.22em] text-zinc-500 uppercase">Total points</span>
      <div key={points} className="stat-pop text-brand-200 font-mono text-2xl leading-tight font-bold tabular-nums">
        {points.toLocaleString()}
      </div>
      <span className="font-mono text-[10px] text-teal-300">value: {value}</span>
    </div>
  );
};

const LevelTower = ({ panelRef }: { panelRef: RefObject<HTMLDivElement | null> }) => {
  const [level] = useTrashState('hud.level');
  const [pct] = useTrashState('hud.levelPct');
  const filled = Math.round((pct / 100) * LEVEL_CAP);

  return (
    <div
      ref={panelRef}
      className="border-ink-700/70 bg-ink-900/60 pointer-events-none absolute top-14 right-4 flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 backdrop-blur-md transition-opacity duration-200"
    >
      <span className="text-[9px] tracking-[0.24em] text-emerald-300 uppercase drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]">
        Level
      </span>
      <span className="font-mono text-lg leading-none font-bold text-white">
        {Math.min(level, LEVEL_CAP)} / {LEVEL_CAP}
      </span>
      <div className="mt-1 flex flex-col-reverse gap-1.5">
        {LEVEL_COLORS.map((color, i) => (
          <span
            key={i}
            className="h-4 w-9"
            style={{
              clipPath: HEX_CLIP,
              backgroundColor: i < filled ? color : 'rgba(255,255,255,0.06)',
              boxShadow: i < filled ? `0 0 8px ${color}99` : 'none'
            }}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] font-semibold text-zinc-500">{pct}%</span>
    </div>
  );
};

const BatteryBar = ({ panelRef }: { panelRef: RefObject<HTMLDivElement | null> }) => {
  const [pct] = useTrashState('hud.batteryPct');
  const segments = 20;
  const filled = Math.round((pct / 100) * segments);
  const color = pct <= 20 ? '#f87171' : pct <= 45 ? '#fbbf24' : '#34d399';

  return (
    <div
      ref={panelRef}
      className="border-ink-700/70 bg-ink-950/70 pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-[inset_0_1px_8px_rgba(0,0,0,0.5)] backdrop-blur-md transition-opacity duration-200"
    >
      <span className="text-brand-300">
        <Icon kind="battery" />
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className="h-6 w-2.5 rounded-sm transition-colors"
            style={
              i < filled
                ? { backgroundColor: color, boxShadow: `0 0 7px ${color}aa` }
                : { backgroundColor: 'rgba(255,255,255,0.05)' }
            }
          />
        ))}
      </div>
    </div>
  );
};

const CARDS: { key: StatKey; name: string; desc: string; color: string }[] = [
  { key: 'battery', name: 'Battery', desc: 'Longer vacuum battery life', color: '#fb923c' },
  { key: 'pipe', name: 'Pipe Size', desc: 'Suck more trash at once', color: '#22d3ee' },
  { key: 'air', name: 'Air Speed', desc: 'Trash gets drawn in faster', color: '#a78bfa' },
  { key: 'radius', name: 'Suction Radius', desc: 'Larger area of effect', color: '#34d399' },
  { key: 'value', name: 'Trash Value', desc: 'More points per scrap', color: '#fbbf24' }
];

const PIP_MAX = 12;

const ShopCard = ({
  card,
  level,
  points,
  onBuy
}: {
  card: (typeof CARDS)[number];
  level: number;
  points: number;
  onBuy: () => void;
}) => {
  const cost = upgradeCost(card.key, level);
  const affordable = points >= cost;

  return (
    <div className="border-ink-700 bg-ink-900/70 card flex flex-col gap-3 rounded-2xl border p-5">
      <div className="flex items-start justify-between">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ color: card.color, backgroundColor: `${card.color}1f` }}
        >
          <Icon kind={card.key} />
        </span>
        <span className="border-ink-600 rounded-md border px-2 py-0.5 font-mono text-[10px] text-zinc-400">
          LV {level}
        </span>
      </div>
      <div>
        <div className="text-base font-semibold text-white">{card.name}</div>
        <div className="text-xs leading-snug text-zinc-500">{card.desc}</div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: PIP_MAX }, (_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: i < level ? card.color : 'rgba(255,255,255,0.08)' }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onBuy}
        disabled={!affordable}
        className={`mt-1 w-full rounded-xl px-3 py-2.5 font-mono text-sm font-bold transition ${
          affordable ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-ink-800 cursor-not-allowed text-zinc-600'
        }`}
      >
        {cost.toLocaleString()} pts
      </button>
    </div>
  );
};

const Shop = ({ api }: { api: RefObject<TrashFlowApi | null> }): ReactNode => {
  const [phase] = useTrashState('hud.phase');
  const [points] = useTrashState('hud.points');
  const [cleared] = useTrashState('hud.cleared');
  const [stats] = useTrashState('stats');

  if (phase !== 'shop') {
    return null;
  }

  return (
    <div className="bg-ink-950/85 pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-7 overflow-auto p-8 backdrop-blur-sm">
      <div className="flex w-full max-w-5xl flex-wrap items-end justify-between gap-4">
        <div>
          <span
            className={`font-mono text-[11px] tracking-[0.25em] uppercase ${
              cleared ? 'text-emerald-300' : 'text-amber-400'
            }`}
          >
            {cleared ? 'Level cleared' : 'Battery drained'}
          </span>
          <h3 className="text-4xl font-extrabold tracking-tight text-white">
            Upgrade <span className="text-gradient">Shop</span>
          </h3>
        </div>
        <div className="border-ink-700 bg-ink-900/70 rounded-xl border px-5 py-2.5">
          <span className="text-[9px] tracking-[0.2em] text-zinc-500 uppercase">Available balance</span>
          <div className="text-brand-200 font-mono text-2xl font-bold tabular-nums">{points.toLocaleString()} pts</div>
        </div>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {CARDS.map(card => (
          <ShopCard
            key={card.key}
            card={card}
            level={stats[card.key]}
            points={points}
            onBuy={() => api.current?.buy(card.key)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => api.current?.next()}
        className="bg-brand-600 hover:bg-brand-500 attention rounded-xl px-10 py-3.5 text-sm font-bold tracking-wide text-white uppercase transition"
      >
        {cleared ? 'Next level ▸' : 'Retry level ▸'}
      </button>
    </div>
  );
};

const TrashFlowStage = ({ store }: { store: EntityStore<Scrap> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<TrashFlowApi | null>(null);
  const batteryRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  const publish = useTrashPublish();
  useTrashFlow(canvasRef, store, publish, apiRef);

  // Fade the HUD panels out as the cursor approaches them, so they never sit between you and the trash.
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (batteryRef.current) {
      batteryRef.current.style.opacity = y > rect.height - 150 ? '0.12' : '1';
    }

    if (levelRef.current) {
      levelRef.current.style.opacity = x > rect.width - 170 && y < rect.height * 0.7 ? '0.12' : '1';
    }
  };

  return (
    <div className="relative h-full w-full" onPointerMove={onPointerMove}>
      <canvas ref={canvasRef} className="block h-full w-full cursor-none" />
      <PointsHud />
      <LevelTower panelRef={levelRef} />
      <BatteryBar panelRef={batteryRef} />
      <Shop api={apiRef} />
    </div>
  );
};

const TrashFlow = () => {
  const [store] = useState(() => createEntityStore<Scrap>([]));
  const [initial] = useState(makeTrashFlowInitial);

  useEffect(() => () => store.destroy(), [store]);

  return (
    <StoreProvider value={initial} middlewares={MIDDLEWARES}>
      <TrashFlowStage store={store} />
    </StoreProvider>
  );
};

export default TrashFlow;
