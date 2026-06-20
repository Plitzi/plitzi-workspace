import AsteroidsCanvas from './AsteroidsCanvas';
import BreakoutCanvas from './BreakoutCanvas';
import Game2048 from './Game2048';
import { type GameStats } from './heroStore';
import PongCanvas from './PongCanvas';
import SpaceInvaders from './SpaceInvaders';

import type { ComponentType } from 'react';

export type StatConfig = { label: string; key: keyof GameStats };

export type GameDef = {
  id: string;
  name: string;
  Component: ComponentType;
  // The Nexus capability this game puts on display — shown next to the switcher to tie the arcade to the product.
  feature: string;
  stats: StatConfig[];
  // Self-contained games (their own store) opt out of the shared top scoreboard.
  hideScoreboard?: boolean;
};

// Every game is one canvas engine writing to the shared Nexus store. Each declares which store paths its scoreboard
// should surface, so the same four cells relabel themselves per game without any special-casing.
export const GAMES: GameDef[] = [
  {
    id: 'invaders',
    name: 'Invaders',
    Component: SpaceInvaders,
    feature: 'path subscriptions',
    stats: [
      { label: 'Score', key: 'score' },
      { label: 'Wave', key: 'level' },
      { label: 'Lives', key: 'lives' },
      { label: 'Best', key: 'best' }
    ]
  },
  {
    id: 'breakout',
    name: 'Breakout',
    Component: BreakoutCanvas,
    feature: 'logger middleware',
    stats: [
      { label: 'Score', key: 'score' },
      { label: 'Level', key: 'level' },
      { label: 'Lives', key: 'lives' },
      { label: 'Best', key: 'best' }
    ]
  },
  {
    id: 'pong',
    name: 'Pong',
    Component: PongCanvas,
    feature: 'fine-grained re-renders',
    stats: [
      { label: 'Score', key: 'score' },
      { label: 'Rally', key: 'level' },
      { label: 'Lives', key: 'lives' },
      { label: 'Best', key: 'best' }
    ]
  },
  {
    id: 'asteroids',
    name: 'Asteroids',
    Component: AsteroidsCanvas,
    feature: 'high-frequency writes',
    stats: [
      { label: 'Score', key: 'score' },
      { label: 'Wave', key: 'level' },
      { label: 'Lives', key: 'lives' },
      { label: 'Best', key: 'best' }
    ]
  },
  {
    id: '2048',
    name: '2048',
    Component: Game2048,
    feature: 'time-travel',
    hideScoreboard: true,
    stats: []
  }
];
