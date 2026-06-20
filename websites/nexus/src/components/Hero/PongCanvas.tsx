import { useRef } from 'react';

import { useGamePublish } from './heroStore';
import usePong from './usePong';

const PongCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePong(canvasRef, useGamePublish());

  return <canvas ref={canvasRef} className="block h-full w-full" />;
};

export default PongCanvas;
