import classNames from 'classnames';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';

import { drawByLiveStream, initialCanvasSetup } from './helpers'; //  drawByBlob, getBarsData,
// import { useWebWorker } from '../../hooks/useWebWorker';

import type { RefObject } from 'react';

export type VoiceVisualizerProps = {
  className?: string;
  audioData?: Uint8Array<ArrayBuffer>;
  recordingPaused?: boolean;
  isRecording?: boolean;
  speed?: number;
  backgroundColor?: string;
  mainBarColor?: string;
  barWidth?: number;
  gap?: number;
  rounded?: number;
  animateCurrentPick?: boolean;
  fullscreen?: boolean;
  ref?: RefObject<HTMLCanvasElement | null>;
};

const VoiceVisualizer = ({
  ref,
  className = 'h-[100px]',
  audioData,
  recordingPaused = false,
  isRecording = false,
  speed = 3,
  backgroundColor = 'transparent',
  mainBarColor = '#FFFFFF',
  barWidth = 2,
  gap = 1,
  rounded = 5,
  animateCurrentPick = true,
  fullscreen = false
}: VoiceVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  useImperativeHandle(ref, () => canvasRef.current!, [canvasRef]);
  const formattedSpeed = Math.trunc(speed);
  const formattedGap = Math.trunc(gap);
  const formattedBarWidth = Math.trunc(barWidth);
  const unit = formattedBarWidth + formattedGap * formattedBarWidth;
  const picksRef = useRef([]);
  const indexSpeedRef = useRef(formattedSpeed);
  const indexRef = useRef(formattedBarWidth);
  const index2Ref = useRef(formattedBarWidth);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const { width, height } = canvasRef.current.getBoundingClientRect();
    setSize({ width, height });
  }, []);

  // const {
  //   result: barsData,
  //   setResult: setBarsData,
  //   run
  // } = useWebWorker({ fn: getBarsData, initialValue: [], onMessageReceived: completedAudioProcessing });

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    if (indexSpeedRef.current >= formattedSpeed || !audioData?.length) {
      indexSpeedRef.current = 0;
      drawByLiveStream({
        audioData,
        unit,
        index: indexRef,
        index2: index2Ref,
        canvas: canvasRef.current,
        picks: picksRef.current,
        isRecording,
        isPausedRecording: recordingPaused,
        backgroundColor,
        mainBarColor,
        barWidth: formattedBarWidth,
        rounded,
        animateCurrentPick,
        fullscreen
      });
    }

    indexSpeedRef.current += 1;
  }, [
    audioData,
    formattedBarWidth,
    backgroundColor,
    mainBarColor,
    rounded,
    isRecording,
    recordingPaused,
    fullscreen,
    formattedSpeed,
    unit,
    animateCurrentPick
  ]);

  // useEffect(() => {
  //   if (!bufferFromRecordedBlob || !canvasRef.current || isRecording) {
  //     return;
  //   }

  //   if (onlyRecording) {
  //     clearCanvas();

  //     return;
  //   }

  //   picksRef.current = [];
  //   const bufferData = bufferFromRecordedBlob.getChannelData(0);

  //   run({
  //     bufferData,
  //     height: size?.height ?? 0,
  //     width: size?.width ?? 0,
  //     barWidth: formattedBarWidth,
  //     gap: formattedGap
  //   });
  // }, [bufferFromRecordedBlob, gap, barWidth, size]);

  // useEffect(() => {
  //   if (onlyRecording || !barsData?.length || !canvasRef.current) return;

  //   if (isCleared) {
  //     setBarsData([]);

  //     return;
  //   }

  //   drawByBlob({
  //     barsData,
  //     canvas: canvasRef.current,
  //     barWidth: formattedBarWidth,
  //     gap: formattedGap,
  //     backgroundColor,
  //     mainBarColor,
  //     rounded
  //   });
  // }, [barsData, isCleared, rounded, backgroundColor, mainBarColor]);

  useEffect(() => {
    if (canvasRef.current) {
      initialCanvasSetup({ canvas: canvasRef.current, backgroundColor });
    }
  }, [backgroundColor]);

  // function completedAudioProcessing() {
  //   if (audioRef?.current) {
  //     audioRef.current.src = audioSrc;
  //   }
  // }

  return (
    <canvas className={classNames('w-full', className)} ref={canvasRef} {...size}>
      Your browser does not support HTML5 Canvas.
    </canvas>
  );
};

export default VoiceVisualizer;
