// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { usePlitziServiceContext } from '@plitzi/plitzi-sdk';
import noop from 'lodash/noop';
import get from 'lodash/get';
import Select2 from '@plitzi/plitzi-ui-components/Select2';

const REFERENCE_TYPE_ELEMENT = 'element';
const REFERENCE_TYPE_SEGMENT = 'segment';

const Settings = props => {
  const { referenceType = REFERENCE_TYPE_ELEMENT, referenceId = '', referenceContainer = '', onUpdate = noop } = props;
  const {
    contexts: { SchemaContext, SegmentsContext }
  } = usePlitziServiceContext();
  const { schema } = useContext(SchemaContext);
  const { segments, segmentGet, segmentsFetch } = useContext(SegmentsContext);

  const handleChangeReferenceType = useCallback(
    option => {
      onUpdate('referenceType', option?.value ?? '');
      onUpdate('referenceId', '');
      onUpdate('referenceContainer', '');
    },
    [onUpdate]
  );

  const handleChangeReferenceID = useCallback(
    option => {
      onUpdate('referenceId', option?.value ?? '');
      onUpdate('referenceContainer', '');
      if (option?.value && referenceType === REFERENCE_TYPE_SEGMENT) {
        segmentGet(option.value);
      }
    },
    [onUpdate, segmentGet]
  );

  const handleChangeReferenceContainer = useCallback(
    option => onUpdate('referenceContainer', option?.value ?? ''),
    [onUpdate, segmentGet]
  );

  const typeOptions = useMemo(
    () => [
      { value: REFERENCE_TYPE_ELEMENT, label: 'Element' },
      { value: REFERENCE_TYPE_SEGMENT, label: 'Segment' }
    ],
    []
  );

  const referenceSchema = useMemo(() => {
    switch (referenceType) {
      case REFERENCE_TYPE_SEGMENT: {
        return get(segments, `${referenceId}.schema`);
      }

      case REFERENCE_TYPE_ELEMENT:
      default: {
        return schema;
      }
    }
  }, [referenceType, segments, referenceId, schema]);

  const elements = useMemo(() => {
    switch (referenceType) {
      case REFERENCE_TYPE_ELEMENT:
        return Object.values(referenceSchema.flat).reduce(
          (acum, element) => [...acum, { value: element.id, label: get(element, 'definition.label') }],
          []
        );

      case REFERENCE_TYPE_SEGMENT:
        return new Promise(async resolve => {
          const response = await segmentsFetch();
          const segments = get(response, 'edges', []);
          resolve(
            segments.map(segment => ({ value: segment.identifier, label: get(segment, 'definition.name', segment.id) }))
          );
        });

      default:
        return [];
    }
  }, [referenceSchema?.flat, referenceType, segmentsFetch]);

  const referenceContainers = useMemo(() => {
    if (!referenceId) {
      return [];
    }

    switch (referenceType) {
      case REFERENCE_TYPE_SEGMENT: {
        const segment = get(segments, referenceId);
        const baseElementId = get(segment, 'definition.baseElementId');
        if (!referenceSchema?.flat) {
          return [];
        }

        return Object.values(referenceSchema.flat)
          .filter(
            element =>
              get(element, 'definition.type', '') === 'container' &&
              get(element, 'definition.rootId', '') === baseElementId &&
              Array.isArray(get(element, 'definition.items')) &&
              get(element, 'definition.items').length === 0
          )
          .map(container => ({ value: container.id, label: get(container, 'definition.label') }));
      }

      case REFERENCE_TYPE_ELEMENT:
      default: {
        return [];
      }
    }
  }, [referenceSchema?.flat, referenceId]);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Reference Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Reference Type</label>
          <Select2
            value={referenceType}
            onChange={handleChangeReferenceType}
            placeholder="Search..."
            className="rounded"
            options={typeOptions}
          />
        </div>
        <div className="flex flex-col mt-4">
          <label>Reference ID</label>
          <Select2
            value={referenceId}
            onChange={handleChangeReferenceID}
            placeholder="Search..."
            className="rounded"
            options={elements}
          />
        </div>
        {referenceType === REFERENCE_TYPE_SEGMENT && (
          <div className="flex flex-col mt-4">
            <label>Reference Container</label>
            <Select2
              value={referenceContainer}
              placeholder="None"
              onChange={handleChangeReferenceContainer}
              className="rounded"
              options={referenceContainers}
            />
          </div>
        )}
      </div>
    </div>
  );
};

Settings.propTypes = {
  referenceType: PropTypes.oneOf([REFERENCE_TYPE_ELEMENT, REFERENCE_TYPE_SEGMENT, '']),
  referenceId: PropTypes.string,
  referenceContainer: PropTypes.string,
  onUpdate: PropTypes.func
};

export default Settings;
