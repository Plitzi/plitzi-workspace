// Packages
import React, { forwardRef, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
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

const Reference = forwardRef((props, ref) => {
  const {
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
  const { schema: mainSchema } = useContext(SchemaContext);
  const { segments, segmentGet } = useContext(SegmentsContext);
  const dataSourceContext = useContext(DataSourceContext);
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
      <SchemaContext.Provider value={referenceContextData}>
        <DataSourceContext.Provider value={referenceContextSource}>
          <PluginManager
            key={`${id}-${referenceId}`}
            id={element?.id}
            rootId={rootId}
            type={elementType}
            internalProps={internalPropsMemo}
            plitziElementLayout={plitziElementLayoutMemo}
          />
        </DataSourceContext.Provider>
      </SchemaContext.Provider>
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
      <SchemaContext.Provider value={referenceContextData}>
        <DataSourceContext.Provider value={referenceContextSource}>
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
        </DataSourceContext.Provider>
      </SchemaContext.Provider>
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
});

Reference.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  internalProps: PropTypes.object,
  referenceType: PropTypes.oneOf([PARTIAL_SCHEMA_TYPE_ELEMENT, PARTIAL_SCHEMA_TYPE_SEGMENT]),
  referenceId: PropTypes.string,
  referenceContainer: PropTypes.string
};

export default withElement(Reference);

export { Reference };
