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
  runDoubled: boolean;
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
    runDoubled: false,
    allTimePoints: 0
  },
  stats: { battery: 1, pipe: 1, air: 1, radius: 1, value: 1 }
});

// Derived stat values from upgrade levels. One source of truth shared by the engine and the upgrade shop.
export const valuePerScrap = (lvl: number) => 6 + lvl * 4;
export const batterySeconds = (lvl: number) => 16 + lvl * 4;
export const pipeCapacity = (lvl: number) => 4 + lvl * 2;
// Per-frame fraction a scrap eases toward the vacuum. Deliberately slow at level 1 so the pull is gentle, and clearly
// faster with every Air Speed upgrade — the skill, made visible.
export const airPull = (lvl: number) => 0.012 + lvl * 0.016;
export const suctionRadius = (lvl: number) => 90 + lvl * 24;

// Points needed to clear a level. Earnings are capped by this (the level ends when you hit it), so costs are tuned
// against it: a level's haul buys you roughly one upgrade.
export const levelTarget = (lvl: number) => Math.round(240 * lvl ** 1.3);

// Costs scale with the upgrade level so a stat gets pricier the more you pump it, but each stays affordable against a
// level's target haul — purchases actually happen instead of every button being greyed out.
const COST_BASE: Record<StatKey, number> = { battery: 200, pipe: 280, air: 240, radius: 260, value: 360 };

export const upgradeCost = (key: StatKey, lvl: number) => Math.round(COST_BASE[key] * lvl ** 1.4);

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
