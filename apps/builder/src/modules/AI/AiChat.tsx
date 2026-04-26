import { use, useCallback, useEffect, useRef, useState } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import Chat from './components/Chat';
import VoiceVisualizer from './components/VoiceVisualizer';
import useAiChat from './hooks/useAiChat';
import useVoice from './hooks/useVoice';

import type { AiAttachment } from './types';
import type { BuilderState } from '@plitzi/sdk-shared';
import type { ChangeEvent, KeyboardEvent } from 'react';

const AiChat = () => {
  const { useStore } = createStoreHook<BuilderState>();
  const [elementSelected] = useStore('elementSelected');
  const { currentPageId } = use(NavigationContext);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);

  const { messages, streamingText, liveTools, isStreaming, initConversation, sendMessage, clearConversation } =
    useAiChat();

  const handleTranscript = useCallback((text: string) => {
    setMessageInput(prev => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  }, []);

  const {
    start: startVoice,
    stop: stopVoice,
    isListening,
    isSupported: isVoiceSupported,
    audioData
  } = useVoice({
    onTranscript: handleTranscript
  });

  useEffect(() => {
    void initConversation();
  }, [initConversation]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, streamingText, liveTools]);

  const handleSend = useCallback(() => {
    if ((!messageInput.trim() && attachments.length === 0) || isStreaming) {
      return;
    }

    const msg = messageInput;
    const atts = attachments;
    setMessageInput('');
    setAttachments([]);
    void sendMessage(msg, { currentPageId, elementSelected }, atts);
  }, [messageInput, attachments, isStreaming, sendMessage, currentPageId, elementSelected]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSend();
      }
    },
    [handleSend]
  );

  const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const result = ev.target?.result as string;
        // result is "data:image/png;base64,xxxx"
        const [header, data] = result.split(',');
        const mimeType = header.split(':')[1].split(';')[0];
        setAttachments(prev => [...prev, { id: crypto.randomUUID(), type: 'image', mimeType, data, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });

    // Reset so the same file can be re-selected
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 font-mono text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-violet-400">◆</span>
          <span className="text-xs font-semibold text-zinc-300">AI Assistant</span>
        </div>
        <button
          className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
          onClick={clearConversation}
          disabled={isStreaming}
          title="New conversation"
        >
          ✕ new
        </button>
      </div>

      {/* Chat area */}
      <Chat ref={chatRef} messages={messages} streamingText={streamingText} liveTools={liveTools} />

      {/* Input area */}
      <div className="flex flex-col gap-2 border-t border-zinc-800 bg-zinc-900 p-3">
        {/* Voice visualizer */}
        {isListening && (
          <div className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1">
            <VoiceVisualizer
              audioData={audioData}
              isRecording={isListening}
              mainBarColor="#a78bfa"
              backgroundColor="transparent"
              className="h-8"
            />
          </div>
        )}

        {/* Image previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map(a => (
              <div key={a.id} className="group relative">
                <img
                  src={`data:${a.mimeType};base64,${a.data}`}
                  alt={a.name}
                  className="h-14 w-14 rounded border border-zinc-700 object-cover"
                />
                <button
                  className="absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300 group-hover:flex"
                  onClick={() => removeAttachment(a.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Image attach */}
          <button
            className="shrink-0 rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
            disabled={isStreaming}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageChange} />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="min-h-9 flex-1 resize-none rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
            placeholder={isListening ? 'Listening…' : 'Ask anything… (Ctrl+Enter to send)'}
            value={messageInput}
            rows={1}
            onChange={e => {
              setMessageInput(e.target.value);
              // Auto-grow
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />

          {/* Voice button */}
          {isVoiceSupported && (
            <button
              className={`shrink-0 rounded p-1.5 transition-colors ${
                isListening ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
              onClick={isListening ? stopVoice : () => void startVoice()}
              title={isListening ? 'Stop recording' : 'Voice input'}
              disabled={isStreaming}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2zm-7 9a7 7 0 0014 0h2a9 9 0 01-8 8.94V22h2v2H9v-2h2v-1.06A9 9 0 013 12h2z" />
              </svg>
            </button>
          )}

          {/* Send button */}
          <button
            className="shrink-0 rounded bg-violet-600 p-1.5 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
            onClick={handleSend}
            disabled={(!messageInput.trim() && attachments.length === 0) || isStreaming}
            title="Send (Ctrl+Enter)"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiChat;
