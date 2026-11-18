import { createElement, useState } from 'react';

import { ownHtml } from '@plitzi/sdk-shared/security';

import type { CSSProperties, ReactNode } from 'react';

type Snapshot = {
  tag: string;
  className: string;
  style?: CSSProperties;
  attrs: Record<string, string>;
  html: string;
} | null;

const parseStyleString = (styleStr: string): CSSProperties => {
  const style: CSSProperties & Record<string, string> = {};
  for (const part of styleStr.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) {
      continue;
    }

    const prop = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (prop && value) {
      const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      style[camel] = value;
    }
  }

  return style;
};

/**
 * Keeps a `runtime: 'server'` element this browser cannot draw as the server's own HTML, frozen.
 *
 * During the initial client render (hydrateRoot), React calls useState initializers synchronously before it has
 * modified the DOM. We use this window to read the server-rendered element from the DOM via its `data-rsc-id`
 * attribute, capture its tag, attributes, and innerHTML, then render it back via dangerouslySetInnerHTML: React
 * hydrates the snapshot element without touching its children.
 *
 * `frozen` is whether there is anything to freeze for: true for an element with no component in this browser — a
 * plugin registered on the server alone — which has nothing else to show, for the life of the page. Every other
 * server element is `children`, drawn here from the payload the server drew it with and hydrated over its markup like
 * any element: frozen first and swapped for itself once hydration was over, its DOM was rebuilt on every load.
 *
 * When there is nothing to freeze against, `children` is rendered too. That is the SPA case: a route change mounts a
 * page whose server elements were never in this document, and freezing an element against markup that does not exist
 * used to render nothing at all.
 *
 * The shell itself stays where it is either way, so the element under it keeps its identity.
 */
const ServerStaticShell = ({ id, frozen, children }: { id: string; frozen: boolean; children?: ReactNode }) => {
  // Read once, on the render that hydrates: past it, the DOM is React's and holds nothing to freeze against.
  const [snapshot] = useState<Snapshot>(() => {
    if (!frozen || typeof document === 'undefined') {
      return null;
    }

    const el = document.querySelector<HTMLElement>(`[data-rsc-id="${id}"]`);
    if (!el) {
      return null;
    }

    const attrs: Record<string, string> = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const { name, value } = el.attributes[i];
      // className and style are handled separately; data-rsc-id is re-added explicitly
      if (name !== 'class' && name !== 'style' && name !== 'data-rsc-id') {
        attrs[name] = value;
      }
    }

    const styleAttr = el.getAttribute('style');

    return {
      tag: el.tagName.toLowerCase(),
      className: el.className,
      style: styleAttr ? parseStyleString(styleAttr) : undefined,
      attrs,
      html: el.innerHTML
    };
  });

  if (!snapshot || !frozen) {
    return children;
  }

  return createElement(snapshot.tag, {
    'data-rsc-id': id,
    className: snapshot.className || undefined,
    style: snapshot.style,
    ...snapshot.attrs,
    dangerouslySetInnerHTML: { __html: ownHtml(snapshot.html) }
  });
};

export default ServerStaticShell;
