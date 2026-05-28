import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const useStreamingText = () => {
  const [streamingText, setStreamingText] = useState('');
  const textRef = useRef('');
  const bufferRef = useRef('');
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopInterval = () => {
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
  };

  const drainBuffer = () => {
    if (bufferRef.current) {
      textRef.current += bufferRef.current;
      bufferRef.current = '';
    }
  };

  const appendChunk = useCallback((text: string) => {
    bufferRef.current += text;

    if (!flushIntervalRef.current) {
      flushIntervalRef.current = setInterval(() => {
        if (bufferRef.current) {
          textRef.current += bufferRef.current;
          flushSync(() => setStreamingText(textRef.current));
          bufferRef.current = '';
        }
      }, 30);
    }
  }, []);

  const flush = useCallback(() => {
    drainBuffer();
    if (textRef.current) {
      flushSync(() => setStreamingText(textRef.current));
    }

    textRef.current = '';
    flushSync(() => setStreamingText(''));
    stopInterval();
  }, []);

  const capture = useCallback((): string => {
    drainBuffer();
    const captured = textRef.current;
    textRef.current = '';
    flushSync(() => setStreamingText(''));
    stopInterval();

    return captured;
  }, []);

  return { streamingText, appendChunk, flush, capture };
};

export default useStreamingText;
