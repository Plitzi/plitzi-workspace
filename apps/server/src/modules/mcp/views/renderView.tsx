/* eslint-disable react-refresh/only-export-components -- one bundled entry: components cannot move out. */
import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import PlitziSdk from '@plitzi/plitzi-sdk';
import { Component, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

/** The MCP Apps view for plitzi_render: the entry the server bundles (React, the MCP Apps runtime and the Plitzi
 *  SDK included) and inlines in the ui:// page — which is what lets it run in a sandbox that can fetch nothing. */

const panelStyle = { padding: 16, font: '13px/1.5 system-ui, sans-serif', color: '#b91c1c' } as const;

// Every failure ends up here: an iframe left on its placeholder would hide the reason in the sandbox's console.
const ErrorPanel = ({ title, details }: { title: string; details: string }) => (
  <div style={panelStyle}>
    <strong>{title}</strong>
    <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: '#7f1d1d', fontSize: 12 }}>{details}</pre>
  </div>
);

class RenderBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <ErrorPanel title="Widget failed to render" details={this.state.error.message} />;
    }

    return this.props.children;
  }
}

const RenderApp = () => {
  const [result, setResult] = useState<CallToolResult | null>(null);
  const [cancelled, setCancelled] = useState<string | undefined>(undefined);
  const [context, setContext] = useState<McpUiHostContext | undefined>(undefined);

  // useApp creates the App, runs onAppCreated so every handler is in place BEFORE the handshake, and connects.
  const { app, error } = useApp({
    appInfo: { name: 'Plitzi Widget', version: '1.0.0' },
    capabilities: {},
    onAppCreated: instance => {
      instance.ontoolresult = setResult;
      instance.ontoolcancelled = params => setCancelled(params.reason ?? 'The host cancelled the render.');
      instance.onhostcontextchanged = params => setContext(previous => ({ ...previous, ...params }));
      instance.onteardown = () => ({});
    }
  });

  // The context the host sent in its initialize result predates any change notification.
  useEffect(() => {
    if (app) {
      setContext(app.getHostContext());
    }
  }, [app]);

  useHostStyles(app, context);

  const failure = error?.message ?? cancelled;
  if (failure) {
    return <ErrorPanel title="Could not render the widget" details={failure} />;
  }

  // Still connecting, or connected and waiting for the result: the page's CSS placeholder covers both.
  if (!result) {
    return null;
  }

  // The payload rides in structuredContent, which the protocol types as unknown-valued; plitzi_render is the one
  // guaranteeing the shape, and the SDK validates it again when it renders.
  const offlineData = result.structuredContent?.offlineData as OfflineDataRaw | undefined;
  if (!offlineData) {
    // A failed render answers with its (already compact) reasons as the tool's JSON text summary.
    const text = result.content.find(entry => entry.type === 'text');

    return <ErrorPanel title="Render failed" details={text?.text ?? 'The tool returned no widget data.'} />;
  }

  const insets = context?.safeAreaInsets;

  return (
    <div
      style={{
        padding: `${insets?.top ?? 0}px ${insets?.right ?? 0}px ${insets?.bottom ?? 0}px ${insets?.left ?? 0}px`
      }}
    >
      <RenderBoundary>
        <PlitziSdk offlineData={offlineData} offlineMode environment="main" renderMode="raw" />
      </RenderBoundary>
    </div>
  );
};

const root = document.getElementById('plitzi');
if (root) {
  createRoot(root).render(<RenderApp />);
}
