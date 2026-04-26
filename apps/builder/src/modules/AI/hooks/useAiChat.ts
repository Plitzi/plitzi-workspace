import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback, use, useRef, useState } from 'react';

import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { AiAttachment, AiContext, AiMessage, AiStreamEvent, AiToolCall } from '../types';

const useAiChat = () => {
  const { server, webKey } = use(NetworkContext);
  const { networkQuery } = useNetwork({ initLoading: false, server, webKey });
  const [conversationId, setConversationId] = useStorage<string>('builder-state.aiChat.conversationId', '');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [liveTools, setLiveTools] = useState<AiToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

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
    async (message: string, context: AiContext, attachments: AiAttachment[] = []) => {
      if (!conversationId || isStreaming) {
        return;
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
      setLiveTools([]);
      setIsStreaming(true);

      const serverAttachments = attachments.map(a => ({ type: a.type, mimeType: a.mimeType, data: a.data }));

      try {
        const res = await fetch(`${server.apiServer}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webKey}` },
          body: JSON.stringify({
            conversationId,
            message,
            attachments: serverAttachments.length > 0 ? serverAttachments : undefined,
            context
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

              if (event.type === 'chunk') {
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
              } else if (event.type === 'done') {
                setMessages(prev => [...prev, { ...event.message, tools: liveToolsRef.current }]);
                setStreamingText('');
                setLiveTools([]);
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
        setLiveTools([]);
      }
    },

    [conversationId, isStreaming, server.apiServer, webKey]
  );

  // Keep a ref to liveTools so the 'done' handler can capture the final state
  const liveToolsRef = useRef<AiToolCall[]>([]);
  liveToolsRef.current = liveTools;

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
    liveTools,
    isStreaming,
    initConversation,
    sendMessage,
    clearConversation
  };
};

export default useAiChat;
