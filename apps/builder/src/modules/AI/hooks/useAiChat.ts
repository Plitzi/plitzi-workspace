import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { use, useCallback, useEffect, useRef, useState } from 'react';

import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import useAiErrors from './useAiErrors';
import useAiUsage from './useAiUsage';
import useLiveSteps from './useLiveSteps';
import useStreamingText from './useStreamingText';
import { parseAiStream } from '../helpers/parseAiStream';

import type { AiAttachment, AiContext, AiMessage, AiProviderSettings, ConversationSummary } from '../types';
import type { AiEffort, AiMode } from '@plitzi/sdk-shared';

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
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<QueueEntry[]>([]);
  const pendingQueueRef = useRef<QueueEntry[]>([]);
  pendingQueueRef.current = pendingQueue;
  const executeSendRef = useRef<((entry: QueueEntry) => Promise<void>) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const providerSettingsRef = useRef(providerSettings);
  providerSettingsRef.current = providerSettings;

  const { streamingText, appendChunk, flush: flushStreaming, capture: captureStreaming } = useStreamingText();
  const {
    usage,
    accumulate: accumulateUsage,
    reset: resetUsage,
    loadFromMessages: loadUsageFromMessages
  } = useAiUsage();
  const {
    error,
    setError,
    quotaError,
    quotaRetryAfter,
    clearError,
    clearQuotaError,
    clearAll: clearErrors,
    setQuotaLimitError
  } = useAiErrors();
  const {
    liveSteps,
    clear: clearLiveSteps,
    onThinking,
    onChunk,
    onToolStart,
    onTool,
    onResourceRead
  } = useLiveSteps(captureStreaming);

  const initConversation = useCallback(async () => {
    const storedId = conversationIdRef.current;
    if (!storedId) {
      return;
    }

    const history = await networkQuery<{ messages: AiMessage[] }>(`/ai/messages?conversationId=${storedId}`);
    if (history) {
      setMessages(history.messages);
      loadUsageFromMessages(history.messages);
    } else {
      setConversationId('');
    }
  }, [networkQuery, setConversationId, loadUsageFromMessages]);

  const executeSend = useCallback(
    async (entry: QueueEntry) => {
      setMessages(prev => prev.map(m => (m.id === entry.localId && m.queued ? { ...m, queued: undefined } : m)));
      setIsStreaming(true);
      flushStreaming();
      clearLiveSteps();
      clearErrors();

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

        const controller = new AbortController();
        abortRef.current = controller;

        const serverAttachments = entry.attachments.map(a => ({ type: a.type, mimeType: a.mimeType, data: a.data }));
        const res = await fetch(`${server.nodeServer}/ai/chat`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webKey}` },
          body: JSON.stringify({
            conversationId: activeConversationId,
            message: entry.message,
            messageId: entry.localId,
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

        for await (const event of parseAiStream(res.body.getReader())) {
          if (event.type === 'busy') {
            setIsBusy(true);
          } else if (event.type === 'thinking') {
            setIsBusy(false);
            onThinking(event);
          } else if (event.type === 'chunk') {
            setIsBusy(false);
            onChunk();
            appendChunk(event.text);
          } else if (event.type === 'tool_start') {
            onToolStart(event);
          } else if (event.type === 'resource_read') {
            onResourceRead(event);
          } else if (event.type === 'tool') {
            onTool(event);
          } else if (event.type === 'done') {
            setIsBusy(false);
            flushStreaming();
            setMessages(prev => {
              const firstQueuedIdx = prev.findIndex(m => m.queued);
              if (firstQueuedIdx === -1) {
                return [...prev, event.message];
              }

              return [...prev.slice(0, firstQueuedIdx), event.message, ...prev.slice(firstQueuedIdx)];
            });

            if (event.usage) {
              accumulateUsage(event.usage);
            }

            clearLiveSteps();
          } else {
            if (event.retryAfter) {
              setQuotaLimitError(event.message || 'Rate limit exceeded', event.retryAfter);
            } else {
              setError(event.message);
            }
          }
        }
      } catch (err: unknown) {
        // Stopping the generation aborts the fetch — that is intentional, not an error.
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        setIsBusy(false);
        flushStreaming();
        clearLiveSteps();

        const queue = pendingQueueRef.current;
        if (queue.length > 0) {
          const [next, ...rest] = queue;
          pendingQueueRef.current = rest;
          setPendingQueue([...rest]);
          setTimeout(() => {
            void executeSendRef.current?.(next);
          }, 0);
        }
      }
    },
    [
      flushStreaming,
      clearLiveSteps,
      clearErrors,
      networkQuery,
      setConversationId,
      server.nodeServer,
      webKey,
      onThinking,
      onChunk,
      onToolStart,
      onResourceRead,
      onTool,
      appendChunk,
      accumulateUsage,
      setQuotaLimitError,
      setError
    ]
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

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPendingQueue([]);
    pendingQueueRef.current = [];
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId('');
    setPendingQueue([]);
    pendingQueueRef.current = [];
    resetUsage();
    clearErrors();
  }, [setConversationId, clearErrors, resetUsage]);

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
        loadUsageFromMessages(history.messages);
        clearErrors();
      }
    },
    [isStreaming, networkQuery, setConversationId, clearErrors, loadUsageFromMessages]
  );

  const forkConversation = useCallback(
    async (messageId: string): Promise<string | null> => {
      const sourceId = conversationIdRef.current;
      if (!sourceId || isStreaming) {
        return null;
      }

      const res = await networkQuery<{ conversationId: string }>(
        '/ai/conversation/fork',
        { conversationId: sourceId, messageId },
        'post'
      );

      return res?.conversationId ?? null;
    },
    [isStreaming, networkQuery]
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
      resetUsage();
    }
  }, [isStreaming, server.nodeServer, webKey, resetUsage]);

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
    clearError,
    quotaError,
    clearQuotaError,
    quotaRetryAfter,
    conversationId,
    conversations,
    pendingQueue,
    mode,
    setMode,
    initConversation,
    sendMessage,
    stopGeneration,
    clearConversation,
    loadConversations,
    loadConversation,
    forkConversation,
    compact
  };
};

export default useAiChat;
