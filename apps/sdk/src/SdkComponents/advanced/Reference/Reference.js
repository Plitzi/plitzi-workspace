// Packages
import React, { useCallback, use, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import capitalize from 'lodash/capitalize';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';
import PluginManager from '@modules/Element/PluginManager';
import { PARTIAL_SCHEMA_TYPE_ELEMENT, PARTIAL_SCHEMA_TYPE_SEGMENT } from '@modules/Element/ElementConstants';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

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
    contexts: { SchemaContext, SegmentsContext, DataSourceContext }
  } = usePlitziServiceContext();
  const [reference, setReference] = useState();
  const [dsManagerChild, setDsManagerChild] = useState();
  const { schema: mainSchema } = use(SchemaContext);
  const { segments, segmentGet } = use(SegmentsContext);
  const dataSourceContext = use(DataSourceContext);
  const dsManager = get(dataSourceContext, 'dataSourceManager');
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
    setDsManagerChild(dataSourceContext.dataSourceManager.createChildManager(id, referenceSchema));
  }, [referenceType, referenceId, segmentGet, refreshReference, mainSchema]);

  useEffect(() => {
    return () => {
      dsManager.removeChildManager(dsManagerChild);
    };
  }, [dsManagerChild]);

  const referenceContextSource = useMemo(
    () => ({ ...dataSourceContext, dataSourceManager: dsManagerChild }),
    [dataSourceContext, dsManagerChild]
  );

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
        <DataSourceContext value={referenceContextSource}>
          <PluginManager
            key={`${id}-${referenceId}`}
            id={element?.id}
            rootId={rootId}
            type={elementType}
            internalProps={internalPropsMemo}
            plitziElementLayout={plitziElementLayoutMemo}
          />
        </DataSourceContext>
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
        <DataSourceContext value={referenceContextSource}>
          {element && (
            <PluginManager
              key={`${id}-${referenceId}`}
              id={element?.id}
              rootId={rootId}
              type={elementType}
              internalProps={internalPropsMemo}
              plitziElementLayout={plitziElementLayoutMemo}
            />
          )}
        </DataSourceContext>
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
