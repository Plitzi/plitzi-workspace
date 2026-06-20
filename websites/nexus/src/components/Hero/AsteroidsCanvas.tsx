import { useRef } from 'react';

import { useGamePublish } from './heroStore';
import useAsteroids from './useAsteroids';

const AsteroidsCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useAsteroids(canvasRef, useGamePublish());

  return <canvas ref={canvasRef} className="block h-full w-full" />;
};

export default AsteroidsCanvas;
