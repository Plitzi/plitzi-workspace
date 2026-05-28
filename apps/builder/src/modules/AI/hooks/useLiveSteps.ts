import { useCallback, useRef, useState } from 'react';

import type { AiLiveStep, AiMessageStep, AiStreamEvent } from '../types';

type ThinkingEvent = Extract<AiStreamEvent, { type: 'thinking' }>;
type ToolStartEvent = Extract<AiStreamEvent, { type: 'tool_start' }>;
type ToolEvent = Extract<AiStreamEvent, { type: 'tool' }>;
type ResourceReadEvent = Extract<AiStreamEvent, { type: 'resource_read' }>;

const useLiveSteps = (capture: () => string) => {
  const [liveSteps, setLiveSteps] = useState<AiLiveStep[]>([]);
  const stepsRef = useRef<AiLiveStep[]>([]);
  stepsRef.current = liveSteps;

  const clear = useCallback(() => setLiveSteps([]), []);

  const onThinking = useCallback(
    (event: ThinkingEvent) => {
      const last = stepsRef.current.at(-1);
      const isAppending = last?.type === 'thinking' && !last.done;

      if (isAppending) {
        setLiveSteps(prev => {
          const l = prev.at(-1);
          if (l?.type === 'thinking' && !l.done) {
            return [...prev.slice(0, -1), { ...l, text: l.text + event.text }];
          }

          return prev;
        });
      } else {
        const committed = capture();
        setLiveSteps(prev => {
          const withText = committed ? [...prev, { type: 'text' as const, text: committed }] : prev;

          return [...withText, { type: 'thinking', text: event.text, done: false, startMs: Date.now() }];
        });
      }
    },
    [capture]
  );

  const onChunk = useCallback(() => {
    setLiveSteps(prev => {
      const last = prev.at(-1);
      if (last?.type === 'thinking' && !last.done) {
        return [...prev.slice(0, -1), { ...last, done: true, durationMs: Date.now() - last.startMs }];
      }

      return prev;
    });
  }, []);

  const onToolStart = useCallback(
    (event: ToolStartEvent) => {
      const committed = capture();
      setLiveSteps(prev => {
        const last = prev.at(-1);
        const withThinkingClosed =
          last?.type === 'thinking' && !last.done
            ? [...prev.slice(0, -1), { ...last, done: true, durationMs: Date.now() - last.startMs }]
            : prev;
        const withText = committed
          ? [...withThinkingClosed, { type: 'text' as const, text: committed }]
          : withThinkingClosed;
        const alreadyRunning = withText.some(s => s.type === 'tool' && s.name === event.name && s.status === 'running');

        if (alreadyRunning) {
          return withText;
        }

        return [
          ...withText,
          { type: 'tool', id: crypto.randomUUID(), name: event.name, args: event.args, status: 'running' }
        ];
      });
    },
    [capture]
  );

  const onTool = useCallback((event: ToolEvent) => {
    setLiveSteps(prev => {
      let targetIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const s = prev[i];
        if (s.type === 'tool' && s.name === event.name && s.status === 'running') {
          targetIdx = i;
          break;
        }
      }

      if (targetIdx === -1) {
        return prev;
      }

      return prev.map((s, i) => (i === targetIdx ? { ...s, result: event.result, status: event.status } : s));
    });
  }, []);

  const onResourceRead = useCallback((event: ResourceReadEvent) => {
    setLiveSteps(prev => [...prev, { type: 'resource', name: event.name, uri: event.uri }]);
  }, []);

  const snapshotAsMessageSteps = useCallback((): AiMessageStep[] => {
    return stepsRef.current.map(s => {
      if (s.type === 'thinking') {
        return { type: 'thinking', text: s.text, durationMs: s.durationMs };
      }

      if (s.type === 'tool') {
        return {
          type: 'tool',
          id: s.id,
          name: s.name,
          args: s.args,
          result: s.result,
          status: s.status === 'running' ? ('interrupted' as const) : s.status
        };
      }

      if (s.type === 'resource') {
        return { type: 'resource', name: s.name, uri: s.uri };
      }

      return { type: 'text', text: s.text };
    });
  }, []);

  return { liveSteps, clear, onThinking, onChunk, onToolStart, onTool, onResourceRead, snapshotAsMessageSteps };
};

export default useLiveSteps;
