import { useEffect, useState } from 'react';

import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';

/** Whether a node is drawn: neither it nor anything around it is `display: none` — what hiding an element does. */
const isDrawn = (node: Element): boolean =>
  typeof node.checkVisibility === 'function' ? node.checkVisibility() : node.getClientRects().length > 0;

/**
 * Whether the element named `id` is on the page — shown by its own `visible`, by every container around it and by the
 * breakpoint the page is drawn at — and `undefined` until that is known (on the server, and before the first look).
 *
 * For a plugin that acts on another element appearing: a tool window opened by a flow, a panel a breakpoint hides. Kept
 * up to date while the plugin is mounted, at the cost of that plugin alone — nothing is published for the elements
 * nobody asks about. When the plugin only needs what decides it, bind a prop to the source its `visible` reads instead.
 * An element rendered once per row is on the page while any of its rows is.
 */
const useElementVisible = (id: string): boolean | undefined => {
  const {
    utils: { rootRef }
  } = usePlitzi();
  const [visible, setVisible] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const root = rootRef.current;
    const view = root?.ownerDocument.defaultView;
    if (!root || !view || !id) {
      return undefined;
    }

    const selector = `[data-plitzi-el="${view.CSS.escape(id)}"]`;
    const look = () => setVisible([...root.querySelectorAll(selector)].some(isDrawn));
    // Every class, style and node change under the root can show or hide it; looked at once per frame, not per change.
    let frame = 0;
    const observer = new view.MutationObserver(() => {
      if (!frame) {
        frame = view.requestAnimationFrame(() => {
          frame = 0;
          look();
        });
      }
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    // A breakpoint shows or hides it without changing a class.
    view.addEventListener('resize', look);
    look();

    return () => {
      observer.disconnect();
      view.removeEventListener('resize', look);
      view.cancelAnimationFrame(frame);
    };
  }, [id, rootRef]);

  return visible;
};

export default useElementVisible;
