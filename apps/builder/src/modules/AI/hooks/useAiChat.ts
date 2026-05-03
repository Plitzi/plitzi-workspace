import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback, use, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { AiFrontendToolRunner } from '../tools';
import type {
  AiAttachment,
  AiContext,
  AiMessage,
  AiMessagePreview,
  AiMode,
  AiProviderSettings,
  AiStreamEvent,
  AiToolCall,
  AiUsage,
  ConversationSummary
} from '../types';

const useAiChat = (runClientTool?: AiFrontendToolRunner, providerSettings?: AiProviderSettings) => {
  const { server, webKey } = use(NetworkContext);
  const { networkQuery } = useNetwork({ initLoading: false, server, webKey });
  const [conversationId, setConversationId] = useStorage<string>('builder-state.aiChat.conversationId', '');
  const [mode, setMode] = useStorage<AiMode>('builder-state.aiChat.mode', 'build');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [liveThinking, setLiveThinking] = useState('');
  const [liveTools, setLiveTools] = useState<AiToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
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

  // Only restores history from a stored conversation. If the ID is stale (404),
  // clears storage so the next send will create a fresh conversation.
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

  // Refs so 'done' handler captures final state (closure issue)
  const liveToolsRef = useRef<AiToolCall[]>([]);
  liveToolsRef.current = liveTools;
  const thinkingTextRef = useRef('');
  // Preview staged by a client_tool handler; cleared once attached to the message
  const pendingPreviewRef = useRef<Extract<AiMessagePreview, { baseElementId: string }> | undefined>(undefined);
  // Thinking duration tracking: start on first 'thinking' event, stop on first 'chunk'
  const thinkingStartRef = useRef<number | undefined>(undefined);
  const thinkingDurationMsRef = useRef<number | undefined>(undefined);

  const sendMessage = useCallback(
    async (message: string, context: AiContext, attachments: AiAttachment[] = []) => {
      if (isStreaming) {
        return;
      }

      if (quotaRetryAfter && Date.now() < quotaRetryAfter) {
        return;
      }

      // Create conversation lazily on first send
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

      const userMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        attachments: attachments.length > 0 ? attachments : undefined,
        createdAt: Date.now()
      };
      setMessages(prev => [...prev, userMessage]);
      setStreamingText('');
      setLiveThinking('');
      thinkingTextRef.current = '';
      setLiveTools([]);
      setError(undefined);
      setQuotaError(undefined);
      setQuotaRetryAfter(undefined);
      setIsStreaming(true);

      const serverAttachments = attachments.map(a => ({ type: a.type, mimeType: a.mimeType, data: a.data }));

      try {
        const res = await fetch(`${server.nodeServer}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webKey}` },
          body: JSON.stringify({
            conversationId: activeConversationId,
            message,
            attachments: serverAttachments.length > 0 ? serverAttachments : undefined,
            context,
            mode: modeRef.current,
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

              if (event.type === 'thinking') {
                if (!thinkingStartRef.current) {
                  thinkingStartRef.current = Date.now();
                }
                thinkingTextRef.current += event.text;
                flushSync(() => setLiveThinking(thinkingTextRef.current));
              } else if (event.type === 'chunk') {
                if (thinkingStartRef.current && !thinkingDurationMsRef.current) {
                  thinkingDurationMsRef.current = Date.now() - thinkingStartRef.current;
                }
                setStreamingText(prev => prev + event.text);
              } else if (event.type === 'tool_start') {
                const toolId = crypto.randomUUID();
                setLiveTools(prev => [...prev, { id: toolId, name: event.name, args: event.args, status: 'running' }]);
              } else if (event.type === 'tool') {
                setLiveTools(prev =>
                  prev.map(t =>
                    t.name === event.name && t.status === 'running' ? { ...t, result: event.result, status: 'done' } : t
                  )
                );
              } else if (event.type === 'client_tool') {
                setLiveTools(prev => [
                  ...prev,
                  { id: event.id, name: event.name, args: event.args, status: 'running' }
                ]);
                if (runClientTool) {
                  const { toolResult, pendingPreview } = await runClientTool(event.name, event.args);
                  if (pendingPreview) {
                    pendingPreviewRef.current = pendingPreview;
                  }
                  setLiveTools(prev =>
                    prev.map(t => (t.id === event.id ? { ...t, status: 'done', result: toolResult } : t))
                  );
                }
              } else if (event.type === 'done') {
                const preview = pendingPreviewRef.current;
                pendingPreviewRef.current = undefined;
                const thinkingText = thinkingTextRef.current || undefined;
                const thinkingDurationMs =
                  thinkingText && thinkingStartRef.current
                    ? (thinkingDurationMsRef.current ?? Date.now() - thinkingStartRef.current)
                    : undefined;
                thinkingStartRef.current = undefined;
                thinkingDurationMsRef.current = undefined;
                const messageWithPreview = {
                  ...event.message,
                  thinking: thinkingText,
                  thinkingDurationMs,
                  tools: liveToolsRef.current.map(t => t.status === 'running' ? { ...t, status: 'done' as const } : t),
                  preview: event.message.preview ?? preview
                };
                setMessages(prev => [...prev, messageWithPreview]);

                // Save preview to server if present
                if (preview && event.message.id) {
                  networkQuery(
                    '/ai/message',
                    { conversationId: conversationIdRef.current, messageId: event.message.id, preview },
                    'post'
                  ).catch(() => {});
                }

                if (event.usage) {
                  setUsage(event.usage);
                }
                setStreamingText('');
                setLiveThinking('');
                thinkingTextRef.current = '';
                setLiveTools([]);
              } else if (event.type === ('error' as string)) {
                setError(event.message);
              } else if (event.type === 'quota_exceeded') {
                setQuotaError(event.message || 'API quota exceeded — check your API key in settings');
                if (event.retryAfter) {
                  setQuotaRetryAfter(event.retryAfter);
                }
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } finally {
        setIsStreaming(false);
        setStreamingText('');
        setLiveThinking('');
        thinkingTextRef.current = '';
        setLiveTools([]);
        pendingPreviewRef.current = undefined;
        thinkingStartRef.current = undefined;
        thinkingDurationMsRef.current = undefined;
      }
    },
    [isStreaming, quotaRetryAfter, networkQuery, runClientTool, setConversationId, server.nodeServer, webKey]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId('');
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

  // Auto-compact when context usage reaches 90%.
  const usedPercent = usage?.usedPercent ?? 0;
  const prevUsedPercentRef = useRef(0);
  if (usedPercent !== prevUsedPercentRef.current) {
    prevUsedPercentRef.current = usedPercent;
    if (usedPercent >= 90 && !isStreaming) {
      void compact();
    }
  }

  return {
    messages,
    streamingText,
    liveThinking,
    liveTools,
    isStreaming,
    usage,
    error,
    clearError: () => setError(undefined),
    quotaError,
    clearQuotaError: () => { setQuotaError(undefined); setQuotaRetryAfter(undefined); },
    quotaRetryAfter,
    conversations,
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
