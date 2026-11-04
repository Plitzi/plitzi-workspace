import { createElement, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useServerRootElementInteractions } from './useRootElementInteractions';

import type { ElementContextValue } from '../ElementContext';

const elementContext = {
  id: 'card',
  className: 'from-context',
  attributes: {},
  definition: {
    rootId: 'root',
    label: 'Card',
    type: 'container',
    items: [],
    styleSelectors: { base: 'card-base' },
    interactions: { click: { id: 'click', type: 'trigger', action: 'onClick', enabled: true } }
  },
  elementState: { visibility: true },
  setElementState: () => undefined
} as unknown as ElementContextValue;

const Harness = ({ withRef }: { withRef: boolean }) => {
  const own = useRef<HTMLElement | null>(null);
  const { className, events, nodeRef } = useServerRootElementInteractions({
    elementContext,
    previewMode: true,
    debugMode: false,
    className: 'given',
    otherProps: {},
    ref: withRef ? own : undefined
  });

  return createElement('div', {
    className,
    'data-events': Object.keys(events).join(','),
    'data-own-ref': String(nodeRef === own)
  });
};

// On the server only the class reaches the page: no handler, no trigger wired — the browser's hook wires those.
describe('an element drawn on the server', () => {
  it('carries its classes, wires no event, and keeps the component’s own ref', () => {
    const html = renderToString(createElement(Harness, { withRef: true }));

    expect(html).toContain('class="from-context given card-base"');
    expect(html).toContain('data-events=""');
    expect(html).toContain('data-own-ref="true"');
    expect(renderToString(createElement(Harness, { withRef: false }))).toContain('data-own-ref="false"');
  });
});
