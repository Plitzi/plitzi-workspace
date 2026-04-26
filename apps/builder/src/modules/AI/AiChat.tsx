import { use, useCallback, useEffect, useRef } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import AiChatHeader from './components/AiChatHeader';
import Chat from './components/Chat';
import ChatInput from './components/ChatInput';
import useAiChat from './hooks/useAiChat';
import useAiTools from './hooks/useAiTools';
import useVoice from './hooks/useVoice';

import type { ChatInputHandle } from './components/ChatInput';
import type { AiAttachment } from './types';
import type { BuilderState } from '@plitzi/sdk-shared';

const AiChat = () => {
  const { useStore } = createStoreHook<BuilderState>();
  const [elementSelected] = useStore('elementSelected');
  const { currentPageId } = use(NavigationContext);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<ChatInputHandle | null>(null);

  const runClientTool = useAiTools();
  const {
    messages,
    streamingText,
    liveThinking,
    liveTools,
    isStreaming,
    initConversation,
    sendMessage,
    clearConversation
  } = useAiChat(runClientTool);

  const handleTranscript = useCallback((text: string) => {
    chatInputRef.current?.appendText(text);
  }, []);

  const {
    start: startVoice,
    stop: stopVoice,
    isListening,
    isSupported: isVoiceSupported,
    audioData
  } = useVoice({ onTranscript: handleTranscript });

  useEffect(() => {
    void initConversation();
  }, [initConversation]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, streamingText, liveTools]);

  const handleSend = useCallback(
    (msg: string, atts: AiAttachment[]) => {
      void sendMessage(msg, { currentPageId, elementSelected }, atts);
    },
    [sendMessage, currentPageId, elementSelected]
  );

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopVoice();
    } else {
      void startVoice();
    }
  }, [isListening, stopVoice, startVoice]);

  return (
    <div className="flex h-full w-full flex-col bg-white font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <AiChatHeader onClear={clearConversation} isStreaming={isStreaming} />
      <Chat
        ref={chatRef}
        messages={messages}
        streamingText={streamingText}
        liveThinking={liveThinking}
        liveTools={liveTools}
      />
      <ChatInput
        ref={chatInputRef}
        isStreaming={isStreaming}
        isListening={isListening}
        isVoiceSupported={isVoiceSupported}
        audioData={audioData}
        onSend={handleSend}
        onVoiceToggle={handleVoiceToggle}
      />
    </div>
  );
};

export default AiChat;
