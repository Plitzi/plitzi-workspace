import { useCallback } from 'react';

import { createStoreHook } from '@plitzi/nexus';

// The whole arcade lives in one Nexus store, shared across every game. Each engine runs physics in refs (per-frame
// sprite positions don't belong in a store) and publishes only discrete events — a hit, a level, a lost life — by
// path. The scoreboard subscribes to those paths; a `loggerMiddleware` sink streams every committed write to the live
// log panel. Same writes, two reactive consumers.
export type GameStats = {
  score: number;
  best: number;
  level: number;
  lives: number;
  hits: number;
};

export type HeroState = {
  game: GameStats;
};

export const HERO_INITIAL: HeroState = {
  game: { score: 0, best: 0, level: 1, lives: 3, hits: 0 }
};

export type GamePublish = (changes: Partial<GameStats>) => void;

export const { useStore: useHeroStore, useStoreSetter: useHeroSetter } = createStoreHook<HeroState>();

// Maps a partial game state onto per-path writes, so the logger streams clean lines and the scoreboard wakes one cell
// at a time.
export const useGamePublish = (): GamePublish => {
  const set = useHeroSetter();

  return useCallback(
    (changes: Partial<GameStats>) => {
      (Object.keys(changes) as (keyof GameStats)[]).forEach(key => {
        const value = changes[key];
        if (value !== undefined) {
          set(`game.${key}`, value);
        }
      });
    },
    [set]
  );
};
