/* eslint-disable react-refresh/only-export-components -- one bundled entry: components cannot move out. */
import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** The smallest MCP App view there is — copy this folder to start a new one. It shows the whole contract:
 *  connect, receive the tool call and its result, call a tool back, and inherit the host's look. Everything it
 *  imports is bundled into the page, so a view that stays this small stays a few KB. */

// Host CSS variables: the chat's own palette and fonts, applied by useHostStyles below.
const panel = {
  padding: 16,
  font: 'var(--font-sans, system-ui, sans-serif)',
  color: 'var(--color-text-primary, #0f172a)',
  background: 'var(--color-background-secondary, #f8fafc)',
  borderRadius: 'var(--border-radius-md, 8px)'
} as const;

const textOf = (result: CallToolResult): string => result.content.find(entry => entry.type === 'text')?.text ?? '';

const ExampleApp = () => {
  const [result, setResult] = useState<CallToolResult | null>(null);
  const [context, setContext] = useState<McpUiHostContext | undefined>(undefined);

  // useApp creates the App, runs onAppCreated so every handler is in place BEFORE the handshake, and connects.
  const { app, error } = useApp({
    appInfo: { name: 'Plitzi Example', version: '1.0.0' },
    capabilities: {},
    onAppCreated: instance => {
      // The result of the tool that opened this view. `ontoolinput` gives its arguments instead.
      instance.ontoolresult = setResult;
      instance.onhostcontextchanged = params => setContext(previous => ({ ...previous, ...params }));
      instance.onteardown = () => ({});
    }
  });

  useHostStyles(app, context);

  if (error) {
    return <div style={panel}>Could not connect to the host: {error.message}</div>;
  }

  if (!app) {
    return null;
  }

  const insets = context?.safeAreaInsets;
  const message = result ? textOf(result) : 'Waiting for the tool result…';

  return (
    <div style={{ ...panel, margin: `${insets?.top ?? 0}px ${insets?.right ?? 0}px` }}>
      <p>{message}</p>
      {/* An app can call the server's tools on its own — each call is a round-trip, so plan for latency. */}
      <button
        type="button"
        onClick={() => void app.callServerTool({ name: 'plitzi_search', arguments: {} }).then(setResult)}
      >
        Call plitzi_search
      </button>
    </div>
  );
};

const root = document.getElementById('app');
if (root) {
  createRoot(root).render(<ExampleApp />);
}
