import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

import VoiceVisualizer from '../VoiceVisualizer';
import AttachmentThumbnail from './AttachmentThumbnail';

import type { AiAttachment } from '../../types';
import type { ChangeEvent, KeyboardEvent } from 'react';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const sendShortcutLabel = isMac ? '⌘↵' : 'Ctrl+Enter';

export type ChatInputHandle = { appendText: (text: string) => void };

type ChatInputProps = {
  isStreaming: boolean;
  isListening: boolean;
  isVoiceSupported: boolean;
  audioData: Uint8Array | null;
  onSend: (message: string, attachments: AiAttachment[]) => void;
  onVoiceToggle: () => void;
};

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ isStreaming, isListening, isVoiceSupported, audioData, onSend, onVoiceToggle }, ref) => {
    const [messageInput, setMessageInput] = useState('');
    const [attachments, setAttachments] = useState<AiAttachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
      appendText: (text: string) => {
        setMessageInput(prev => (prev ? `${prev} ${text}` : text));
        textareaRef.current?.focus();
      }
    }));

    const handleSend = useCallback(() => {
      if ((!messageInput.trim() && attachments.length === 0) || isStreaming) return;
      const msg = messageInput;
      const atts = attachments;
      setMessageInput('');
      setAttachments([]);
      onSend(msg, atts);
    }, [messageInput, attachments, isStreaming, onSend]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
      },
      [handleSend]
    );

    const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const result = ev.target?.result as string;
          const [header, data] = result.split(',');
          const mimeType = header.split(':')[1].split(';')[0];
          setAttachments(prev => [
            ...prev,
            { id: crypto.randomUUID(), type: 'image', mimeType, data, name: file.name }
          ]);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    }, []);

    const removeAttachment = useCallback((id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
    }, []);

    return (
      <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        {isListening && (
          <div className="rounded-md border border-gray-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950">
            <VoiceVisualizer
              audioData={audioData}
              isRecording={isListening}
              mainBarColor="#a78bfa"
              backgroundColor="transparent"
              className="h-8"
            />
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map(a => (
              <AttachmentThumbnail key={a.id} attachment={a} onRemove={removeAttachment} />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            className="shrink-0 rounded p-1.5 text-zinc-400 transition-colors hover:bg-gray-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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

          <textarea
            ref={textareaRef}
            className="min-h-9 flex-1 resize-none rounded border border-gray-200 bg-white px-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-600"
            placeholder={isListening ? 'Listening…' : `Ask anything… (${sendShortcutLabel} to send)`}
            value={messageInput}
            rows={1}
            onChange={e => {
              setMessageInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />

          {isVoiceSupported && (
            <button
              className={`shrink-0 rounded p-1.5 transition-colors ${
                isListening
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:bg-gray-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
              }`}
              onClick={onVoiceToggle}
              title={isListening ? 'Stop recording' : 'Voice input'}
              disabled={isStreaming}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2zm-7 9a7 7 0 0014 0h2a9 9 0 01-8 8.94V22h2v2H9v-2h2v-1.06A9 9 0 013 12h2z" />
              </svg>
            </button>
          )}

          <button
            className="shrink-0 rounded bg-violet-600 p-1.5 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
            onClick={handleSend}
            disabled={(!messageInput.trim() && attachments.length === 0) || isStreaming}
            title={`Send (${sendShortcutLabel})`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;
