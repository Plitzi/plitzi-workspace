import {
  CANCEL,
  createAsync,
  createDerived,
  createEntityAdapter,
  createEntityStore,
  createStore,
  createStoreHook,
  loggerMiddleware,
  persistMiddleware,
  reduxDevToolsMiddleware
} from '@plitzi/nexus';

import { pushLog } from './heroLog';

import type { AsyncResource, Derived, EntityMap, EntityStore, StoreApi, StoreMiddleware } from '@plitzi/nexus';

// Nexus Reactor is the "whole toolkit" cabinet: one idle game wired through persist (autosave + offline earnings),
// a `beforeChange` intercept guard, `createDerived` (live output/sec from four paths), `createAsync` (the Overdrive
// scan), `createEntityStore` (catchable surge orbs), `createEntityAdapter` (the trophy collection),
// `reduxDevToolsMiddleware` (inspect every action), the shared logger, batched atomic writes and fine-grained per-path
// subscriptions.
export type ModuleKey = 'solar' | 'fission' | 'fusion' | 'antimatter' | 'singularity';
export type UpgradeKey = 'autotap' | 'tap' | 'yield' | 'luck' | 'overcharge';

export type Achievement = { id: string; name: string; desc: string; icon: string; unlocked: boolean };

export type ReactorState = {
  energy: number;
  // All-time energy produced — never reset, drives the all-time stat. `earned` since the last meltdown is derived as
  // `lifetime - meltdownAt`, so the hot production tick only writes `energy` + `lifetime`.
  lifetime: number;
  meltdownAt: number;
  clicks: number;
  cores: number;
  modules: Record<ModuleKey, number>;
  upgrades: Record<UpgradeKey, number>;
  achievements: EntityMap<Achievement>;
  lastScan: number;
  boostUntil: number;
  tutorial: number;
  lastSeen: number;
};

export type ModuleDef = {
  key: ModuleKey;
  name: string;
  blurb: string;
  icon: string;
  color: string;
  baseCost: number;
  rate: number;
};

export const MODULES: ModuleDef[] = [
  {
    key: 'solar',
    name: 'Solar Array',
    blurb: 'Photon harvester',
    icon: '☀',
    color: '#fbbf24',
    baseCost: 15,
    rate: 0.3
  },
  {
    key: 'fission',
    name: 'Fission Cell',
    blurb: 'Splits heavy nuclei',
    icon: '⚛',
    color: '#34d399',
    baseCost: 120,
    rate: 2
  },
  {
    key: 'fusion',
    name: 'Fusion Torus',
    blurb: 'A star in a bottle',
    icon: '🌀',
    color: '#22d3ee',
    baseCost: 1300,
    rate: 14
  },
  {
    key: 'antimatter',
    name: 'Antimatter Trap',
    blurb: 'Annihilation yield',
    icon: '✦',
    color: '#c084fc',
    baseCost: 14000,
    rate: 95
  },
  {
    key: 'singularity',
    name: 'Singularity',
    blurb: 'Bends spacetime',
    icon: '⬤',
    color: '#f472b6',
    baseCost: 200000,
    rate: 720
  }
];

export type UpgradeDef = {
  key: UpgradeKey;
  name: string;
  desc: string;
  icon: string;
  color: string;
  baseCost: number;
  max: number;
};

// Talents are bought with cores (the meltdown currency) and permanently change how the reactor plays.
export const UPGRADES: UpgradeDef[] = [
  {
    key: 'tap',
    name: 'Tap Amplifier',
    desc: '+100% tap power per level',
    icon: '👆',
    color: '#f472b6',
    baseCost: 2,
    max: 8
  },
  {
    key: 'yield',
    name: 'Yield Optimizer',
    desc: '+25% reactor output per level',
    icon: '📈',
    color: '#34d399',
    baseCost: 2,
    max: 12
  },
  {
    key: 'autotap',
    name: 'Auto-Tapper',
    desc: 'Taps the core for you',
    icon: '🤖',
    color: '#22d3ee',
    baseCost: 3,
    max: 5
  },
  {
    key: 'luck',
    name: 'Orb Magnet',
    desc: 'Surge orbs appear more often',
    icon: '🧲',
    color: '#fbbf24',
    baseCost: 4,
    max: 4
  },
  {
    key: 'overcharge',
    name: 'Overcharge',
    desc: 'Stronger boosts & Overdrive',
    icon: '🔆',
    color: '#fb7185',
    baseCost: 3,
    max: 6
  }
];

const totalModules = (modules: Record<ModuleKey, number>): number =>
  MODULES.reduce((sum, def) => sum + (modules[def.key] ?? 0), 0);

export const ACHIEVEMENTS: (Omit<Achievement, 'unlocked'> & { test: (state: ReactorState) => boolean })[] = [
  { id: 'spark', name: 'First Spark', desc: 'Tap the core', icon: '✨', test: s => s.clicks >= 1 },
  { id: 'kilo', name: 'Kilowatt', desc: 'Produce 1K energy', icon: '🔋', test: s => s.lifetime >= 1000 },
  { id: 'grid', name: 'Power Grid', desc: 'Own 10 reactors', icon: '🏭', test: s => totalModules(s.modules) >= 10 },
  { id: 'surge', name: 'Power Surge', desc: 'Fire an Overdrive', icon: '🚀', test: s => s.lastScan > 0 },
  { id: 'mega', name: 'Megawatt', desc: 'Produce 1M energy', icon: '⚡', test: s => s.lifetime >= 1_000_000 },
  { id: 'ascend', name: 'Ascension', desc: 'Earn your first core', icon: '◆', test: s => s.cores >= 1 },
  { id: 'fleet', name: 'Reactor Fleet', desc: 'Own 30 reactors', icon: '🛰', test: s => totalModules(s.modules) >= 30 },
  { id: 'giga', name: 'Gigawatt', desc: 'Produce 1B energy', icon: '🌟', test: s => s.lifetime >= 1_000_000_000 }
];

export const achievementAdapter = createEntityAdapter<Achievement>();

const COST_GROWTH = 1.15;
const PERSIST_KEY = 'nexus-reactor-v3';

export const MILESTONE = 10;
export const BOOST_FACTOR = 3;
export const BOOST_MS = 20000;
export const CRIT_CHANCE = 0.14;
export const CRIT_MULT = 8;
export const OFFLINE_CAP_MS = 8 * 3600 * 1000;
export const OFFLINE_RATE = 0.5;

export const moduleCost = (def: ModuleDef, owned: number): number => Math.round(def.baseCost * COST_GROWTH ** owned);

// Total cost to buy `count` of a reactor starting from `owned` (each step gets pricier).
export const bulkModuleCost = (def: ModuleDef, owned: number, count: number): number => {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += moduleCost(def, owned + i);
  }

  return total;
};

// How many of a reactor `energy` can buy at once, starting from `owned`.
export const maxAffordable = (def: ModuleDef, owned: number, energy: number): number => {
  let count = 0;
  let spent = 0;
  while (true) {
    const next = spent + moduleCost(def, owned + count);
    if (next > energy) {
      break;
    }

    spent = next;
    count++;
  }

  return count;
};

export const upgradeCost = (def: UpgradeDef, level: number): number => def.baseCost * (level + 1);

export const milestoneTier = (owned: number): number => Math.floor(owned / MILESTONE);

export const milestoneMult = (owned: number): number => 2 ** milestoneTier(owned);

export const moduleOutput = (def: ModuleDef, owned: number): number => owned * def.rate * milestoneMult(owned);

export const coreMultiplier = (cores: number): number => 1 + cores * 0.12;

// Talent-derived multipliers — one source of truth shared by the engine and the UI.
export const tapMultiplier = (upgrades: Record<UpgradeKey, number>): number => 1 + (upgrades.tap ?? 0);
export const yieldMultiplier = (upgrades: Record<UpgradeKey, number>): number => 1 + 0.25 * (upgrades.yield ?? 0);
export const autoTapRate = (upgrades: Record<UpgradeKey, number>): number => upgrades.autotap ?? 0;
export const orbSpawnChance = (upgrades: Record<UpgradeKey, number>): number =>
  Math.min(0.92, 0.5 + 0.12 * (upgrades.luck ?? 0));
export const boostDuration = (upgrades: Record<UpgradeKey, number>): number =>
  BOOST_MS * (1 + 0.5 * (upgrades.overcharge ?? 0));
export const overdriveScale = (upgrades: Record<UpgradeKey, number>): number => 1 + 0.5 * (upgrades.overcharge ?? 0);

export const unlockedAchievements = (map: EntityMap<Achievement>): Achievement[] =>
  achievementAdapter.selectAll(map).filter(a => a.unlocked);

// Every unlocked trophy adds a permanent +3% to all output — collecting them matters.
export const achievementMultiplier = (map: EntityMap<Achievement>): number =>
  1 + 0.03 * unlockedAchievements(map).length;

export const clickPower = (cores: number, upgrades: Record<UpgradeKey, number>): number =>
  coreMultiplier(cores) * tapMultiplier(upgrades);

// Energy produced per second: module output × core × yield talent × trophy bonus. NOT including the timed boost, which
// is layered on where it's read so the steady-state derived value stays stable.
export const reactorOutput = (
  modules: Record<ModuleKey, number>,
  cores: number,
  upgrades: Record<UpgradeKey, number>,
  achievements: EntityMap<Achievement>
): number => {
  let raw = 0;
  for (const def of MODULES) {
    raw += moduleOutput(def, modules[def.key] ?? 0);
  }

  return raw * coreMultiplier(cores) * yieldMultiplier(upgrades) * achievementMultiplier(achievements);
};

export const boostActive = (boostUntil: number, now: number = Date.now()): boolean => now < boostUntil;

export const earnedSinceMeltdown = (lifetime: number, meltdownAt: number): number => Math.max(0, lifetime - meltdownAt);

export const meltdownReward = (earned: number): number => Math.floor(Math.sqrt(earned / 10000));

export const offlineGain = (lastSeen: number, perSec: number, now: number = Date.now()): number => {
  if (lastSeen <= 0 || perSec <= 0) {
    return 0;
  }

  const elapsed = Math.min(OFFLINE_CAP_MS, Math.max(0, now - lastSeen));

  return (elapsed / 1000) * perSec * OFFLINE_RATE;
};

export const emptyModules = (): Record<ModuleKey, number> => ({
  solar: 0,
  fission: 0,
  fusion: 0,
  antimatter: 0,
  singularity: 0
});

export const emptyUpgrades = (): Record<UpgradeKey, number> => ({
  autotap: 0,
  tap: 0,
  yield: 0,
  luck: 0,
  overcharge: 0
});

export const initialAchievements = (): EntityMap<Achievement> => {
  const map: EntityMap<Achievement> = {};
  for (const def of ACHIEVEMENTS) {
    map[def.id] = { id: def.id, name: def.name, desc: def.desc, icon: def.icon, unlocked: false };
  }

  return map;
};

export const REACTOR_INITIAL: ReactorState = {
  energy: 0,
  lifetime: 0,
  meltdownAt: 0,
  clicks: 0,
  cores: 0,
  modules: emptyModules(),
  upgrades: emptyUpgrades(),
  achievements: initialAchievements(),
  lastScan: 0,
  boostUntil: 0,
  tutorial: 0,
  lastSeen: 0
};

// Interception is just a middleware. This `beforeChange` guard is the reactor's safety rail: energy and cores can never
// go negative and a non-finite write (a stray NaN) is cancelled before it can corrupt the save.
const guard: StoreMiddleware<ReactorState> = () => ({
  beforeChange: ({ path, value }) => {
    if (path === 'energy' || path === 'cores') {
      const next = value as number;
      if (!Number.isFinite(next)) {
        return CANCEL;
      }

      return Math.max(0, next);
    }

    return undefined;
  }
});

// The production tick writes high-frequency paths; streaming those would bury the log. The sink forwards only discrete,
// meaningful events — purchases, talents, trophies, meltdowns, overdrive payouts, boosts.
const NOISY_PATHS = new Set(['energy', 'lifetime', 'clicks', 'tutorial', 'lastSeen']);

export const createReactorStore = (): StoreApi<ReactorState> =>
  createStore<ReactorState>(REACTOR_INITIAL, {
    middlewares: [
      // Persist first so it hydrates the saved game before the others observe anything.
      persistMiddleware<ReactorState>({ key: PERSIST_KEY, version: 3 }),
      guard,
      // Mirrors every committed change into the Redux DevTools extension (a no-op when it isn't installed).
      reduxDevToolsMiddleware<ReactorState>({ name: 'Nexus Reactor' }),
      loggerMiddleware<ReactorState>(change => {
        if (change.path && NOISY_PATHS.has(change.path)) {
          return;
        }

        pushLog(change.path ?? '(root)', change.next);
      })
    ]
  });

export const clearReactorSave = (): void => {
  try {
    globalThis.localStorage?.removeItem(PERSIST_KEY);
  } catch {
    // Storage can be unavailable (privacy mode, SSR) — a failed clear is a no-op, the in-memory reset still happens.
  }
};

export const createReactorOutput = (store: StoreApi<ReactorState>): Derived<number> =>
  createDerived<ReactorState, ['modules', 'cores', 'upgrades', 'achievements'], number>(
    store,
    ['modules', 'cores', 'upgrades', 'achievements'],
    ([modules, cores, upgrades, achievements]) => reactorOutput(modules, cores, upgrades, achievements)
  );

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// The Overdrive scan: an async resource that, after a short charge, banks ~25 seconds of production (scaled by the
// Overcharge talent, with a floor). `useAsync` surfaces the pending/success status; the reward writes to `lastScan`.
export const createReactorOverdrive = (
  store: StoreApi<ReactorState>,
  output: Derived<number>
): AsyncResource<number, []> =>
  createAsync<ReactorState, 'lastScan', []>(store, 'lastScan', async () => {
    await wait(2000);
    const scale = overdriveScale(store.get('upgrades') ?? emptyUpgrades());
    const reward = Math.max(80, Math.round(output.get() * 25 * scale));
    store.batch(() => {
      store.set('energy', e => e + reward);
      store.set('lifetime', e => e + reward);
    });

    return reward;
  });

// Surge orbs live in their own entity store (not the persisted game state): ephemeral, spawned and expired on a timer,
// each an independent reactive entity rendered with `useAll`.
export type OrbKind = 'energy' | 'boost' | 'core' | 'jackpot' | 'frenzy';

export type Orb = { id: string; kind: OrbKind; x: number; y: number; dx: number; dy: number; bornAt: number };

export const ORB_TTL = 6500;

export const ORB_META: Record<OrbKind, { icon: string; color: string; label: string; effect: string }> = {
  energy: { icon: '⚡', color: '#fbbf24', label: 'Energy surge', effect: '+25s energy' },
  boost: {
    icon: '🔥',
    color: '#fb7185',
    label: 'Overboost',
    effect: `${BOOST_FACTOR}× for ${BOOST_MS / 1000}s`
  },
  core: { icon: '◆', color: '#c4b5fd', label: 'Spare core', effect: '+1 core' },
  jackpot: { icon: '💎', color: '#38bdf8', label: 'Jackpot', effect: 'huge energy' },
  frenzy: { icon: '🌟', color: '#f59e0b', label: 'Frenzy', effect: '5× frenzy' }
};

export const createOrbStore = (): EntityStore<Orb> => createEntityStore<Orb>([]);

export const { useStore: useReactor } = createStoreHook<ReactorState>();

export type TutorialStep = { text: string; highlight: 'core' | 'shop' | 'orb' | 'overdrive' | 'meltdown' };

export const TUTORIAL: TutorialStep[] = [
  { text: 'Tap the glowing core to generate energy by hand.', highlight: 'core' },
  { text: 'Buy a Solar Array — it produces energy on its own, forever.', highlight: 'shop' },
  { text: 'Catch a surge orb drifting by for a bonus (see the legend).', highlight: 'orb' },
  { text: 'Hit Overdrive for an instant burst of energy.', highlight: 'overdrive' },
  { text: 'Stack reactors, then Meltdown for cores — spend them on Talents.', highlight: 'meltdown' }
];

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];

export const fmt = (n: number): string => {
  if (!Number.isFinite(n)) {
    return '0';
  }

  const abs = Math.abs(n);
  if (abs < 1000) {
    return abs < 100 && !Number.isInteger(n) ? n.toFixed(1) : Math.floor(n).toString();
  }

  const tier = Math.min(UNITS.length - 1, Math.floor(Math.log10(abs) / 3));
  const scaled = n / 1000 ** tier;
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;

  return scaled.toFixed(digits) + UNITS[tier];
};
