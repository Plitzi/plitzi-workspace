import { useRef } from 'react';

import { useGamePublish } from './heroStore';
import useBreakout from './useBreakout';

const BreakoutCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useBreakout(canvasRef, useGamePublish());

  return <canvas ref={canvasRef} className="block h-full w-full" />;
};

export default BreakoutCanvas;
