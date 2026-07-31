/* eslint-disable react-refresh/only-export-components -- one bundled entry: components cannot move out. */
import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import PlitziSdk from '@plitzi/plitzi-sdk';
import { Component, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { readHeldBatch, writeHeldBatch } from './heldBatch';

import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

/** The view for plitzi_render: the entry the server bundles (React, the MCP Apps runtime and the Plitzi SDK
 *  included) and inlines in the shared ui:// page shell — which is what lets it run in a sandbox that can fetch
 *  nothing. It mounts on `#app`, the shell's root. */

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

/** The batch the widget on screen was built from. It lives on the HOST side — this ref plus localStorage — because
 *  the server keeps nothing between calls, which is what lets any replica (or an edge deployment) answer any
 *  request. A patch is merged into it and sent back through `callServerTool`, so the full batch never enters the
 *  model's context. The ref alone would not do: the host gives each tool call its own view, so a patch usually
 *  starts from an empty instance and reads the batch back from storage by renderId (see heldBatch.ts). */
type Held = { renderId?: string; operations: unknown[] };

const summarise = (result: CallToolResult): string => {
  const text = result.content.find(entry => entry.type === 'text');

  return text?.text ?? 'no summary';
};

const RenderApp = () => {
  const [result, setResult] = useState<CallToolResult | null>(null);
  const [cancelled, setCancelled] = useState<string | undefined>(undefined);
  const [context, setContext] = useState<McpUiHostContext | undefined>(undefined);
  const held = useRef<Held>({ operations: [] });
  const appRef = useRef<App | null>(null);

  // A patch carries only what changed. Merging it onto the held batch and re-calling the tool is what keeps the
  // server stateless: it re-renders the WHOLE widget (so refs, integrity and the audit are all checked as usual)
  // from a payload that travelled host↔server, and the model hears the outcome through updateModelContext.
  const applyPatch = async (renderId: string, delta: unknown[]): Promise<void> => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    const base = held.current.renderId === renderId ? held.current.operations : (readHeldBatch(renderId) ?? []);
    if (base.length === 0) {
      await app.updateModelContext({
        content: [
          {
            type: 'text',
            text: `The widget ${renderId} could not be recovered, so nothing was patched. Call plitzi_render again with the complete batch and without \`patch\`.`
          }
        ]
      });

      return;
    }

    const merged = [...base, ...delta];
    const rendered = await app.callServerTool({
      name: 'plitzi_render',
      arguments: { operations: merged, renderId }
    });
    const offlineData = rendered.structuredContent?.offlineData;
    if (offlineData) {
      const applied = (rendered.structuredContent?.operations as unknown[] | undefined) ?? merged;
      held.current = { renderId, operations: applied };
      writeHeldBatch(renderId, applied);
      setResult(rendered);
    }

    await app.updateModelContext({
      content: [
        {
          type: 'text',
          text: offlineData
            ? `Widget updated: ${summarise(rendered)}`
            : `The patch did not apply, the widget is unchanged: ${summarise(rendered)}`
        }
      ]
    });
  };

  // useApp creates the App, runs onAppCreated so every handler is in place BEFORE the handshake, and connects.
  const { app, error } = useApp({
    appInfo: { name: 'Plitzi Widget', version: '1.0.0' },
    capabilities: {},
    onAppCreated: instance => {
      appRef.current = instance;
      instance.ontoolresult = toolResult => {
        const renderId = toolResult.structuredContent?.renderId as string | undefined;
        if (toolResult.structuredContent?.patch === true && renderId) {
          void applyPatch(renderId, (toolResult.structuredContent.operations as unknown[] | undefined) ?? []);

          return;
        }

        // A result carrying no widget is a failed render or a refused patch. The model already reads its reasons
        // as text, so it must not blank a widget that is on screen — nor drop the batch that widget was built
        // from, which is the only copy of it anywhere. With nothing on screen yet, the error IS the view.
        if (!toolResult.structuredContent?.offlineData && held.current.operations.length > 0) {
          return;
        }

        const operations = (toolResult.structuredContent?.operations as unknown[] | undefined) ?? [];
        held.current = { renderId, operations };
        if (renderId && operations.length > 0) {
          writeHeldBatch(renderId, operations);
        }

        setResult(toolResult);
      };
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

const root = document.getElementById('app');
if (root) {
  // The SDK styles its tree from this container class down.
  root.className = 'plitzi-root-container';
  createRoot(root).render(<RenderApp />);
}
