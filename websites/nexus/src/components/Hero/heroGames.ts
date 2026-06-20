import Game2048 from './Game2048';
import { type GamePublish, type GameStats } from './heroStore';
import MoleHunt from './MoleHunt';
import TicTacToe from './TicTacToe';
import TrashFlow from './TrashFlow';
import useAsteroids from './useAsteroids';
import useBreakout from './useBreakout';
import usePong from './usePong';
import useSpaceInvaders from './useSpaceInvaders';

import type { ComponentType, RefObject } from 'react';

export type StatConfig = { label: string; key: keyof GameStats };

export type PowerInfo = { letter: string; color: string; label: string };

// A canvas engine hook: it owns the rAF loop and draws into the canvas, publishing scoreboard stats to the shared store.
// Hosted by GameCanvas. Self-contained games (their own store/DOM) provide a `Component` instead.
export type CanvasEngine = (canvasRef: RefObject<HTMLCanvasElement | null>, publish: GamePublish) => void;

type GameBase = {
  id: string;
  name: string;
  // The Nexus capability this game puts on display — shown next to the switcher to tie the arcade to the product.
  feature: string;
  // Cabinet art for the arcade menu: a glyph and a one-line hook.
  icon: string;
  tagline: string;
  stats: StatConfig[];
  // Drives the on-screen power-up legend; only games that drop power-ups define it.
  powerups?: PowerInfo[];
  // Self-contained games (their own store) opt out of the shared top scoreboard.
  hideScoreboard?: boolean;
};

export type GameDef = GameBase & ({ engine: CanvasEngine } | { Component: ComponentType });

// Every game is one canvas engine writing to the shared Nexus store. Each declares which store paths its scoreboard
// should surface, so the same four cells relabel themselves per game without any special-casing.
export const GAMES: GameDef[] = [
  {
    id: 'invaders',
    name: 'Invaders',
    engine: useSpaceInvaders,
    feature: 'path subscriptions',
    icon: '🛸',
    tagline: 'Hold the line against the swarm',
    stats: [
      { label: 'Score', key: 'score' },
      { label: 'Wave', key: 'level' },
      { label: 'Lives', key: 'lives' },
      { label: 'Best', key: 'best' }
    ],
    powerups: [
      { letter: 'R', color: '#fbbf24', label: 'Rapid fire' },
      { letter: 'S', color: '#34d399', label: '3-way spread' },
      { letter: '◇', color: '#60a5fa', label: 'Shield' },
      { letter: '+', color: '#f472b6', label: 'Extra life' }
    ]
  },
  {
    id: 'breakout',
    name: 'Breakout',
    engine: useBreakout,
    feature: 'logger middleware',
    icon: '🧱',
    tagline: 'Chip through every brick',
    stats: [
      { label: 'Score', key: 'score' },
      { label: 'Level', key: 'level' },
      { label: 'Lives', key: 'lives' },
      { label: 'Best', key: 'best' }
    ],
    powerups: [
      { letter: 'W', color: '#34d399', label: 'Wider paddle' },
      { letter: 'S', color: '#60a5fa', label: 'Slow ball' },
      { letter: '3', color: '#fbbf24', label: 'Multiball' },
      { letter: '+', color: '#f472b6', label: 'Extra life' }
    ]
  },
  {
    id: 'pong',
    name: 'Pong',
    engine: usePong,
    feature: 'fine-grained re-renders',
    icon: '🏓',
    tagline: 'Out-rally the machine',
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
    engine: useAsteroids,
    feature: 'high-frequency writes',
    icon: '☄️',
    tagline: 'Drift, dodge and blast',
    stats: [
      { label: 'Score', key: 'score' },
      { label: 'Wave', key: 'level' },
      { label: 'Lives', key: 'lives' },
      { label: 'Best', key: 'best' }
    ],
    powerups: [
      { letter: 'R', color: '#fbbf24', label: 'Rapid fire' },
      { letter: '3', color: '#34d399', label: 'Triple shot' },
      { letter: '◇', color: '#60a5fa', label: 'Shield' }
    ]
  },
  {
    id: '2048',
    name: '2048',
    Component: Game2048,
    feature: 'time-travel',
    icon: '🔢',
    tagline: 'Merge tiles, rewind time',
    hideScoreboard: true,
    stats: []
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    Component: TicTacToe,
    feature: 'derived values',
    icon: '⭕',
    tagline: 'Outsmart the unbeatable grid',
    hideScoreboard: true,
    stats: []
  },
  {
    id: 'molehunt',
    name: 'Mole Hunt',
    Component: MoleHunt,
    feature: 'entity store',
    icon: '🎯',
    tagline: 'Whack moles, dodge bombs',
    hideScoreboard: true,
    stats: []
  },
  {
    id: 'trashflow',
    name: 'Trash Flow',
    Component: TrashFlow,
    feature: 'entity store at scale',
    icon: '🧹',
    tagline: 'Vacuum a huge confetti map',
    hideScoreboard: true,
    stats: []
  }
];
