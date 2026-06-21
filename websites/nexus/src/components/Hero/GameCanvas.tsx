import { useRef } from 'react';

import { useGamePublish } from './heroStore';

import type { CanvasEngine } from './heroGames';

// One canvas host for every engine-driven game, replacing the per-game wrapper components. The engine hook owns the rAF
// loop, physics and rendering; this only provides the element and wires the shared Nexus publish. Cabinets are keyed by
// id upstream, so switching games remounts this and the engine starts fresh.
const GameCanvas = ({ engine }: { engine: CanvasEngine }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  engine(canvasRef, useGamePublish());

  return <canvas ref={canvasRef} className="block h-full w-full" />;
};

export default GameCanvas;
