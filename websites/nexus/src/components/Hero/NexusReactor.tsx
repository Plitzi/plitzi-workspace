import { StoreProvider, useAsync, useDerived } from '@plitzi/nexus';
import { type CSSProperties, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isPaused } from './heroPause';
import { resumeAudio, sfx } from './heroSfx';
import {
  type ModuleDef,
  type Orb,
  type OrbKind,
  type ReactorState,
  type UpgradeDef,
  ACHIEVEMENTS,
  BOOST_FACTOR,
  CRIT_CHANCE,
  CRIT_MULT,
  MILESTONE,
  MODULES,
  ORB_META,
  ORB_TTL,
  TUTORIAL,
  UPGRADES,
  achievementAdapter,
  autoTapRate,
  boostActive,
  boostDuration,
  clickPower,
  coreMultiplier,
  createOrbStore,
  createReactorOutput,
  createReactorOverdrive,
  createReactorStore,
  clearReactorSave,
  earnedSinceMeltdown,
  emptyModules,
  emptyUpgrades,
  fmt,
  initialAchievements,
  meltdownReward,
  milestoneMult,
  moduleCost,
  offlineGain,
  orbSpawnChance,
  upgradeCost,
  useReactor
} from './reactorStore';

import type { AsyncResource, Derived, EntityStore, StoreApi } from '@plitzi/nexus';

const TICK_MS = 250;
const MAX_ORBS = 4;
const MELTDOWN_FLOOR = 10000;
const AMBIENT = Array.from({ length: 9 }, (_, i) => i);

type Tab = 'reactors' | 'talents' | 'trophies';
type Pop = { id: number; x: number; y: number; text: string; crit: boolean };
type Toast = { id: number; icon: string; title: string; sub: string };

const ORB_WEIGHTS: { kind: OrbKind; weight: number }[] = [
  { kind: 'energy', weight: 68 },
  { kind: 'boost', weight: 24 },
  { kind: 'core', weight: 8 }
];

const pickKind = (): OrbKind => {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const entry of ORB_WEIGHTS) {
    acc += entry.weight;
    if (roll < acc) {
      return entry.kind;
    }
  }

  return 'energy';
};

const makeOrb = (now: number): Orb => ({
  id: `orb-${now}-${Math.random().toString(36).slice(2, 7)}`,
  kind: pickKind(),
  x: 16 + Math.random() * 60,
  y: 14 + Math.random() * 56,
  dx: (Math.random() * 2 - 1) * 50,
  dy: (Math.random() * 2 - 1) * 40,
  bornAt: now
});

// The core + orbs + floating numbers all live in one "field" so taps and orb catches share the same coordinate space —
// catching an energy orb floats a "+N" exactly like tapping the core does.
const ReactorField = ({
  store,
  orbs,
  highlight,
  onCatch
}: {
  store: StoreApi<ReactorState>;
  orbs: EntityStore<Orb>;
  highlight: boolean;
  onCatch: (orb: Orb) => string;
}) => {
  const [energy] = useReactor('energy');
  const [boostUntil] = useReactor('boostUntil');
  const orbList = orbs.useAll();
  const [pops, setPops] = useState<Pop[]>([]);
  const popId = useRef(0);
  const fieldRef = useRef<HTMLDivElement>(null);
  const boosted = boostActive(boostUntil);

  const addPop = useCallback((x: number, y: number, text: string, crit: boolean) => {
    const id = popId.current++;
    setPops(prev => [...prev, { id, x, y, text, crit }]);
    window.setTimeout(() => setPops(prev => prev.filter(p => p.id !== id)), 900);
  }, []);

  const charge = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      resumeAudio();
      const crit = Math.random() < CRIT_CHANCE;
      const power =
        clickPower(store.get('cores') ?? 0, store.get('upgrades') ?? emptyUpgrades()) * (crit ? CRIT_MULT : 1);
      store.batch(() => {
        store.set('energy', value => value + power);
        store.set('lifetime', value => value + power);
        store.set('clicks', value => value + 1);
        if (store.get('tutorial') === 0) {
          store.set('tutorial', 1);
        }
      });
      crit ? sfx.power() : sfx.move();

      const rect = fieldRef.current?.getBoundingClientRect();
      if (rect) {
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        addPop(x, y, `${crit ? 'CRIT ' : ''}+${fmt(power)}`, crit);
      }
    },
    [store, addPop]
  );

  const catchOrb = useCallback(
    (orb: Orb) => {
      const text = onCatch(orb);
      addPop(orb.x, orb.y, text, orb.kind !== 'energy');
    },
    [onCatch, addPop]
  );

  return (
    <div ref={fieldRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      {AMBIENT.map(i => (
        <span
          key={i}
          className="drift-up bg-brand-400/40 absolute bottom-4 h-1 w-1 rounded-full"
          style={{ left: `${8 + i * 10}%`, animationDuration: `${4 + (i % 4) * 0.8}s`, animationDelay: `${i * 0.45}s` }}
        />
      ))}

      {orbList.map(orb => {
        const meta = ORB_META[orb.kind];

        return (
          <button
            key={orb.id}
            type="button"
            onClick={() => catchOrb(orb)}
            aria-label={`${meta.label}: ${meta.effect}`}
            title={`${meta.label} — ${meta.effect}`}
            className="orb-travel absolute z-20 flex h-11 w-11 items-center justify-center rounded-full text-lg"
            style={
              {
                left: `${orb.x}%`,
                top: `${orb.y}%`,
                '--dx': `${orb.dx}px`,
                '--dy': `${orb.dy}px`,
                '--ttl': `${ORB_TTL}ms`,
                color: meta.color,
                background: `radial-gradient(circle at 40% 35%, ${meta.color}, ${meta.color}33 70%, transparent)`,
                boxShadow: `0 0 18px 4px ${meta.color}88`
              } as CSSProperties
            }
          >
            {meta.icon}
          </button>
        );
      })}

      <button
        type="button"
        onClick={charge}
        aria-label="Charge the reactor"
        className={`group relative h-32 w-32 shrink-0 cursor-pointer rounded-full select-none ${highlight ? 'attention' : ''}`}
      >
        <span className="reactor-spin border-brand-500/30 absolute inset-0 rounded-full border-2 border-dashed" />
        <span className="reactor-spin-rev border-brand-400/20 absolute inset-3 rounded-full border-2 border-dotted" />
        <span
          className="absolute inset-6 rounded-full transition-transform duration-150 group-active:scale-90"
          style={{
            background: 'radial-gradient(circle at 38% 32%, #ede9fe, #a78bfa 38%, #7c3aed 68%, #4c1d95 100%)',
            boxShadow: boosted
              ? '0 0 70px 14px rgba(251,113,133,0.65), inset 0 0 28px rgba(255,255,255,0.4)'
              : '0 0 52px 8px rgba(124,58,237,0.55), inset 0 0 28px rgba(255,255,255,0.35)'
          }}
        />
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span key={Math.floor(energy)} className="stat-pop font-mono text-xl font-bold text-white drop-shadow">
            {fmt(energy)}
          </span>
          <span className="text-brand-100/80 text-[9px] tracking-[0.25em] uppercase">
            {energy < 1 ? 'tap me' : 'energy'}
          </span>
        </span>
      </button>

      {pops.map(pop => (
        <span
          key={pop.id}
          className={`pointer-events-none absolute z-30 font-mono font-bold ${
            pop.crit ? 'crit-pop text-base text-amber-300' : 'energy-rise text-brand-200 text-sm'
          }`}
          style={{ left: `${pop.x}%`, top: `${pop.y}%` }}
        >
          {pop.text}
        </span>
      ))}
    </div>
  );
};

const Hud = ({ output }: { output: Derived<number> }) => {
  const [energy] = useReactor('energy');
  const [lifetime] = useReactor('lifetime');
  const [cores] = useReactor('cores');
  const [boostUntil] = useReactor('boostUntil');
  const base = useDerived(output);
  const boosted = boostActive(boostUntil);
  const perSec = base * (boosted ? BOOST_FACTOR : 1);
  const boostLeft = boosted ? Math.ceil((boostUntil - Date.now()) / 1000) : 0;

  // Left-aligned and kept clear of the top-right, where the arcade's pause / exit buttons live.
  return (
    <header className="flex flex-col gap-1">
      <div className="text-[9px] tracking-[0.22em] text-zinc-500 uppercase">Energy</div>
      <div className="text-gradient font-mono text-3xl leading-none font-extrabold tabular-nums">{fmt(energy)}</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
        <span className={boosted ? 'font-bold text-rose-300' : 'text-brand-300'}>+{fmt(perSec)}/s</span>
        <span className="text-zinc-600">{fmt(lifetime)} all-time</span>
        <span className="border-brand-500/40 bg-brand-500/10 text-brand-200 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
          ◆ {cores} <span className="text-brand-300/70">×{coreMultiplier(cores).toFixed(2)}</span>
        </span>
        {boosted && (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
            🔥 {BOOST_FACTOR}× · {boostLeft}s
          </span>
        )}
      </div>
    </header>
  );
};

const OrbLegend = () => (
  <div className="border-ink-700/70 bg-ink-900/50 flex items-center justify-around gap-2 rounded-lg border px-2 py-1.5">
    {(Object.keys(ORB_META) as OrbKind[]).map(kind => {
      const meta = ORB_META[kind];

      return (
        <span key={kind} className="flex items-center gap-1.5">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
            style={{ color: meta.color, background: `${meta.color}22`, boxShadow: `0 0 8px ${meta.color}66` }}
          >
            {meta.icon}
          </span>
          <span className="text-[10px] text-zinc-400">{meta.effect}</span>
        </span>
      );
    })}
  </div>
);

const ModuleRow = ({
  def,
  energy,
  highlight,
  onBuy
}: {
  def: ModuleDef;
  energy: number;
  highlight: boolean;
  onBuy: (def: ModuleDef) => void;
}) => {
  // Fine-grained: this row subscribes to its own module path, so buying another reactor wakes only its own count.
  const [owned] = useReactor(`modules.${def.key}`);
  const cost = moduleCost(def, owned);
  const affordable = energy >= cost;
  const mult = milestoneMult(owned);
  const toNext = MILESTONE - (owned % MILESTONE);

  return (
    <button
      type="button"
      onClick={() => onBuy(def)}
      disabled={!affordable}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
        affordable
          ? 'border-ink-700/70 bg-ink-900/60 hover:border-brand-500 hover:bg-ink-800/60'
          : 'border-ink-800 bg-ink-900/40 cursor-not-allowed opacity-50'
      } ${highlight ? 'attention border-brand-500' : ''}`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
        style={{ color: def.color, backgroundColor: `${def.color}1f` }}
      >
        {def.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-white">{def.name}</span>
          <span className="border-ink-600 shrink-0 rounded border px-1 font-mono text-[9px] text-zinc-400">
            ×{owned}
          </span>
          {mult > 1 && (
            <span className="shrink-0 rounded bg-amber-500/15 px-1 font-mono text-[9px] font-bold text-amber-300">
              ×{mult}
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-zinc-500">
          +{fmt(def.rate * mult)}/s each · ×2 in {toNext}
        </div>
      </div>
      <span className={`shrink-0 font-mono text-xs font-bold ${affordable ? 'text-brand-200' : 'text-zinc-500'}`}>
        {fmt(cost)}
      </span>
    </button>
  );
};

const ReactorsPanel = ({
  store,
  highlight,
  onBuy
}: {
  store: StoreApi<ReactorState>;
  highlight: boolean;
  onBuy: (def: ModuleDef) => void;
}) => {
  const [energy] = useReactor('energy');
  const [lifetime] = useReactor('lifetime');

  // Reveal a reactor once you're within reach of it, so the shop unfolds as a sense of progress.
  const visible = MODULES.filter(def => lifetime >= def.baseCost * 0.35 || (store.get('modules')?.[def.key] ?? 0) > 0);
  const cheapest = visible.find(def => energy >= moduleCost(def, store.get('modules')?.[def.key] ?? 0));

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map(def => (
        <ModuleRow
          key={def.key}
          def={def}
          energy={energy}
          highlight={highlight && def.key === cheapest?.key}
          onBuy={onBuy}
        />
      ))}
    </div>
  );
};

const TalentRow = ({ def, cores, onBuy }: { def: UpgradeDef; cores: number; onBuy: (def: UpgradeDef) => void }) => {
  const [level] = useReactor(`upgrades.${def.key}`);
  const maxed = level >= def.max;
  const cost = upgradeCost(def, level);
  const affordable = !maxed && cores >= cost;

  return (
    <button
      type="button"
      onClick={() => onBuy(def)}
      disabled={!affordable}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
        affordable
          ? 'border-ink-700/70 bg-ink-900/60 hover:border-brand-500'
          : 'border-ink-800 bg-ink-900/40 opacity-60'
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
        style={{ color: def.color, backgroundColor: `${def.color}1f` }}
      >
        {def.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-white">{def.name}</span>
          <span className="border-ink-600 shrink-0 rounded border px-1 font-mono text-[9px] text-zinc-400">
            {level}/{def.max}
          </span>
        </div>
        <div className="truncate text-[11px] text-zinc-500">{def.desc}</div>
      </div>
      <span
        className={`shrink-0 font-mono text-xs font-bold ${maxed ? 'text-emerald-400' : affordable ? 'text-brand-200' : 'text-zinc-500'}`}
      >
        {maxed ? 'MAX' : `${cost}◆`}
      </span>
    </button>
  );
};

const TalentsPanel = ({ onBuy }: { onBuy: (def: UpgradeDef) => void }) => {
  const [cores] = useReactor('cores');

  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-1 text-[11px] text-zinc-500">
        Spend ◆ cores (earned by Meltdown) on permanent talents. You have{' '}
        <span className="text-brand-200">{cores}◆</span>.
      </p>
      {UPGRADES.map(def => (
        <TalentRow key={def.key} def={def} cores={cores} onBuy={onBuy} />
      ))}
    </div>
  );
};

const TrophiesPanel = () => {
  const [achievements] = useReactor('achievements');
  const all = achievementAdapter.selectAll(achievements);
  const unlocked = all.filter(a => a.unlocked).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11px] text-zinc-500">
        {unlocked}/{all.length} unlocked · each adds <span className="text-emerald-300">+3% output</span>
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {all.map(trophy => (
          <div
            key={trophy.id}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
              trophy.unlocked ? 'border-amber-500/40 bg-amber-500/10' : 'border-ink-800 bg-ink-900/40'
            }`}
          >
            <span className={`text-lg ${trophy.unlocked ? '' : 'opacity-30 grayscale'}`}>{trophy.icon}</span>
            <div className="min-w-0">
              <div
                className={`truncate text-[11px] font-semibold ${trophy.unlocked ? 'text-amber-200' : 'text-zinc-500'}`}
              >
                {trophy.name}
              </div>
              <div className="truncate text-[9px] text-zinc-600">{trophy.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Actions = ({
  overdrive,
  highlight,
  onOverdrive,
  onMeltdown,
  onReset
}: {
  overdrive: AsyncResource<number, []>;
  highlight: 'overdrive' | 'meltdown' | null;
  onOverdrive: () => void;
  onMeltdown: () => void;
  onReset: () => void;
}) => {
  const scan = useAsync(overdrive);
  const [lifetime] = useReactor('lifetime');
  const [meltdownAt] = useReactor('meltdownAt');
  const earned = earnedSinceMeltdown(lifetime, meltdownAt);
  const reward = meltdownReward(earned);
  const canMeltdown = reward >= 1;
  const pending = scan.status === 'pending';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            resumeAudio();
            onOverdrive();
          }}
          disabled={pending}
          title="Instantly bank about 25 seconds of production"
          className={`bg-brand-600 hover:bg-brand-500 flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-mono text-xs font-bold text-white transition disabled:opacity-60 ${
            highlight === 'overdrive' ? 'attention' : ''
          }`}
        >
          {pending ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              charging…
            </>
          ) : (
            <>⚡ Overdrive</>
          )}
        </button>
        <button
          type="button"
          onClick={onMeltdown}
          disabled={!canMeltdown}
          title="Reset energy and reactors, but gain cores that permanently multiply all output and buy talents"
          className={`rounded-lg border px-3 py-2 font-mono text-xs font-bold transition ${
            canMeltdown
              ? 'border-amber-500 bg-amber-500/15 text-amber-300'
              : 'border-ink-700 bg-ink-900/60 cursor-not-allowed text-zinc-600'
          } ${highlight === 'meltdown' && canMeltdown ? 'attention' : ''}`}
        >
          ☢ Meltdown {canMeltdown ? `+${reward}◆` : ''}
        </button>
      </div>
      <div className="flex items-center justify-between px-0.5 text-[10px] text-zinc-600">
        <span>instant energy burst</span>
        <span>{canMeltdown ? 'reset → cores for talents' : `meltdown at ${fmt(MELTDOWN_FLOOR)} earned`}</span>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="self-center font-mono text-[10px] text-zinc-600 transition hover:text-zinc-300"
      >
        clear save
      </button>
    </div>
  );
};

const TutorialCoach = ({ onSkip }: { onSkip: () => void }) => {
  const [step] = useReactor('tutorial');
  if (step < 0 || step >= TUTORIAL.length) {
    return null;
  }

  const tip = TUTORIAL[step];

  return (
    <div className="border-brand-500/30 bg-brand-500/10 flex items-center gap-2 rounded-lg border px-3 py-2">
      <span className="bg-brand-600 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold text-white">
        {step + 1}
      </span>
      <span className="text-brand-100 flex-1 text-[11px] leading-snug">{tip.text}</span>
      <button
        type="button"
        onClick={onSkip}
        className="shrink-0 font-mono text-[10px] text-zinc-400 transition hover:text-white"
      >
        skip
      </button>
    </div>
  );
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'reactors', label: 'Reactors' },
  { id: 'talents', label: 'Talents' },
  { id: 'trophies', label: 'Trophies' }
];

const NexusReactor = () => {
  const [store] = useState(createReactorStore);
  const [orbs] = useState(createOrbStore);
  const output = useMemo(() => createReactorOutput(store), [store]);
  const overdrive = useMemo(() => createReactorOverdrive(store, output), [store, output]);

  const [tab, setTab] = useState<Tab>('reactors');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [offline, setOffline] = useState(0);
  const [flash, setFlash] = useState(0);
  const [burst, setBurst] = useState(0);
  const toastId = useRef(0);

  const pushToast = useCallback((icon: string, title: string, sub: string) => {
    const id = toastId.current++;
    setToasts(prev => [...prev, { id, icon, title, sub }]);
    window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3600);
  }, []);

  // Mirror the active tutorial step's highlight target so the relevant control can pulse.
  useEffect(() => {
    const sync = () => {
      const step = store.get('tutorial') ?? -1;
      setHighlight(step >= 0 && step < TUTORIAL.length ? TUTORIAL[step].highlight : null);
    };

    sync();

    return store.watch('tutorial', sync);
  }, [store]);

  useEffect(
    () => () => {
      output.destroy();
      overdrive.destroy();
      orbs.destroy();
    },
    [output, overdrive, orbs]
  );

  // Offline earnings: persist saved `lastSeen`, so on (re)mount we grant a capped share of production for the time away
  // and keep the timestamp fresh while playing.
  useEffect(() => {
    const gained = offlineGain(store.get('lastSeen') ?? 0, output.get());
    if (gained > 1) {
      store.batch(() => {
        store.set('energy', e => e + gained);
        store.set('lifetime', e => e + gained);
      });
      setOffline(gained);
    }

    store.set('lastSeen', Date.now());
    const id = window.setInterval(() => store.set('lastSeen', Date.now()), 5000);

    return () => {
      store.set('lastSeen', Date.now());
      window.clearInterval(id);
    };
  }, [store, output]);

  // Trophy watcher (createEntityAdapter): unlock any achievement whose condition is met, award its toast, and let the
  // derived output pick up the new multiplier.
  useEffect(() => {
    const id = window.setInterval(() => {
      const state = store.get();
      const newly = ACHIEVEMENTS.filter(def => !state.achievements[def.id]?.unlocked && def.test(state));
      if (!newly.length) {
        return;
      }

      store.batch(() => {
        for (const def of newly) {
          store.set('achievements', achievementAdapter.updateOne({ id: def.id, changes: { unlocked: true } }));
        }
      });
      for (const def of newly) {
        pushToast(def.icon, 'Trophy unlocked', def.name);
      }

      sfx.power();
    }, 900);

    return () => window.clearInterval(id);
  }, [store, pushToast]);

  // Production tick: module output (tripled while boosted) plus the auto-tapper talent, paused with the arcade.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (isPaused()) {
        return;
      }

      const dt = TICK_MS / 1000;
      let gain = output.get() * dt;
      if (boostActive(store.get('boostUntil') ?? 0)) {
        gain *= BOOST_FACTOR;
      }

      const auto = autoTapRate(store.get('upgrades') ?? emptyUpgrades());
      if (auto > 0) {
        gain += clickPower(store.get('cores') ?? 0, store.get('upgrades') ?? emptyUpgrades()) * auto * dt;
      }

      if (gain <= 0) {
        return;
      }

      store.batch(() => {
        store.set('energy', value => value + gain);
        store.set('lifetime', value => value + gain);
      });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [store, output]);

  // Surge orbs spawn and expire on a timer in their own entity store; the Orb Magnet talent raises the spawn chance.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (isPaused()) {
        return;
      }

      const now = Date.now();
      const expired = orbs
        .getAll()
        .filter(orb => now - orb.bornAt > ORB_TTL)
        .map(orb => orb.id);
      if (expired.length) {
        orbs.removeMany(expired);
      }

      const chance = orbSpawnChance(store.get('upgrades') ?? emptyUpgrades());
      if (orbs.size() >= MAX_ORBS || (store.get('lifetime') ?? 0) < 4 || Math.random() > chance) {
        return;
      }

      orbs.addOne(makeOrb(now));
    }, 1500);

    return () => window.clearInterval(id);
  }, [orbs, store]);

  const buy = useCallback(
    (def: ModuleDef) => {
      const owned = store.get('modules')?.[def.key] ?? 0;
      const cost = moduleCost(def, owned);
      if ((store.get('energy') ?? 0) < cost) {
        return;
      }

      store.batch(() => {
        store.set('energy', value => value - cost);
        store.set(`modules.${def.key}`, value => value + 1);
        if (store.get('tutorial') === 1) {
          store.set('tutorial', 2);
        }
      });
      sfx.bounce();
    },
    [store]
  );

  const buyUpgrade = useCallback(
    (def: UpgradeDef) => {
      const level = store.get('upgrades')?.[def.key] ?? 0;
      if (level >= def.max) {
        return;
      }

      const cost = upgradeCost(def, level);
      if ((store.get('cores') ?? 0) < cost) {
        return;
      }

      store.batch(() => {
        store.set('cores', value => value - cost);
        store.set(`upgrades.${def.key}`, value => value + 1);
      });
      sfx.power();
    },
    [store]
  );

  // Returns the float text so the field can pop it where the orb was caught.
  const catchOrb = useCallback(
    (orb: Orb): string => {
      const now = Date.now();
      let text = '';
      store.batch(() => {
        if (orb.kind === 'energy') {
          const reward = Math.max(50, Math.round(output.get() * 25));
          store.set('energy', value => value + reward);
          store.set('lifetime', value => value + reward);
          text = `+${fmt(reward)}`;
        } else if (orb.kind === 'boost') {
          const dur = boostDuration(store.get('upgrades') ?? emptyUpgrades());
          store.set('boostUntil', Math.max(store.get('boostUntil') ?? 0, now) + dur);
          text = `🔥 ${BOOST_FACTOR}×`;
        } else {
          store.set('cores', value => value + 1);
          text = '+1 ◆';
        }

        if (store.get('tutorial') === 2) {
          store.set('tutorial', 3);
        }
      });
      orbs.removeOne(orb.id);
      if (orb.kind === 'boost') {
        setFlash(now);
      }

      sfx.power();

      return text;
    },
    [store, output, orbs]
  );

  const runOverdrive = useCallback(() => {
    void overdrive.run();
    if (store.get('tutorial') === 3) {
      store.set('tutorial', 4);
    }
  }, [overdrive, store]);

  const meltdown = useCallback(() => {
    const earned = earnedSinceMeltdown(store.get('lifetime') ?? 0, store.get('meltdownAt') ?? 0);
    const reward = meltdownReward(earned);
    if (reward < 1) {
      return;
    }

    store.batch(() => {
      store.set('cores', value => value + reward);
      store.set('energy', 0);
      store.set('meltdownAt', store.get('lifetime') ?? 0);
      store.set('modules', emptyModules());
      if (store.get('tutorial') === 4) {
        store.set('tutorial', TUTORIAL.length);
      }
    });
    orbs.removeAll();
    setBurst(Date.now());
    setTab('talents');
    sfx.power();
  }, [store, orbs]);

  const reset = useCallback(() => {
    clearReactorSave();
    orbs.removeAll();
    store.batch(() => {
      store.set('energy', 0);
      store.set('lifetime', 0);
      store.set('meltdownAt', 0);
      store.set('clicks', 0);
      store.set('cores', 0);
      store.set('modules', emptyModules());
      store.set('upgrades', emptyUpgrades());
      store.set('achievements', initialAchievements());
      store.set('lastScan', 0);
      store.set('boostUntil', 0);
      store.set('tutorial', 0);
      store.set('lastSeen', Date.now());
    });
    setTab('reactors');
    sfx.undo();
  }, [store, orbs]);

  const skipTutorial = useCallback(() => store.set('tutorial', -1), [store]);

  return (
    <StoreProvider store={store}>
      {/* pt-12 keeps the game clear of the arcade's pause / exit buttons pinned to the top of the play area. */}
      <div className="relative flex h-full w-full flex-col gap-2 overflow-hidden px-4 pt-12 pb-3">
        <div className="aura pointer-events-none absolute inset-0 opacity-25" />

        {flash > 0 && (
          <div key={flash} className="screen-flash pointer-events-none absolute inset-0 z-40 bg-rose-500/40" />
        )}
        {burst > 0 && (
          <span
            key={burst}
            className="burst-ring pointer-events-none absolute top-1/2 left-1/2 z-40 h-40 w-40 rounded-full border-4 border-amber-300/70"
          />
        )}

        <div className="pointer-events-none absolute top-12 right-3 z-40 flex flex-col gap-1.5">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="toast-in bg-ink-900/90 flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-1.5 shadow-lg backdrop-blur"
            >
              <span className="text-lg">{toast.icon}</span>
              <div>
                <div className="text-[9px] tracking-[0.15em] text-amber-300 uppercase">{toast.title}</div>
                <div className="text-xs font-semibold text-white">{toast.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {offline > 0 && (
          <div className="bg-ink-950/80 absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="border-brand-500/40 bg-ink-900 toast-in mx-6 flex flex-col items-center gap-2 rounded-2xl border p-6 text-center">
              <span className="text-3xl">🌙</span>
              <div className="text-sm font-semibold text-white">Welcome back!</div>
              <div className="text-xs text-zinc-400">Your reactors produced while you were away:</div>
              <div className="text-brand-200 font-mono text-2xl font-bold">+{fmt(offline)}</div>
              <button
                type="button"
                onClick={() => setOffline(0)}
                className="bg-brand-600 hover:bg-brand-500 mt-1 rounded-lg px-5 py-2 text-xs font-bold text-white transition"
              >
                Collect
              </button>
            </div>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col gap-2">
          <Hud output={output} />
          <ReactorField store={store} orbs={orbs} highlight={highlight === 'core'} onCatch={catchOrb} />
          <OrbLegend />
          <Actions
            overdrive={overdrive}
            highlight={highlight === 'overdrive' ? 'overdrive' : highlight === 'meltdown' ? 'meltdown' : null}
            onOverdrive={runOverdrive}
            onMeltdown={meltdown}
            onReset={reset}
          />
          <TutorialCoach onSkip={skipTutorial} />

          <div className="border-ink-700/70 flex shrink-0 gap-1 rounded-lg border p-1">
            {TABS.map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`flex-1 rounded-md py-1 font-mono text-[11px] font-semibold transition ${
                  tab === entry.id ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === 'reactors' && <ReactorsPanel store={store} highlight={highlight === 'shop'} onBuy={buy} />}
            {tab === 'talents' && <TalentsPanel onBuy={buyUpgrade} />}
            {tab === 'trophies' && <TrophiesPanel />}
          </div>
        </div>
      </div>
    </StoreProvider>
  );
};

export default NexusReactor;
