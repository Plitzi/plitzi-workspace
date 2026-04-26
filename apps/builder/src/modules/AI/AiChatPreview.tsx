import { useRef, useState } from 'react';

import Chat from './components/Chat';

import type { AiMessage, AiToolCall } from './types';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const sendShortcutLabel = isMac ? '⌘↵' : 'Ctrl+Enter';

const now = Date.now();
const t = (offsetMinutes: number) => now - offsetMinutes * 60 * 1000;

const MOCK_MESSAGES: AiMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'Can you add a hero section to the homepage with a title, subtitle, and a CTA button?',
    createdAt: t(12)
  },
  {
    id: '2',
    role: 'assistant',
    content:
      'Sure! Adding a hero section to your homepage now. Let me inspect the current page structure first, then create the elements.',
    tools: [
      { id: 't1', name: 'get_page_schema', args: { pageId: 'home' }, status: 'done', result: { elements: 3 } },
      {
        id: 't2',
        name: 'create_element',
        args: { type: 'container', pageId: 'home', label: 'Hero Section' },
        status: 'done',
        result: { elementId: 'hero-1' }
      },
      {
        id: 't3',
        name: 'create_element',
        args: { type: 'text', parentId: 'hero-1', label: 'Hero Title' },
        status: 'done',
        result: { elementId: 'title-1' }
      },
      {
        id: 't4',
        name: 'create_element',
        args: { type: 'text', parentId: 'hero-1', label: 'Subtitle' },
        status: 'done',
        result: { elementId: 'subtitle-1' }
      },
      {
        id: 't5',
        name: 'create_element',
        args: { type: 'button', parentId: 'hero-1', label: 'CTA Button' },
        status: 'done',
        result: { elementId: 'cta-1' }
      }
    ],
    preview: { elementId: 'hero-1' },
    createdAt: t(11)
  },
  {
    id: '3',
    role: 'user',
    content: 'Make the hero background dark violet and center everything',
    createdAt: t(8)
  },
  {
    id: '4',
    role: 'assistant',
    thinking:
      'The user wants dark violet background and centered content. I should set backgroundColor on the container element and then update alignItems and textAlign. I need to call update_element_style twice — once for the background color and once for the alignment. The hex #1e0a3c looks right for dark violet.',
    content:
      'Done! I updated the hero container with a dark violet background (`#1e0a3c`) and set `align-items: center` + `text-align: center` on all children.\n\n```css\n.hero {\n  background: #1e0a3c;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  text-align: center;\n  padding: 80px 24px;\n}\n```',
    tools: [
      {
        id: 't6',
        name: 'update_element_style',
        args: { elementId: 'hero-1', property: 'backgroundColor', value: '#1e0a3c' },
        status: 'done'
      },
      {
        id: 't7',
        name: 'update_element_style',
        args: { elementId: 'hero-1', property: 'alignItems', value: 'center' },
        status: 'done'
      }
    ],
    createdAt: t(7)
  },
  {
    id: '5',
    role: 'user',
    content: 'What variables are available in the global styles?',
    createdAt: t(3)
  },
  {
    id: '6',
    role: 'assistant',
    content:
      'Here are the global style variables defined in your space:\n\n| Variable | Value |\n|---|---|\n| `--color-primary` | `#7c3aed` |\n| `--color-surface` | `#ffffff` |\n| `--font-size-base` | `16px` |\n| `--spacing-md` | `16px` |\n| `--border-radius` | `8px` |\n\nWould you like me to use any of these in the hero section?',
    tools: [{ id: 't8', name: 'list_style_variables', args: {}, status: 'done', result: { count: 5 } }],
    createdAt: t(2)
  }
];

const MOCK_LIVE_TOOLS: AiToolCall[] = [
  { id: 'live1', name: 'get_segment_schema', args: { segmentId: 'navbar' }, status: 'done' },
  { id: 'live2', name: 'update_element', args: { elementId: 'hero-1', label: 'Hero' }, status: 'running' }
];

const MOCK_LIVE_THINKING =
  'The user wants to update font size and weight. Let me first check which element holds the title text, then apply the styles using update_element_style…';

const MOCK_STREAMING =
  'Updating the hero title font size and weight to make it stand out more. Using the `--color-primary` variable for the CTA button color…';

// Cycles through 3 states: idle → streaming → idle
type PreviewMode = 'history' | 'streaming' | 'empty';

const AiChatPreview = () => {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<PreviewMode>('history');
  const [messageInput, setMessageInput] = useState('');

  const messages = mode === 'empty' ? [] : MOCK_MESSAGES;
  const streamingText = mode === 'streaming' ? MOCK_STREAMING : '';
  const liveThinking = mode === 'streaming' ? MOCK_LIVE_THINKING : '';
  const liveTools = mode === 'streaming' ? MOCK_LIVE_TOOLS : [];

  return (
    <div className="flex h-full w-full flex-col bg-white font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm text-violet-500 dark:text-violet-400">◆</span>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">AI Assistant</span>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            preview
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            onClick={() => setMode(m => (m === 'empty' ? 'history' : m === 'history' ? 'streaming' : 'empty'))}
          >
            cycle mode: {mode}
          </button>
          <button
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            title="New conversation"
          >
            ✕ new
          </button>
        </div>
      </div>

      {/* Chat area */}
      <Chat
        ref={chatRef}
        messages={messages}
        streamingText={streamingText}
        liveThinking={liveThinking}
        liveTools={liveTools}
      />

      {/* Input area */}
      <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Image attach */}
          <button
            className="shrink-0 rounded p-1.5 text-zinc-400 transition-colors hover:bg-gray-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="min-h-9 flex-1 resize-none rounded border border-gray-200 bg-white px-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-600"
            placeholder={`Ask anything… (${sendShortcutLabel} to send)`}
            value={messageInput}
            rows={1}
            onChange={e => {
              setMessageInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
          />

          {/* Voice button */}
          <button
            className="shrink-0 rounded p-1.5 text-zinc-400 transition-colors hover:bg-gray-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Voice input"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2zm-7 9a7 7 0 0014 0h2a9 9 0 01-8 8.94V22h2v2H9v-2h2v-1.06A9 9 0 013 12h2z" />
            </svg>
          </button>

          {/* Send button */}
          <button
            className="shrink-0 rounded bg-violet-600 p-1.5 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
            disabled={!messageInput.trim()}
            title={`Send (${sendShortcutLabel})`}
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

export default AiChatPreview;
