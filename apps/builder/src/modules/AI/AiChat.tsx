import { useCallback, useRef, useState } from 'react';

import AiChatContent from './components/AiChatContent';
import AiChatProvider from './contexts/AiChatProvider';
import useAiProviderSettings from './hooks/useAiProviderSettings';
import useVoice from './hooks/useVoice';

import type { ChatInputHandle } from './components/ChatInput';

const AiChat = () => {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<ChatInputHandle | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    settings: providerSettings,
    models,
    modelsLoading,
    modelsError,
    updateSettings
  } = useAiProviderSettings(true);

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

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopVoice();
    } else {
      void startVoice();
    }
  }, [isListening, stopVoice, startVoice]);

  const handleSettingsToggle = useCallback(() => setIsSettingsOpen(s => !s), []);

  return (
    <AiChatProvider providerSettings={providerSettings}>
      <AiChatContent
        chatInputRef={chatInputRef}
        chatRef={chatRef}
        isSettingsOpen={isSettingsOpen}
        onSettingsToggle={handleSettingsToggle}
        isListening={isListening}
        isVoiceSupported={isVoiceSupported}
        audioData={audioData}
        onVoiceToggle={handleVoiceToggle}
        models={models}
        currentModel={providerSettings.model}
        modelsLoading={modelsLoading}
        modelsError={modelsError}
        providerSettings={providerSettings}
        onModelChange={m => updateSettings({ model: m })}
        onSettingsChange={updateSettings}
      />
    </AiChatProvider>
  );
};

export default AiChat;
