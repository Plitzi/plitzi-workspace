import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, use, useEffect, useRef, useState } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import Chat from './components/Chat';
import useAiChat from './hooks/useAiChat';

import type { BuilderState } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

const AiChat = () => {
  const { useStore } = createStoreHook<BuilderState>();
  const [elementSelected] = useStore('elementSelected');
  const { currentPageId } = use(NavigationContext);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [messageInput, setMessageInput] = useState('');

  const { messages, streamingText, isStreaming, activeTools, initConversation, sendMessage, clearConversation } =
    useAiChat();

  useEffect(() => {
    void initConversation();
  }, [initConversation]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSend = useCallback(() => {
    if (!messageInput.trim() || isStreaming) {
      return;
    }

    const msg = messageInput;
    setMessageInput('');
    void sendMessage(msg, { currentPageId, elementSelected });
  }, [messageInput, isStreaming, sendMessage, currentPageId, elementSelected]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex h-full w-full flex-col">
      <Chat ref={chatRef} messages={messages} streamingText={streamingText} activeTools={activeTools} />
      <div className="flex flex-col gap-2 border-t border-gray-200 p-3">
        <Input
          className="w-full"
          placeholder="Ask the assistant… (Ctrl+Enter to send)"
          value={messageInput}
          onChange={setMessageInput}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        <div className="flex justify-between">
          <Button size="sm" intent="danger" onClick={clearConversation} disabled={isStreaming}>
            Clear
          </Button>
          <Button size="sm" intent="primary" onClick={handleSend} disabled={!messageInput.trim() || isStreaming}>
            Ask
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AiChat;
