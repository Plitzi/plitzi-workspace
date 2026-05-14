import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import LiveEntry from './components/LiveEntry';
import { estimateSize, PADDING } from './helpers';
import { useAiChatContext } from '../../contexts/AiChatContext';
import ChatMessage from '../ChatMessage';

import type { AiMessage, AiToolCall } from '../../types';
import type { Ref } from 'react';

export type ChatProps = {
  ref?: Ref<HTMLDivElement>;
  messages: AiMessage[];
  isStreaming?: boolean;
  isBusy?: boolean;
  streamingText?: string;
  liveThinking?: string;
  liveThinkingDoneMs?: number;
  liveTools?: AiToolCall[];
};

const Chat = ({
  ref,
  messages = [],
  isStreaming,
  isBusy,
  streamingText,
  liveThinking,
  liveThinkingDoneMs,
  liveTools = []
}: ChatProps) => {
  const { currentMode } = useAiChatContext();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottom = useRef(true);
  useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement, []);

  const hasLive = isStreaming || !!(liveThinking || liveTools.length || streamingText);
  const count = messages.length + (hasLive ? 1 : 0);

  const previewVersions = useMemo(() => {
    const map: Record<string, { stage: number; wireframe: number }> = {};
    let stageCount = 0;
    let wireframeCount = 0;
    for (const msg of messages) {
      const hasStage = msg.tools?.some(t => t.name === 'stage_preview' && t.status === 'done') ?? false;
      const hasWire = msg.tools?.some(t => t.name === 'sketch_wireframe' && t.status === 'done') ?? false;
      map[msg.id] = { stage: hasStage ? ++stageCount : 0, wireframe: hasWire ? ++wireframeCount : 0 };
    }

    return map;
  }, [messages]);

  const getScrollElement = useCallback(() => scrollRef.current, []);
  const getItemKey = useCallback((i: number) => (i === messages.length ? 'live' : messages[i].id), [messages]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement,
    estimateSize,
    overscan: 3,
    paddingStart: PADDING,
    paddingEnd: PADDING,
    getItemKey
  });

  const totalSize = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const onScroll = () => {
      isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const prevLenRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLenRef.current && messages[messages.length - 1]?.role === 'user') {
      isAtBottom.current = true;
    }

    prevLenRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, liveThinking, liveTools]);

  const prevTotalSize = useRef(0);
  useEffect(() => {
    if (totalSize === prevTotalSize.current) {
      return;
    }

    prevTotalSize.current = totalSize;
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [totalSize]);

  return (
    <div ref={scrollRef} className="flex min-h-0 grow basis-0 flex-col overflow-y-auto px-4">
      {count === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <div
            className={clsx(
              'grid h-8 w-8 place-items-center rounded-lg border border-neutral-300 bg-neutral-50 font-mono text-base font-bold dark:border-zinc-700 dark:bg-zinc-800',
              {
                'border-emerald-500/50 text-emerald-500 dark:border-emerald-400/50 dark:text-emerald-400':
                  currentMode === 'build',
                'border-sky-500/50 text-sky-500 dark:border-sky-400/50 dark:text-sky-400': currentMode === 'plan'
              }
            )}
          >
            P
          </div>
          <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            Ask me anything about your space.
          </p>
          <p className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">Voice · Images · Tools</p>
        </div>
      )}

      {count > 0 && (
        <div style={{ height: totalSize, position: 'relative' }}>
          {virtualItems.map(({ index, start, key }) => {
            const isLive = index === messages.length;
            const msg = !isLive ? messages[index] : undefined;
            const versions = msg ? previewVersions[msg.id] : undefined;

            return (
              <div
                key={key}
                ref={virtualizer.measureElement}
                data-index={index}
                style={{ position: 'absolute', top: 0, transform: `translateY(${start}px)`, width: '100%' }}
                className="pb-4"
              >
                {isLive && (
                  <LiveEntry
                    isStreaming={isStreaming}
                    isBusy={isBusy}
                    streamingText={streamingText}
                    liveThinking={liveThinking}
                    liveThinkingDoneMs={liveThinkingDoneMs}
                    liveTools={liveTools}
                  />
                )}
                {msg && (
                  <ChatMessage {...msg} stagePreviewVersion={versions?.stage} wireframeVersion={versions?.wireframe} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Chat;
