import { createElement, useState } from 'react';

import type { CSSProperties } from 'react';

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
 * Renders a runtime:'server' element as frozen server HTML.
 *
 * During the initial client render (hydrateRoot), React calls useState initializers
 * synchronously before it has modified the DOM. We use this window to read the
 * server-rendered element from the DOM via its data-plitzi-id attribute, capture its
 * tag, attributes, and innerHTML, then render it back via dangerouslySetInnerHTML.
 *
 * The actual plugin component is never mounted in the browser, so no useEffect or
 * useState from the plugin ever runs. React hydrates the snapshot element without
 * touching its children (dangerouslySetInnerHTML takes ownership of innerHTML).
 */
const ServerStaticShell = ({ id }: { id: string }) => {
  const [snapshot] = useState<Snapshot>(() => {
    if (typeof document === 'undefined') {
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

  if (!snapshot) {
    return null;
  }

  return createElement(snapshot.tag, {
    'data-rsc-id': id,
    className: snapshot.className || undefined,
    style: snapshot.style,
    ...snapshot.attrs,
    dangerouslySetInnerHTML: { __html: snapshot.html }
  });
};

export default ServerStaticShell;
