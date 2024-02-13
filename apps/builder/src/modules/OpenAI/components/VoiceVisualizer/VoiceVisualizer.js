// Packages
import React, { useEffect, useLayoutEffect, forwardRef, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { drawByLiveStream, initialCanvasSetup } from './helpers'; //  drawByBlob, getBarsData,
// import { useWebWorker } from '../../hooks/useWebWorker';

const autioDataDefault = [];

const VoiceVisualizer = forwardRef(
  (
    {
      className = 'h-[100px]',
      audioData = autioDataDefault,
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
    },
    ref
  ) => {
    const formattedSpeed = Math.trunc(speed);
    const formattedGap = Math.trunc(gap);
    const formattedBarWidth = Math.trunc(barWidth);
    const unit = formattedBarWidth + formattedGap * formattedBarWidth;

    const canvasRef = ref ?? useRef(ref);
    const picksRef = useRef([]);
    const indexSpeedRef = useRef(formattedSpeed);
    const indexRef = useRef(formattedBarWidth);
    const index2Ref = useRef(formattedBarWidth);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
      if (!canvasRef.current) {
        return;
      }

      const { width, height } = canvasRef.current.getBoundingClientRect();
      setSize({ width, height });
    }, [canvasRef.current]);

    // const {
    //   result: barsData,
    //   setResult: setBarsData,
    //   run
    // } = useWebWorker({ fn: getBarsData, initialValue: [], onMessageReceived: completedAudioProcessing });

    useLayoutEffect(() => {
      if (!canvasRef.current) {
        return;
      }

      if (indexSpeedRef.current >= formattedSpeed || !audioData.length) {
        indexSpeedRef.current = 0;
        drawByLiveStream({
          audioData,
          unit,
          index: indexRef,
          index2: index2Ref,
          canvas: canvasRef.current,
          picks: picksRef.current,
          isRecording,
          recordingPaused,
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
      canvasRef.current,
      audioData,
      formattedBarWidth,
      backgroundColor,
      mainBarColor,
      rounded,
      isRecording,
      recordingPaused,
      fullscreen
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
    }, [canvasRef.current, backgroundColor]);

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
  }
);

VoiceVisualizer.propTypes = {
  className: PropTypes.string,
  audioData: PropTypes.array,
  speed: PropTypes.number,
  backgroundColor: PropTypes.string,
  mainBarColor: PropTypes.string,
  barWidth: PropTypes.number,
  gap: PropTypes.number,
  rounded: PropTypes.number,
  animateCurrentPick: PropTypes.bool,
  recordingPaused: PropTypes.bool,
  isRecording: PropTypes.bool,
  fullscreen: PropTypes.bool
};

export default VoiceVisualizer;
