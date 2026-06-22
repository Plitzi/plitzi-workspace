/* eslint-disable react-hooks/exhaustive-deps */

import { useCallback, use, useEffect, useMemo, useState } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';

import type { BuilderState, EventBridgeEvent } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type OverlaySpacingProps = {
  id?: string;
  hoverRemove?: boolean;
  hasItems?: boolean;
  refIframe?: RefObject<HTMLIFrameElement | null>;
  elementDOM?: HTMLElement | null;
  zoom?: number;
};

const OverlaySpacing = ({
  id = '',
  hoverRemove = false,
  hasItems = false,
  refIframe,
  elementDOM,
  zoom = 1
}: OverlaySpacingProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [element = undefined] = useStore(`schema.flat.${id}`);
  const { eventBridge } = use(EventBridgeContext);
  const [rawStyle, setRawStyle] = useState<Partial<CSSStyleDeclaration> | undefined>({});

  const getStyle = useCallback(() => {
    if (!elementDOM) {
      return undefined;
    }

    if (refIframe && refIframe.current) {
      return refIframe.current.contentWindow?.getComputedStyle(elementDOM);
    }

    return window.getComputedStyle(elementDOM);
  }, [elementDOM, refIframe]);

  useEffect(() => {
    const handler = (events: Record<EventBridgeEvent, unknown>) => {
      for (const event in events) {
        let refresh = false;
        if (event === 'styleAddSelector') {
          const attribute = (events[event] as string[])[3] ?? '';
          refresh = attribute.includes('padding') || attribute.includes('margin') || !attribute;
        } else if (event === 'styleUpdateSelector') {
          const attribute = (events[event] as string[])[2] ?? '';
          refresh = attribute.includes('padding') || attribute.includes('margin') || !attribute;
        }

        if (refresh) {
          const value = getStyle();
          setRawStyle(value);
          refresh = false;
        }
      }
    };

    return eventBridge.listen(['styleAddSelector', 'styleUpdateSelector'], handler);
  }, [getStyle, id]);

  useEffect(() => {
    setRawStyle(getStyle());
  }, [getStyle, id, element?.definition.initialState?.styleVariants]);

  const calculateWidth = useCallback((distance?: string, mode = 'rest', correction = '0px') => {
    if (distance === '0px') {
      return '0px';
    }

    if (!correction || correction === '0px') {
      return distance;
    }

    return `calc(${distance} ${mode === 'sum' ? '+' : '-'} ${correction})`;
  }, []);

  const calculateSpacingMemo = useMemo(() => {
    const { marginTop, marginBottom, marginLeft, marginRight, paddingTop, paddingBottom, paddingLeft, paddingRight } =
      rawStyle ?? {};

    const overlayCorrection = '2px';

    return {
      margin: {
        top: {
          height: marginTop,
          top: calculateWidth(`-${marginTop}`, 'rest', overlayCorrection)
        },
        bottom: {
          height: marginBottom,
          bottom: calculateWidth(`-${marginBottom}`, 'rest', overlayCorrection)
        },
        left: {
          width: marginLeft,
          left: calculateWidth(`-${marginLeft}`, 'rest', overlayCorrection)
        },
        right: {
          width: marginRight,
          right: calculateWidth(`-${marginRight}`, 'rest', overlayCorrection)
        }
      },
      padding: {
        top: { height: calculateWidth(paddingTop, 'rest', overlayCorrection) },
        bottom: { height: calculateWidth(paddingBottom, 'rest', overlayCorrection) },
        left: {
          width: calculateWidth(paddingLeft, 'rest', overlayCorrection),
          top: `calc(${paddingTop} - ${overlayCorrection})`,
          height: `calc(100% - ${paddingBottom} - ${paddingTop} + ${overlayCorrection} * 2)`
        },
        right: {
          width: calculateWidth(paddingRight, 'rest', overlayCorrection),
          top: `calc(${paddingTop} - ${overlayCorrection})`,
          height: `calc(100% - ${paddingBottom} - ${paddingTop} + ${overlayCorrection} * 2)`
        }
      }
    };
  }, [rawStyle, zoom]);

  return (
    <div className="overlay__spacing">
      <div className="margin--top" style={calculateSpacingMemo.margin.top} />
      <div className="margin--bottom" style={calculateSpacingMemo.margin.bottom} />
      <div className="margin--left" style={calculateSpacingMemo.margin.left} />
      <div className="margin--right" style={calculateSpacingMemo.margin.right} />

      <div className="padding--top" style={calculateSpacingMemo.padding.top} />
      <div className="padding--bottom" style={calculateSpacingMemo.padding.bottom} />
      <div className="padding--left" style={calculateSpacingMemo.padding.left} />
      <div className="padding--right" style={calculateSpacingMemo.padding.right} />

      {hoverRemove && hasItems && (
        <div className="overlay__delete-message-container" style={{ transform: `scale(${1 / zoom})` }}>
          <div className="overlay__delete-message">This element will be removed</div>
        </div>
      )}
    </div>
  );
};

export default OverlaySpacing;
