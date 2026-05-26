import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback, use, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type {
  AiAttachment,
  AiContext,
  AiEffort,
  AiLiveStep,
  AiMessage,
  AiMessageStep,
  AiMode,
  AiProviderSettings,
  AiStreamEvent,
  AiUsage,
  ConversationSummary
} from '../types';

type QueueEntry = {
  localId: string;
  message: string;
  context: AiContext;
  attachments: AiAttachment[];
  effort: AiEffort;
};

const useAiChat = (providerSettings?: AiProviderSettings) => {
  const { server, webKey } = use(NetworkContext);
  const { networkQuery } = useNetwork({ initLoading: false, server, webKey });
  const [conversationId, setConversationId] = useStorage<string>('builder-state.aiChat.conversationId', '');
  const [mode, setMode] = useStorage<AiMode>('builder-state.aiChat.mode', 'build');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const streamingTextRef = useRef('');
  const streamingBufferRef = useRef('');
  const streamingFlushRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingQueue, setPendingQueue] = useState<QueueEntry[]>([]);
  const pendingQueueRef = useRef<QueueEntry[]>([]);
  pendingQueueRef.current = pendingQueue;
  const executeSendRef = useRef<((entry: QueueEntry) => Promise<void>) | null>(null);

  const flushStreamingBuffer = useCallback(() => {
    if (streamingBufferRef.current) {
      streamingTextRef.current += streamingBufferRef.current;
      streamingBufferRef.current = '';
    }

    if (streamingTextRef.current) {
      flushSync(() => setStreamingText(streamingTextRef.current));
    }

    streamingTextRef.current = '';
    flushSync(() => setStreamingText(''));
    if (streamingFlushRef.current) {
      clearInterval(streamingFlushRef.current);
      streamingFlushRef.current = null;
    }
  }, []);

  const captureAndClearStreamingText = useCallback((): string => {
    if (streamingBufferRef.current) {
      streamingTextRef.current += streamingBufferRef.current;
      streamingBufferRef.current = '';
    }

    const captured = streamingTextRef.current;
    streamingTextRef.current = '';
    flushSync(() => setStreamingText(''));
    if (streamingFlushRef.current) {
      clearInterval(streamingFlushRef.current);
      streamingFlushRef.current = null;
    }

    return captured;
  }, []);

  const [liveSteps, setLiveSteps] = useState<AiLiveStep[]>([]);
  const liveStepsRef = useRef<AiLiveStep[]>([]);
  liveStepsRef.current = liveSteps;
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [usage, setUsage] = useState<AiUsage | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [quotaError, setQuotaError] = useState<string | undefined>();
  const [quotaRetryAfter, setQuotaRetryAfter] = useState<number | undefined>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const providerSettingsRef = useRef(providerSettings);
  providerSettingsRef.current = providerSettings;

  const initConversation = useCallback(async () => {
    const storedId = conversationIdRef.current;
    if (!storedId) {
      return;
    }

    const history = await networkQuery<{ messages: AiMessage[] }>(`/ai/messages?conversationId=${storedId}`);
    if (history) {
      setMessages(history.messages);
    } else {
      setConversationId('');
    }
  }, [networkQuery, setConversationId]);

  const executeSend = useCallback(
    async (entry: QueueEntry) => {
      setMessages(prev => prev.map(m => m.id === entry.localId && m.queued ? { ...m, queued: undefined } : m));
      setIsStreaming(true);
      flushStreamingBuffer();
      setLiveSteps([]);
      setError(undefined);
      setQuotaError(undefined);
      setQuotaRetryAfter(undefined);

      try {
        let activeConversationId = conversationIdRef.current;
        if (!activeConversationId) {
          const response = await networkQuery<{ conversationId: string }>('/ai/conversation', {}, 'post');
          if (!response?.conversationId) {
            return;
          }

          activeConversationId = response.conversationId;
          setConversationId(activeConversationId);
          conversationIdRef.current = activeConversationId;
        }

        const serverAttachments = entry.attachments.map(a => ({ type: a.type, mimeType: a.mimeType, data: a.data }));

        const res = await fetch(`${server.nodeServer}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webKey}` },
          body: JSON.stringify({
            conversationId: activeConversationId,
            message: entry.message,
            attachments: serverAttachments.length > 0 ? serverAttachments : undefined,
            context: entry.context,
            mode: modeRef.current,
            effort: entry.effort,
            ...providerSettingsRef.current
          })
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) {
              continue;
            }

            try {
              const event = JSON.parse(line.slice(6)) as AiStreamEvent;

              if (event.type === 'busy') {
                setIsBusy(true);
              } else if (event.type === 'thinking') {
                setIsBusy(false);
                const lastLiveStep = liveStepsRef.current[liveStepsRef.current.length - 1];
                const isAppending = lastLiveStep?.type === 'thinking' && !lastLiveStep.done;

                if (isAppending) {
                  setLiveSteps(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.type === 'thinking' && !last.done) {
                      return [...prev.slice(0, -1), { ...last, text: last.text + event.text }];
                    }

                    return prev;
                  });
                } else {
                  const committed = captureAndClearStreamingText();
                  setLiveSteps(prev => {
                    const withText = committed ? [...prev, { type: 'text' as const, text: committed }] : prev;

                    return [...withText, { type: 'thinking', text: event.text, done: false, startMs: Date.now() }];
                  });
                }
              } else if (event.type === 'chunk') {
                setIsBusy(false);
                setLiveSteps(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.type === 'thinking' && !last.done) {
                    return [...prev.slice(0, -1), { ...last, done: true, durationMs: Date.now() - last.startMs }];
                  }

                  return prev;
                });
                streamingBufferRef.current += event.text;
                if (!streamingFlushRef.current) {
                  streamingFlushRef.current = setInterval(() => {
                    if (streamingBufferRef.current) {
                      streamingTextRef.current += streamingBufferRef.current;
                      flushSync(() => setStreamingText(streamingTextRef.current));
                      streamingBufferRef.current = '';
                    }
                  }, 30);
                }
              } else if (event.type === 'tool_start') {
                const committedText = captureAndClearStreamingText();
                setLiveSteps(prev => {
                  const last = prev[prev.length - 1];
                  const withThinkingClosed =
                    last && last.type === 'thinking' && !last.done
                      ? [...prev.slice(0, -1), { ...last, done: true, durationMs: Date.now() - last.startMs }]
                      : prev;
                  const withText = committedText
                    ? [...withThinkingClosed, { type: 'text' as const, text: committedText }]
                    : withThinkingClosed;
                  const alreadyRunning = withText.some(
                    s => s.type === 'tool' && s.name === event.name && s.status === 'running'
                  );

                  if (alreadyRunning) {
                    return withText;
                  }

                  return [
                    ...withText,
                    { type: 'tool', id: crypto.randomUUID(), name: event.name, args: event.args, status: 'running' }
                  ];
                });
              } else if (event.type === 'resource_read') {
                setLiveSteps(prev => [...prev, { type: 'resource', name: event.name, uri: event.uri }]);
              } else if (event.type === 'tool') {
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

                  return prev.map((s, i) =>
                    i === targetIdx ? { ...s, result: event.result, status: event.status } : s
                  );
                });
              } else if (event.type === 'done') {
                setIsBusy(false);
                captureAndClearStreamingText();
                const currentSteps = liveStepsRef.current;
                const steps: AiMessageStep[] = currentSteps.map(s => {
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
                setMessages(prev => {
                  const firstQueuedIdx = prev.findIndex(m => m.queued);
                  const msg = { ...event.message, steps };
                  if (firstQueuedIdx === -1) {
                    return [...prev, msg];
                  }

                  return [...prev.slice(0, firstQueuedIdx), msg, ...prev.slice(firstQueuedIdx)];
                });

                if (event.usage) {
                  setUsage(event.usage);
                }

                setLiveSteps([]);
              } else if ('message' in event) {
                if ('retryAfter' in event && event.retryAfter) {
                  setQuotaError(event.message || 'Rate limit exceeded');
                  setQuotaRetryAfter(event.retryAfter);
                } else {
                  setError(event.message);
                }
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsStreaming(false);
        setIsBusy(false);
        flushStreamingBuffer();
        setLiveSteps([]);

        const queue = pendingQueueRef.current;
        if (queue.length > 0) {
          const [next, ...rest] = queue;
          pendingQueueRef.current = rest;
          setPendingQueue([...rest]);
          setTimeout(() => { void executeSendRef.current?.(next); }, 0);
        }
      }
    },
    [captureAndClearStreamingText, flushStreamingBuffer, networkQuery, setConversationId, server.nodeServer, webKey]
  );

  executeSendRef.current = executeSend;

  const sendMessage = useCallback(
    async (message: string, context: AiContext, attachments: AiAttachment[] = [], effort: AiEffort = 'medium') => {
      if (quotaRetryAfter && Date.now() < quotaRetryAfter) {
        return;
      }

      if (isStreaming) {
        const localId = crypto.randomUUID();
        setMessages(prev => [
          ...prev,
          {
            id: localId,
            role: 'user',
            content: message,
            attachments: attachments.length > 0 ? attachments : undefined,
            queued: true,
            createdAt: Date.now()
          }
        ]);
        const entry: QueueEntry = { localId, message, context, attachments, effort };
        setPendingQueue(prev => [...prev, entry]);
        pendingQueueRef.current = [...pendingQueueRef.current, entry];

        return;
      }

      const localId = crypto.randomUUID();
      setMessages(prev => [
        ...prev,
        {
          id: localId,
          role: 'user',
          content: message,
          attachments: attachments.length > 0 ? attachments : undefined,
          createdAt: Date.now()
        }
      ]);

      await executeSend({ localId, message, context, attachments, effort });
    },
    [isStreaming, quotaRetryAfter, executeSend]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId('');
    setPendingQueue([]);
    pendingQueueRef.current = [];
    setUsage(undefined);
    setError(undefined);
    setQuotaError(undefined);
    setQuotaRetryAfter(undefined);
  }, [setConversationId]);

  const loadConversations = useCallback(async () => {
    const res = await networkQuery<{ conversations: ConversationSummary[] }>('/ai/conversations');
    if (res) {
      setConversations(res.conversations);
    }
  }, [networkQuery]);

  const loadConversation = useCallback(
    async (id: string) => {
      if (isStreaming) {
        return;
      }

      const history = await networkQuery<{ messages: AiMessage[] }>(`/ai/messages?conversationId=${id}`);
      if (history) {
        setConversationId(id);
        setMessages(history.messages);
        setPendingQueue([]);
        pendingQueueRef.current = [];
        setUsage(undefined);
        setError(undefined);
        setQuotaError(undefined);
        setQuotaRetryAfter(undefined);
      }
    },
    [isStreaming, networkQuery, setConversationId]
  );

  const compact = useCallback(async () => {
    const id = conversationIdRef.current;
    if (!id || isStreaming) {
      return;
    }

    const res = await fetch(`${server.nodeServer}/ai/compact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webKey}` },
      body: JSON.stringify({ conversationId: id, ...providerSettingsRef.current })
    });
    if (!res.ok) {
      return;
    }

    const data = (await res.json()) as { message: AiMessage | null };
    if (data.message) {
      setMessages([data.message]);
      setUsage(undefined);
    }
  }, [isStreaming, server.nodeServer, webKey]);

  const usedPercent = usage?.usedPercent ?? 0;
  const compactedAtRef = useRef(0);
  useEffect(() => {
    if (usedPercent >= 90 && !isStreaming && usedPercent !== compactedAtRef.current) {
      compactedAtRef.current = usedPercent;
      void compact();
    }
  }, [usedPercent, isStreaming, compact]);

  return {
    messages,
    streamingText,
    liveSteps,
    isStreaming,
    isBusy,
    usage,
    error,
    clearError: () => setError(undefined),
    quotaError,
    clearQuotaError: () => {
      setQuotaError(undefined);
      setQuotaRetryAfter(undefined);
    },
    quotaRetryAfter,
    conversationId,
    conversations,
    pendingQueue,
    mode,
    setMode,
    initConversation,
    sendMessage,
    clearConversation,
    loadConversations,
    loadConversation,
    compact
  };
};

export default useAiChat;
