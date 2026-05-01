import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef } from 'react';

import ChatMessage from '../ChatMessage';
import LiveEntry from './LiveEntry';
import TimelineDot from './TimelineDot';

import type { AiMessage, AiToolCall } from '../../types';
import type { RefObject } from 'react';

export type ChatProps = {
  ref?: RefObject<HTMLDivElement | null>;
  messages: AiMessage[];
  streamingText?: string;
  liveThinking?: string;
  liveTools?: AiToolCall[];
};

const PADDING = 12; // py-3

const estimateSize = () => 160;

const Chat = ({ ref, messages = [], streamingText, liveThinking, liveTools = [] }: ChatProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottom = useRef(true);

  const hasLive = !!(liveThinking || liveTools.length || streamingText);
  const count = messages.length + (hasLive ? 1 : 0);

  const getScrollElement = useCallback(() => scrollRef.current, []);

  const getItemKey = useCallback(
    // Stable key per item — prevents DOM node recycling across different messages.
    (index: number) => (index === messages.length ? 'live' : messages[index].id),
    [messages]
  );

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

  // Track whether the user is near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const onScroll = () => {
      isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => el.removeEventListener('scroll', onScroll);
  }, [liveThinking]);

  // When totalSize grows (measurements settling), keep the user at the bottom.
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

  const setRef = (el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (ref) {
      ref.current = el;
    }
  };

  return (
    <div ref={setRef} className="flex min-h-0 grow basis-0 flex-col overflow-y-auto px-4">
      {count === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="text-3xl text-violet-500 dark:text-violet-400">◆</span>
          <p className="font-mono text-sm text-zinc-400 dark:text-zinc-500">Ask me anything about your space.</p>
          <p className="font-mono text-xs text-zinc-300 dark:text-zinc-700">Voice · Images · Tools</p>
        </div>
      )}

      {count > 0 && (
        <div style={{ height: totalSize, position: 'relative' }}>
          <div
            className="absolute left-1.25 w-px bg-gray-200 dark:bg-zinc-800"
            style={{ top: PADDING + 2, bottom: PADDING + 2 }}
          />

          {virtualItems.map(virtualRow => {
            const { index, start, key } = virtualRow;
            const isLive = index === messages.length;

            return (
              <div
                key={key}
                ref={virtualizer.measureElement}
                data-index={index}
                style={{ position: 'absolute', top: 0, transform: `translateY(${start}px)`, width: '100%' }}
                className="relative flex gap-3 pb-4"
              >
                {isLive ? (
                  <LiveEntry streamingText={streamingText} liveThinking={liveThinking} liveTools={liveTools} />
                ) : (
                  <>
                    <TimelineDot role={messages[index].role} />
                    <div className="min-w-0 flex-1">
                      <ChatMessage {...messages[index]} />
                    </div>
                  </>
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
