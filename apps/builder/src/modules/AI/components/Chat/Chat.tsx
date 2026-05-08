import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import ChatMessage from '../ChatMessage';
import LiveEntry from './LiveEntry';

import type { AiMessage, AiToolCall } from '../../types';
import type { RefObject } from 'react';

export type ChatProps = {
  ref?: RefObject<HTMLDivElement | null>;
  messages: AiMessage[];
  isStreaming?: boolean;
  streamingText?: string;
  liveThinking?: string;
  liveTools?: AiToolCall[];
};

const PADDING = 16;

const estimateSize = () => 120;

const Chat = ({ ref, messages = [], isStreaming, streamingText, liveThinking, liveTools = [] }: ChatProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottom = useRef(true);

  const hasLive = isStreaming || !!(liveThinking || liveTools.length || streamingText);
  const count = messages.length + (hasLive ? 1 : 0);

  // Compute incrementing version numbers for stage_preview and sketch_wireframe per message.
  const previewVersions = useMemo(() => {
    const map: Record<string, { stage: number; wireframe: number }> = {};
    let stageCount = 0;
    let wireframeCount = 0;
    for (const msg of messages) {
      const hasStage = msg.tools?.some(t => t.name === 'stage_preview' && t.status === 'done') ?? false;
      const hasWire = msg.tools?.some(t => t.name === 'sketch_wireframe' && t.status === 'done') ?? false;
      map[msg.id] = {
        stage: hasStage ? ++stageCount : 0,
        wireframe: hasWire ? ++wireframeCount : 0
      };
    }
    return map;
  }, [messages]);

  const getScrollElement = useCallback(() => scrollRef.current, []);

  const getItemKey = useCallback(
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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const last = messages[messages.length - 1];
      if ((last as AiMessage | undefined)?.role === 'user') {
        isAtBottom.current = true;
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!isAtBottom.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [streamingText, liveThinking, liveTools]);

  const prevTotalSize = useRef(0);
  useEffect(() => {
    if (totalSize === prevTotalSize.current) return;
    prevTotalSize.current = totalSize;
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [totalSize]);

  const setRef = (el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (ref) ref.current = el;
  };

  return (
    <div ref={setRef} className="flex min-h-0 grow basis-0 flex-col overflow-y-auto px-3">
      {count === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="text-3xl text-orange-500 dark:text-orange-400">◆</span>
          <p className="font-mono text-sm text-zinc-400 dark:text-zinc-500">Ask me anything about your space.</p>
          <p className="font-mono text-xs text-zinc-300 dark:text-zinc-700">Voice · Images · Tools</p>
        </div>
      )}

      {count > 0 && (
        <div style={{ height: totalSize, position: 'relative' }}>
          {virtualItems.map(virtualRow => {
            const { index, start, key } = virtualRow;
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
                    streamingText={streamingText}
                    liveThinking={liveThinking}
                    liveTools={liveTools}
                  />
                )}
                {msg && (
                  <ChatMessage
                    {...msg}
                    stagePreviewVersion={versions?.stage}
                    wireframeVersion={versions?.wireframe}
                  />
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
