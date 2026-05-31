import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import LiveEntry from './components/LiveEntry';
import { estimateSize, PADDING } from './helpers';
import { useAiChatContext } from '../../contexts/AiChatContext';
import ChatMessage from '../ChatMessage';

import type { Ref } from 'react';

export type ChatProps = {
  ref?: Ref<HTMLDivElement>;
};

const EXAMPLE_PROMPTS = [
  'Create a hero section with a headline and a call-to-action button',
  'Add a contact form to this page',
  'Make this page look more modern and professional',
  'Change the color palette to something fresh'
];

const Chat = ({ ref }: ChatProps) => {
  const { currentMode, messages, isStreaming, isBusy, streamingText, liveSteps, prefillInput } = useAiChatContext();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottom = useRef(true);
  useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement, []);

  const hasLive = isStreaming || !!(liveSteps.length || streamingText);
  const count = messages.length + (hasLive ? 1 : 0);

  const previewVersions = useMemo(() => {
    const map: Record<string, { stage: number; wireframe: number }> = {};
    let stageCount = 0;
    let wireframeCount = 0;
    for (const msg of messages) {
      const hasStage =
        msg.steps?.some(s => s.type === 'tool' && s.name === 'preview_concept' && s.status === 'done') ?? false;
      const hasWire =
        msg.steps?.some(s => s.type === 'tool' && s.name === 'sketch_wireframe' && s.status === 'done') ?? false;
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
  }, [streamingText, liveSteps]);

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

          <div className="mt-3 flex w-full max-w-xs flex-col gap-1.5">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={prompt}
                type="button"
                onClick={() => prefillInput(prompt)}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-fade-in-up rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-left text-[11px] leading-snug text-zinc-600 transition-colors hover:border-neutral-400 hover:bg-neutral-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
              >
                {prompt}
              </button>
            ))}
          </div>
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
                    liveSteps={liveSteps}
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
