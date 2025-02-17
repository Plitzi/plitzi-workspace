/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import capitalize from 'lodash/capitalize';
import get from 'lodash/get';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import PluginManager from '../../../Element/PluginManager';
import RootElement from '../../../Element/RootElement';

import type { ElementLayoutType } from '../../../Element/PluginManager';
import type { BaseInternalProps, InternalProps } from '../../../types/ElementTypes';
import type { Element, Schema, Segment } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ReferenceProps = {
  ref: RefObject<HTMLElement>;
  children: ReactNode;
  className: string;
  internalProps: InternalProps;
  referenceType: ElementLayoutType;
  referenceId: string;
  referenceContainer: string;
};

const Reference = ({
  ref,
  children,
  className = '',
  internalProps = emptyObject as InternalProps,
  referenceType = 'element',
  referenceId = '',
  referenceContainer = ''
}: ReferenceProps) => {
  const {
    id,
    definition: { rootId, styleSelectors }
  } = internalProps;
  const {
    settings: { previewMode, environment },
    contexts: { SchemaContext, SegmentsContext }
  } = usePlitziServiceContext();
  const [reference, setReference] = useState<{
    element?: Element;
    elementType: string;
    referenceContextData: { schema: Schema; prevSchema?: Schema };
  }>();
  const { schema: mainSchema } = use(SchemaContext);
  const { segments, segmentGet } = use(SegmentsContext);

  const loadReference = useCallback(async () => {
    let element: Element | undefined;
    let referenceSchema: Schema | undefined;
    switch (referenceType) {
      case 'segment': {
        let segment = get(segments, referenceId) as Segment | undefined;
        if (!segment && referenceId) {
          segment = await segmentGet(referenceId);
        }

        if (!segment) {
          return;
        }

        const baseElementId = get(segment, 'definition.baseElementId') as string;
        referenceSchema = get(segment, 'schema');
        element = get(segment, `schema.flat.${baseElementId}`) as Element | undefined;

        break;
      }

      case 'element':
      default: {
        element = get(mainSchema, `flat.${referenceId}`);
        referenceSchema = mainSchema;
      }
    }

    if (!element) {
      return;
    }

    setReference({
      element,
      elementType: get(element, 'definition.type'),
      referenceContextData: { schema: referenceSchema, prevSchema: mainSchema }
    });
  }, [referenceType, mainSchema, segments, referenceId, segmentGet]);

  useEffect(() => {
    void loadReference();
  }, [loadReference]);

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

  const internalPropsMemo = useMemo<BaseInternalProps>(
    () => ({ id, className: styleSelectors.base }),
    [styleSelectors, id]
  );
  if (!reference) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={classNames('plitzi-component__reference', className, {
          'reference--build-mode': !previewMode
        })}
      >
        {!previewMode && <div className="reference__label">Element Reference {capitalize(referenceType)}</div>}
      </RootElement>
    );
  }

  const { element, elementType, referenceContextData } = reference;
  if (previewMode && element && referenceType === 'element') {
    return (
      <SchemaContext value={referenceContextData}>
        <PluginManager
          key={`${id}_${referenceId}`}
          id={element.id}
          rootId={rootId}
          type={elementType}
          internalProps={internalPropsMemo}
          plitziElementLayout={plitziElementLayoutMemo}
        />
      </SchemaContext>
    );
  }

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__reference', className, {
        'reference--build-mode': !previewMode
      })}
    >
      <SchemaContext value={referenceContextData}>
        {element && (
          <PluginManager
            key={`${id}_${referenceId}`}
            id={element.id}
            rootId={rootId}
            type={elementType}
            internalProps={internalPropsMemo}
            plitziElementLayout={plitziElementLayoutMemo}
          />
        )}
      </SchemaContext>
      {!previewMode && !element && (
        <div className="reference__label">Element Reference {capitalize(referenceType)}</div>
      )}
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
