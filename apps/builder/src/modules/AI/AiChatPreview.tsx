/* eslint-disable quotes */
import { useRef, useState } from 'react';

import AiChatHeader from './components/AiChatHeader';
import Chat from './components/Chat/Chat';
import ChatInput from './components/ChatInput/ChatInput';
import { transformStagePreview } from './tools';

import type { AiMessage, AiToolCall } from './types';

const now = Date.now();
const t = (offsetMinutes: number) => now - offsetMinutes * 60 * 1000;

// Proposed pricing section — same format the AI passes to stage_preview
const PRICING_PREVIEW = transformStagePreview({
  baseElementId: 'ap-pricing',
  elements: [
    {
      id: 'ap-pricing',
      type: 'container',
      label: 'Pricing Section',
      children: ['ap-c1', 'ap-c2', 'ap-c3'],
      styles: { display: 'flex', gap: '12px', padding: '20px', 'background-color': '#f4f4f5', 'border-radius': '10px' }
    },
    // Starter
    {
      id: 'ap-c1',
      type: 'container',
      label: 'Starter',
      parentId: 'ap-pricing',
      children: ['ap-h1', 'ap-p1', 'ap-b1'],
      styles: {
        flex: '1',
        border: '1px solid #e4e4e7',
        'border-radius': '8px',
        padding: '16px',
        'background-color': '#ffffff',
        display: 'flex',
        'flex-direction': 'column',
        gap: '8px'
      }
    },
    {
      id: 'ap-h1',
      type: 'heading',
      label: 'Plan',
      parentId: 'ap-c1',
      attributes: { content: 'Starter', subType: 'h3' },
      styles: {
        'font-size': '10px',
        'font-weight': '700',
        'text-transform': 'uppercase',
        'letter-spacing': '0.08em',
        color: '#71717a',
        'font-family': 'system-ui'
      }
    },
    {
      id: 'ap-p1',
      type: 'heading',
      label: 'Price',
      parentId: 'ap-c1',
      attributes: { content: '$9/mo', subType: 'h2' },
      styles: { 'font-size': '22px', 'font-weight': '800', color: '#18181b', 'font-family': 'system-ui' }
    },
    {
      id: 'ap-b1',
      type: 'button',
      label: 'CTA',
      parentId: 'ap-c1',
      children: [],
      attributes: { content: 'Get started', subType: 'button' },
      styles: {
        'margin-top': 'auto',
        padding: '6px 12px',
        'border-radius': '6px',
        'font-size': '11px',
        'font-family': 'system-ui',
        'font-weight': '600',
        'background-color': '#ffffff',
        color: '#7c3aed',
        border: '1px solid #7c3aed',
        width: '100%'
      }
    },
    // Pro (featured)
    {
      id: 'ap-c2',
      type: 'container',
      label: 'Pro',
      parentId: 'ap-pricing',
      children: ['ap-h2', 'ap-p2', 'ap-b2'],
      styles: {
        flex: '1',
        border: '2px solid #7c3aed',
        'border-radius': '8px',
        padding: '16px',
        'background-color': '#7c3aed',
        color: '#ffffff',
        display: 'flex',
        'flex-direction': 'column',
        gap: '8px'
      }
    },
    {
      id: 'ap-h2',
      type: 'heading',
      label: 'Plan',
      parentId: 'ap-c2',
      attributes: { content: 'Pro', subType: 'h3' },
      styles: {
        'font-size': '10px',
        'font-weight': '700',
        'text-transform': 'uppercase',
        'letter-spacing': '0.08em',
        color: '#ddd6fe',
        'font-family': 'system-ui'
      }
    },
    {
      id: 'ap-p2',
      type: 'heading',
      label: 'Price',
      parentId: 'ap-c2',
      attributes: { content: '$29/mo', subType: 'h2' },
      styles: { 'font-size': '22px', 'font-weight': '800', color: '#ffffff', 'font-family': 'system-ui' }
    },
    {
      id: 'ap-b2',
      type: 'button',
      label: 'CTA',
      parentId: 'ap-c2',
      children: [],
      attributes: { content: 'Get started', subType: 'button' },
      styles: {
        'margin-top': 'auto',
        padding: '6px 12px',
        'border-radius': '6px',
        'font-size': '11px',
        'font-family': 'system-ui',
        'font-weight': '600',
        'background-color': '#ffffff',
        color: '#7c3aed',
        border: 'none',
        width: '100%'
      }
    },
    // Enterprise
    {
      id: 'ap-c3',
      type: 'container',
      label: 'Enterprise',
      parentId: 'ap-pricing',
      children: ['ap-h3', 'ap-p3', 'ap-b3'],
      styles: {
        flex: '1',
        border: '1px solid #e4e4e7',
        'border-radius': '8px',
        padding: '16px',
        'background-color': '#ffffff',
        display: 'flex',
        'flex-direction': 'column',
        gap: '8px'
      }
    },
    {
      id: 'ap-h3',
      type: 'heading',
      label: 'Plan',
      parentId: 'ap-c3',
      attributes: { content: 'Enterprise', subType: 'h3' },
      styles: {
        'font-size': '10px',
        'font-weight': '700',
        'text-transform': 'uppercase',
        'letter-spacing': '0.08em',
        color: '#71717a',
        'font-family': 'system-ui'
      }
    },
    {
      id: 'ap-p3',
      type: 'heading',
      label: 'Price',
      parentId: 'ap-c3',
      attributes: { content: '$99/mo', subType: 'h2' },
      styles: { 'font-size': '22px', 'font-weight': '800', color: '#18181b', 'font-family': 'system-ui' }
    },
    {
      id: 'ap-b3',
      type: 'button',
      label: 'CTA',
      parentId: 'ap-c3',
      children: [],
      attributes: { content: 'Contact sales', subType: 'button' },
      styles: {
        'margin-top': 'auto',
        padding: '6px 12px',
        'border-radius': '6px',
        'font-size': '11px',
        'font-family': 'system-ui',
        'font-weight': '600',
        'background-color': '#ffffff',
        color: '#7c3aed',
        border: '1px solid #7c3aed',
        width: '100%'
      }
    }
  ]
});

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
  },
  // ── Approval / confirmation flow ────────────────────────────────────────────
  {
    id: '7',
    role: 'user',
    content: 'Add a pricing section with 3 tiers: Starter, Pro (highlighted), and Enterprise.',
    createdAt: t(1.5)
  },
  {
    id: '8',
    role: 'assistant',
    thinking:
      'The user wants a 3-tier pricing section. I should design the layout first and show a preview before creating any elements. I will use stage_preview to render the proposal, then ask for confirmation. The featured "Pro" card will use the --color-primary variable for its background.',
    content:
      "Here's the pricing section I'm planning to build — **3 cards** inside a flex container using your `--color-primary` for the featured tier.\n\nThis will create **11 elements** across 2 nesting levels. Want me to proceed?",
    tools: [
      {
        id: 't9',
        name: 'stage_preview',
        args: { baseElementId: 'ap-pricing', elementCount: 11 },
        status: 'done',
        result: { preview: 'ap-pricing' }
      }
    ],
    preview: PRICING_PREVIEW,
    actions: [
      { id: 'approve', label: '✓ Create elements', variant: 'primary' },
      { id: 'cancel', label: 'Cancel', variant: 'default' }
    ],
    createdAt: t(1)
  },
  {
    id: '9',
    role: 'user',
    content: 'Looks great, go ahead!',
    createdAt: t(0.7)
  },
  {
    id: '10',
    role: 'assistant',
    content: 'Done! The pricing section is now live on the page.',
    tools: [
      {
        id: 't10',
        name: 'create_element',
        args: { type: 'container', pageId: 'home', label: 'Pricing Section' },
        status: 'done',
        result: { elementId: 'pricing-1' }
      },
      {
        id: 't11',
        name: 'create_element',
        args: { type: 'container', parentId: 'pricing-1', label: 'Starter Card' },
        status: 'done',
        result: { elementId: 'pricing-card-1' }
      },
      {
        id: 't12',
        name: 'create_element',
        args: { type: 'container', parentId: 'pricing-1', label: 'Pro Card' },
        status: 'done',
        result: { elementId: 'pricing-card-2' }
      },
      {
        id: 't13',
        name: 'create_element',
        args: { type: 'container', parentId: 'pricing-1', label: 'Enterprise Card' },
        status: 'done',
        result: { elementId: 'pricing-card-3' }
      },
      {
        id: 't14',
        name: 'apply_styles',
        args: { elementId: 'pricing-1', variant: 'pricing-section' },
        status: 'done'
      }
    ],
    preview: { elementId: 'pricing-1' },
    createdAt: t(0.3)
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

type PreviewMode = 'history' | 'streaming' | 'empty';

const cycleMode = (m: PreviewMode): PreviewMode =>
  m === 'empty' ? 'history' : m === 'history' ? 'streaming' : 'empty';

const AiChatPreview = () => {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<PreviewMode>('history');

  const messages = mode === 'empty' ? [] : MOCK_MESSAGES;
  const streamingText = mode === 'streaming' ? MOCK_STREAMING : '';
  const liveThinking = mode === 'streaming' ? MOCK_LIVE_THINKING : '';
  const liveTools = mode === 'streaming' ? MOCK_LIVE_TOOLS : [];

  return (
    <div className="flex h-full w-full flex-col bg-white font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <AiChatHeader
        onClear={() => setMode('empty')}
        isStreaming={false}
        badge="preview"
        extra={
          <button
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            onClick={() => setMode(cycleMode)}
          >
            cycle: {mode}
          </button>
        }
      />
      <Chat
        ref={chatRef}
        messages={messages}
        streamingText={streamingText}
        liveThinking={liveThinking}
        liveTools={liveTools}
      />
      <ChatInput
        isStreaming={false}
        isListening={false}
        isVoiceSupported={false}
        audioData={null}
        onSend={() => {}}
        onVoiceToggle={() => {}}
      />
    </div>
  );
};

export default AiChatPreview;
