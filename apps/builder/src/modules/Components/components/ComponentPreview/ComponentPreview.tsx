import { use, useEffect, useMemo, useRef, useState } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import BuilderArea from '@pmodules/Builder/components/BuilderArea';

import { previewOf } from '../../preview';

import type { SpaceComponent } from '@plitzi/sdk-shared';

/** The width a component is drawn at before it is scaled down to the panel: a desktop's. */
const DRAWN_WIDTH = 1280;
/** How tall the thumbnail is, in the panel. */
const SHOWN_HEIGHT = 140;

export type ComponentPreviewProps = {
  component: SpaceComponent;
};

/**
 * A component as its first instance shows it — that instance's words, on the ground it sits on — drawn in a canvas of
 * its own at a desktop's width and scaled down to the panel. A picture: nothing in it is picked or pressed.
 */
const ComponentPreview = ({ component }: ComponentPreviewProps) => {
  const builderContext = use(BuilderContext);
  const { getComponent } = use(ComponentContext);
  const [[flat, components, platform, storedCss]] = useBuilderStore([
    'schema.flat',
    'schema.components',
    'style.platform',
    'schema.settings.customCss'
  ]);
  const customCss = typeof storedCss === 'string' ? storedCss : '';
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  // Fitted to what the component draws, not to the desktop it is laid out at: a card is shown as large as the panel
  // holds it, a band across the page scaled down whole — never larger than it is.
  useEffect(() => {
    const element = box.current;
    if (!element) {
      return undefined;
    }

    const fit = (root: Element) => {
      const { width, height } = root.getBoundingClientRect();
      setScale(Math.min(element.clientWidth / Math.max(width, 1), SHOWN_HEIGHT / Math.max(height, 1), 1));
    };
    let observer: ResizeObserver | undefined;
    // The canvas's document is made once its frame loads: its root is looked for until it is there.
    const look = window.setInterval(() => {
      const root = element.querySelector('iframe')?.contentDocument?.querySelector('[data-plitzi-el]');
      if (!root) {
        return;
      }

      window.clearInterval(look);
      fit(root);
      observer = new ResizeObserver(() => fit(root));
      observer.observe(root);
      observer.observe(element);
    }, 200);

    return () => {
      window.clearInterval(look);
      observer?.disconnect();
    };
  }, [component.id]);

  const preview = useMemo(
    () => previewOf({ flat, components }, { platform }, component),
    [flat, components, platform, component]
  );
  const scope = useMemo(
    () => ({ schema: { flat: component.flat }, runtime: { sources: { props: preview.props } } }),
    [component.flat, preview.props]
  );
  // The canvas resolves its root through the builder: here it is this component's, whichever root the builder is on.
  const context = useMemo(() => {
    const root = component.flat[component.rootId] as (typeof component.flat)[string] | undefined;

    return {
      ...builderContext,
      baseContext: { baseElementId: component.rootId },
      builderGetBaseElement: () => (root ? { data: root, Plugin: getComponent(root.definition.type) } : undefined)
    };
  }, [builderContext, component, getComponent]);

  return (
    <div
      ref={box}
      aria-hidden
      className="pointer-events-none relative w-full overflow-hidden rounded border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-950"
      style={{ height: SHOWN_HEIGHT }}
    >
      <div
        className="flex origin-top-left"
        style={{ width: DRAWN_WIDTH, height: SHOWN_HEIGHT / scale, transform: `scale(${String(scale)})` }}
      >
        <StoreProvider inherit="live" name={`ComponentPreview:${component.id}`} value={scope}>
          <BuilderContext value={context}>
            <BuilderArea
              bare
              previewMode
              showHeader={false}
              displayMode="desktop"
              customCss={customCss}
              ground={preview.ground}
              studio={false}
            />
          </BuilderContext>
        </StoreProvider>
      </div>
    </div>
  );
};

export default ComponentPreview;
