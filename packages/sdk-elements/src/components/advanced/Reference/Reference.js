// Packages
import React, { useCallback, use, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import capitalize from 'lodash/capitalize';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import { PARTIAL_SCHEMA_TYPE_ELEMENT, PARTIAL_SCHEMA_TYPE_SEGMENT } from '../../../Element/ElementConstants';
import RootElement from '../../../Element/RootElement';
import withElement from '../../../Element/hocs/withElement';
import PluginManager from '../../../Element/PluginManager';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   children: React.ReactNode;
 *   className: string;
 *   internalProps: object;
 *   referenceType: string;
 *   referenceId: string;
 *   referenceContainer: string;
 * }} props
 * @returns {React.ReactElement}
 */
const Reference = props => {
  const {
    ref,
    children,
    className = '',
    internalProps = emptyObject,
    referenceType = PARTIAL_SCHEMA_TYPE_ELEMENT,
    referenceId = '',
    referenceContainer = ''
  } = props;
  const {
    id,
    definition: { rootId, styleSelectors }
  } = internalProps;
  const {
    settings: { previewMode, environment },
    contexts: { SchemaContext, SegmentsContext }
  } = usePlitziServiceContext();
  const [reference, setReference] = useState();
  const { schema: mainSchema } = use(SchemaContext);
  const { segments, segmentGet } = use(SegmentsContext);
  let refreshReference;
  if (!previewMode && referenceType === PARTIAL_SCHEMA_TYPE_SEGMENT && segments && referenceId) {
    refreshReference = segments[referenceId];
  } else {
    refreshReference = undefined;
  }

  const loadReference = useCallback(async () => {
    let element;
    let referenceSchema;
    switch (referenceType) {
      case PARTIAL_SCHEMA_TYPE_SEGMENT: {
        let segment = get(segments, referenceId);
        if (!segment && referenceId) {
          segment = await segmentGet(referenceId);
        }

        const baseElementId = get(segment, 'definition.baseElementId');
        referenceSchema = get(segment, 'schema');
        element = get(segment, `schema.flat.${baseElementId}`);

        break;
      }

      case PARTIAL_SCHEMA_TYPE_ELEMENT:
      default: {
        element = get(mainSchema, `flat.${referenceId}`);
        referenceSchema = mainSchema;
      }
    }

    setReference({
      element,
      elementType: get(element, 'definition.type'),
      referenceContextData: { schema: referenceSchema, prevSchema: mainSchema }
    });
  }, [referenceType, referenceId, segmentGet, refreshReference, mainSchema]);

  useEffect(() => {
    loadReference();
  }, [loadReference]);

  const plitziElementLayoutMemo = useMemo(
    () => ({
      bodyChildren: children,
      containerId: referenceContainer,
      type: referenceType,
      referenceId: id,
      rootId: id
    }),
    [referenceContainer, children, referenceType, referenceId, id]
  );

  const internalPropsMemo = useMemo(() => ({ className: styleSelectors?.base }), [internalProps, styleSelectors]);
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
  if (previewMode && element && referenceType === PARTIAL_SCHEMA_TYPE_ELEMENT) {
    return (
      <SchemaContext value={referenceContextData}>
        <PluginManager
          key={`${id}_${referenceId}`}
          id={element?.id}
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
            id={element?.id}
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
      {previewMode && !element && referenceType === PARTIAL_SCHEMA_TYPE_SEGMENT && (
        <div>
          Segment <b>{referenceId}</b> not found, publish to <b>{environment}</b> environment
        </div>
      )}
    </RootElement>
  );
};

export default withElement(Reference);

export { Reference };
