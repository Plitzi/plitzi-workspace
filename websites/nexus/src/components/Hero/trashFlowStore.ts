import { useCallback } from 'react';

import { createStoreHook } from '@plitzi/nexus';

// Trash Flow keeps its gameplay readouts (points, value, level, battery, phase) and the upgrade levels in one Nexus
// store, streamed to the log panel through a logger sink. The huge confetti field lives in a separate
// `createEntityStore` (one entity per scrap) that the engine writes to as you vacuum — the "managed by Nexus" showcase
// scaled up to a big map.
export type StatKey = 'battery' | 'pipe' | 'air' | 'radius' | 'value';

export type TrashStats = Record<StatKey, number>;

export type TrashPhase = 'playing' | 'summary' | 'shop';

export type TrashHud = {
  points: number;
  value: number;
  level: number;
  levelPct: number;
  cleared: boolean;
  batteryPct: number;
  remaining: number;
  phase: TrashPhase;
  run: number;
  runPoints: number;
  runCollected: number;
  runCleanedPct: number;
  allTimePoints: number;
};

export type TrashFlowState = {
  hud: TrashHud;
  stats: TrashStats;
};

export const makeTrashFlowInitial = (): TrashFlowState => ({
  hud: {
    points: 0,
    value: 0,
    level: 1,
    levelPct: 0,
    cleared: false,
    batteryPct: 100,
    remaining: 0,
    phase: 'playing',
    run: 1,
    runPoints: 0,
    runCollected: 0,
    runCleanedPct: 0,
    allTimePoints: 0
  },
  stats: { battery: 1, pipe: 1, air: 1, radius: 1, value: 1 }
});

// Derived stat values from upgrade levels. One source of truth shared by the engine and the upgrade shop.
export const valuePerScrap = (lvl: number) => 8 + lvl * 5;
export const batterySeconds = (lvl: number) => 18 + lvl * 5;
export const pipeCapacity = (lvl: number) => 4 + lvl * 2;
// Per-frame fraction a scrap eases toward the vacuum. Deliberately slow at level 1 so the pull is gentle, and clearly
// faster with every Air Speed upgrade — the skill, made visible.
export const airPull = (lvl: number) => 0.012 + lvl * 0.016;
export const suctionRadius = (lvl: number) => 90 + lvl * 24;

// Progression is tuned for a long climb: reaching level 10 should be a couple hours of play, not a 30-minute sprint.
// The target haul rises every level while the battery drains faster and the level-clear refund shrinks, so each level
// is clearly harder than the last and you only push deeper by re-investing many runs' worth of upgrades.
export const levelTarget = (lvl: number) => 250 + 200 * (lvl - 1);

// Battery drains faster on deeper levels — the run clock tightens sharply as you climb.
export const drainMultiplier = (lvl: number) => 1 + (lvl - 1) * 0.12;

// Fraction of a full battery refunded when a level is cleared. Generous early, almost nothing late.
export const advanceRefund = (lvl: number) => Math.max(0.04, 0.3 - (lvl - 1) * 0.03);

// Costs are tuned against a round's haul: a round should bank roughly one or two upgrades' worth, and the cost grows
// faster (exponential) than a run's yield, so deeper upgrades take ~2 rounds to save for. The base sits just under a
// first run's haul so the very first shop visit can always afford something instead of every button being greyed out.
const COST_BASE: Record<StatKey, number> = { battery: 240, pipe: 300, air: 280, radius: 290, value: 340 };
const COST_GROWTH = 1.55;

export const upgradeCost = (key: StatKey, lvl: number) => Math.round(COST_BASE[key] * COST_GROWTH ** (lvl - 1));

export const { useStore: useTrashFlow, useStoreSetter: useTrashSetter } = createStoreHook<TrashFlowState>();

export type TrashPatch = Partial<TrashHud> & { stats?: TrashStats };

export const useTrashPublish = () => {
  const set = useTrashSetter();

  return useCallback(
    (patch: TrashPatch) => {
      (Object.keys(patch) as (keyof TrashPatch)[]).forEach(key => {
        const value = patch[key];
        if (value === undefined) {
          return;
        }

        if (key === 'stats') {
          set('stats', value as TrashStats);
        } else {
          set(`hud.${key as keyof TrashHud}`, value as TrashHud[keyof TrashHud]);
        }
      });
    },
    [set]
  );
};
