/* eslint-disable react-refresh/only-export-components */

import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, use, useEffect, useMemo, useState, useRef } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { createStoreHook, StoreProvider } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import PluginManager from '../../../Element/PluginManager';
import RootElement from '../../../Element/RootElement';

import type { Element, Schema, Segment, ElementLayoutType, CommonState } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ReferenceProps = {
  ref: RefObject<HTMLElement>;
  children: ReactNode;
  className: string;
  referenceType: ElementLayoutType;
  referenceId: string;
  referenceContainer: string;
};

const Reference = ({
  ref,
  children,
  className = '',
  referenceType = 'element',
  referenceId = '',
  referenceContainer = ''
}: ReferenceProps) => {
  const {
    id,
    definition: { rootId, styleSelectors }
  } = useElement();
  const {
    settings: { previewMode, environment },
    contexts: { SegmentsContext }
  } = usePlitziServiceContext();
  const { useStore } = createStoreHook<CommonState>();
  const [mainSchema] = useStore('schema');
  const { segments, segmentGet } = use(SegmentsContext);

  const schemaRef = useRef(mainSchema);
  schemaRef.current = mainSchema;

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const getReference = useCallback((referenceId: string, referenceType: ElementLayoutType) => {
    let element: Element;
    let referenceSchema: Schema | undefined;
    switch (referenceType) {
      case 'segment': {
        const segment = get(segmentsRef.current, referenceId) as Segment | undefined;
        if (!segment) {
          return undefined;
        }

        const baseElementId = get(segment, 'definition.baseElementId');
        referenceSchema = get(segment, 'schema');
        element = get(segment, `schema.flat.${baseElementId}`);

        break;
      }

      case 'element':
      default: {
        element = get(schemaRef.current, `flat.${referenceId}`);
        referenceSchema = schemaRef.current;
      }
    }

    if (!(element as Element | undefined)) {
      return undefined;
    }

    return {
      element,
      elementType: get(element, 'definition.type'),
      referenceContextData: { schema: referenceSchema, prevSchema: schemaRef.current }
    };
  }, []);

  const [reference, setReference] = useState<
    | { element?: Element; elementType: string; referenceContextData: { schema: Schema; prevSchema?: Schema } }
    | undefined
  >(getReference(referenceId, referenceType));

  const loadReference = useCallback(
    async (referenceId: string, referenceType: ElementLayoutType) => {
      const data = getReference(referenceId, referenceType);
      if (data) {
        setReference(data);

        return;
      }

      let element: Element;
      let referenceSchema: Schema | undefined;
      switch (referenceType) {
        case 'segment': {
          let segment: Segment | undefined;
          if (referenceId) {
            segment = await segmentGet(referenceId);
          }

          if (!segment) {
            return;
          }

          const baseElementId = get(segment, 'definition.baseElementId');
          referenceSchema = get(segment, 'schema');
          element = get(segment, `schema.flat.${baseElementId}`);

          break;
        }

        case 'element':
        default: {
          element = get(schemaRef.current, `flat.${referenceId}`);
          referenceSchema = schemaRef.current;
        }
      }

      if (!(element as Element | undefined)) {
        setReference(undefined);

        return;
      }

      setReference({
        element,
        elementType: get(element, 'definition.type'),
        referenceContextData: { schema: referenceSchema, prevSchema: schemaRef.current }
      });
    },
    [getReference, segmentGet]
  );

  useEffect(() => {
    void loadReference(referenceId, referenceType);
  }, [loadReference, referenceId, referenceType]);

  const plitziElementLayoutMemo = useMemo(
    () => ({
      bodyChildren: children,
      containerId: referenceContainer,
      type: referenceType,
      referenceId: id,
      rootId: id
    }),
    [referenceContainer, children, referenceType, id]
  );

  const internalPropsMemo = useMemo(
    () => ({ id: reference?.element?.id ?? '', rootId: rootId, className: styleSelectors.base }),
    [reference?.element?.id, rootId, styleSelectors.base]
  );

  if (!reference) {
    return (
      <RootElement
        ref={ref}
        className={clsx('plitzi-component__reference', className, {
          'reference--build-mode': !previewMode
        })}
      >
        {!previewMode && (
          <div className="reference__label">
            Element Reference <b className="capitalize">{referenceType}</b>
          </div>
        )}
      </RootElement>
    );
  }

  const { element, elementType, referenceContextData } = reference;
  if (previewMode && element && referenceType === 'element') {
    return (
      <StoreProvider value={referenceContextData}>
        <PluginManager
          key={`${id}_${referenceId}`}
          type={elementType}
          internalProps={internalPropsMemo}
          plitziElementLayout={plitziElementLayoutMemo}
        />
      </StoreProvider>
    );
  }

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__reference', className, {
        'reference--build-mode': !previewMode
      })}
    >
      <StoreProvider value={referenceContextData}>
        {element && (
          <PluginManager
            key={`${id}_${referenceId}`}
            type={elementType}
            internalProps={internalPropsMemo}
            plitziElementLayout={plitziElementLayoutMemo}
          />
        )}
      </StoreProvider>
      {!previewMode && !element && <div className="reference__label">Element Reference {referenceType}</div>}
      {previewMode && !element && referenceType === 'segment' && (
        <div>
          Segment <b>{referenceId}</b> not found, publish to <b>{environment}</b> environment
        </div>
      )}
    </RootElement>
  );
};

export default withElement(Reference);

export { Reference };
