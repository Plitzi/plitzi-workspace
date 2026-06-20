import { useRef } from 'react';

import { useGamePublish } from './heroStore';
import useSpaceInvaders from './useSpaceInvaders';

const SpaceInvaders = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useSpaceInvaders(canvasRef, useGamePublish());

  return <canvas ref={canvasRef} className="block h-full w-full" />;
};

export default SpaceInvaders;
