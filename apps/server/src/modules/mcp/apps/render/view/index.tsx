/* eslint-disable react-refresh/only-export-components -- one bundled entry: components cannot move out. */
import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import PlitziSdk from '@plitzi/plitzi-sdk';
import { Component, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { readHeldBatch, writeHeldBatch } from './heldBatch';
import { streamProgress } from './streamProgress';

import type { StreamProgress } from './streamProgress';
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

/** The wait a user reads as "this is slow" is the model TYPING the batch: the tool only runs once the last brace
 *  is written, and until then the page shows its static "Rendering…". The host streams the arguments as they
 *  arrive, so this stands in for the widget meanwhile — bars that grow with the elements already authored, and the
 *  widget's own title as soon as the batch names it. It never shows a half-built widget: the real one replaces it
 *  wholesale when the result lands. A host that streams nothing paints none of this and keeps the static text. */
const SKELETON_BAR_WIDTHS = ['92%', '78%', '85%', '64%', '88%', '72%'];

// The deployment's own switch (mcpAi.renderStreaming), handed over by the page. Absent means on: a page built
// before the setting existed carries none, and a host that streams no arguments paints the same either way.
const streamingEnabled =
  (globalThis as { __PLITZI_VIEW__?: { streaming?: boolean } }).__PLITZI_VIEW__?.streaming !== false;

const skeletonBarStyle = {
  height: 10,
  borderRadius: 5,
  backgroundColor: 'var(--color-background-tertiary, light-dark(#e2e8f0, #333a48))',
  animation: 'plitzi-skeleton-pulse 1.4s ease-in-out infinite'
} as const;

// One bar per few elements, so the block visibly grows while the model writes, and a ceiling so a 200-element
// widget does not fill the panel with grey.
const barCount = (elements: number): number => Math.min(Math.max(Math.ceil(elements / 3), 2), 6);

const StreamSkeleton = ({ progress }: { progress: StreamProgress }) => {
  const caption = progress.patch ? 'Updating the widget…' : 'Building the widget…';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        font: '13px/1.5 var(--font-sans, system-ui, sans-serif)'
      }}
    >
      <style>{'@keyframes plitzi-skeleton-pulse { 0%, 100% { opacity: 0.5 } 50% { opacity: 1 } }'}</style>
      {progress.title && <strong style={{ fontSize: 15 }}>{progress.title}</strong>}
      {SKELETON_BAR_WIDTHS.slice(0, barCount(progress.elements)).map(width => (
        <div key={width} style={{ ...skeletonBarStyle, width }} />
      ))}
      <span style={{ color: 'var(--color-text-tertiary, light-dark(#64748b, #9aa4b2))' }}>
        {caption}
        {progress.elements > 0 && ` ${progress.elements} elements so far`}
      </span>
    </div>
  );
};

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
  const [progress, setProgress] = useState<StreamProgress | undefined>(undefined);
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
    // The round trip can fail on its own: a host that forwards no tool calls, a connection dropped mid-patch, a
    // view torn down while the answer is in flight. Unreported it would surface as an unhandled rejection inside
    // the sandbox and the model would wait forever for a widget that is never coming.
    try {
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
    } catch (reason) {
      await app
        .updateModelContext({
          content: [
            {
              type: 'text',
              text: `The patch could not be delivered (${reason instanceof Error ? reason.message : String(reason)}), so the widget is unchanged. Re-send the full batch without \`patch\` if it needs to change.`
            }
          ]
        })
        .catch(() => undefined);
    }
  };

  // useApp creates the App, runs onAppCreated so every handler is in place BEFORE the handshake, and connects.
  const { app, error } = useApp({
    appInfo: { name: 'Plitzi Widget', version: '1.0.0' },
    capabilities: {},
    onAppCreated: instance => {
      appRef.current = instance;
      // Streaming arguments (sent zero or more times while the model writes) and then the complete ones, which the
      // host MUST send before the result: the last frame the placeholder gets covers the server render itself.
      // The `on*` setters are the deprecated half of the API, kept because every other handler here uses them —
      // mixing addEventListener for one of them would hide the lifecycle this component is built around.
      if (streamingEnabled) {
        instance.ontoolinputpartial = params => setProgress(streamProgress(params.arguments));
        instance.ontoolinput = params => setProgress(streamProgress(params.arguments));
      }

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

  // Waiting for the result. Once the host has streamed any of the arguments the skeleton stands in for the widget
  // being written; before that (and on a host that streams nothing) the page's own CSS placeholder covers it.
  if (!result) {
    if (progress) {
      return <StreamSkeleton progress={progress} />;
    }

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
  // The icon fonts, ~330 KB of base64 woff2, are not in the page: they arrive with the widgets that draw an icon,
  // so every other widget's iframe has that much less to load before it paints (see ../styles.ts).
  const iconCss = result.structuredContent?.iconCss as string | undefined;

  return (
    <div
      style={{
        padding: `${insets?.top ?? 0}px ${insets?.right ?? 0}px ${insets?.bottom ?? 0}px ${insets?.left ?? 0}px`
      }}
    >
      {iconCss && <style>{iconCss}</style>}
      <RenderBoundary>
        <PlitziSdk offlineData={offlineData} offlineMode environment="main" renderMode="raw" branding={false} />
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
