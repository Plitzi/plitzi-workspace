import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback, use, useRef, useState } from 'react';

import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { AiContext, AiMessage, AiStreamEvent } from '../types';

const useAiChat = () => {
  const { server, webKey } = use(NetworkContext);
  const { networkQuery } = useNetwork({ initLoading: false, server, webKey });
  const [conversationId, setConversationId] = useStorage<string>('builder-state.aiChat.conversationId', '');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);

  // Ref so initConversation can read the current id without being a dependency
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const initConversation = useCallback(async () => {
    const storedId = conversationIdRef.current;
    if (storedId) {
      const history = await networkQuery<{ messages: AiMessage[] }>(`/ai/messages?conversationId=${storedId}`);
      if (history) {
        setMessages(history.messages);
        return;
      }
    }

    const response = await networkQuery<{ conversationId: string }>('/ai/conversation', {}, 'post');
    if (!response?.conversationId) {
      return;
    }

    setMessages([]);
    setConversationId(response.conversationId);
  }, [networkQuery, setConversationId]);

  const sendMessage = useCallback(
    async (message: string, context: AiContext) => {
      if (!conversationId || isStreaming) {
        return;
      }

      const userMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        createdAt: Date.now()
      };
      setMessages(prev => [...prev, userMessage]);
      setStreamingText('');
      setIsStreaming(true);
      setActiveTools([]);

      try {
        const res = await fetch(`${server.apiServer}/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${webKey}`
          },
          body: JSON.stringify({ conversationId, message, context })
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

              if (event.type === 'chunk') {
                setStreamingText(prev => prev + event.text);
              } else if (event.type === 'tool') {
                setActiveTools(prev => [...prev, event.name]);
              } else if (event.type === 'done') {
                setMessages(prev => [...prev, event.message]);
                setStreamingText('');
                setActiveTools([]);
              } else {
                console.error('[AI] Stream error:', event.message);
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } finally {
        setIsStreaming(false);
        setStreamingText('');
        setActiveTools([]);
      }
    },
    [conversationId, isStreaming, server.apiServer, webKey]
  );

  const clearConversation = useCallback(async () => {
    const response = await networkQuery<{ conversationId: string }>('/ai/conversation', {}, 'post');
    if (!response?.conversationId) {
      return;
    }

    setMessages([]);
    setConversationId(response.conversationId);
  }, [networkQuery, setConversationId]);

  return {
    conversationId,
    messages,
    streamingText,
    isStreaming,
    activeTools,
    initConversation,
    sendMessage,
    clearConversation
  };
};

export default useAiChat;
