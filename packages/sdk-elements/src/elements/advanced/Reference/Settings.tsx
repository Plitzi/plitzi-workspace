import { get } from '@plitzi/plitzi-ui/helpers';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback, use, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { CommonState, Element, Schema, Segment, SegmentsContextValue } from '@plitzi/sdk-shared';

type SettingsProps = {
  referenceType?: 'element' | 'segment' | '';
  referenceId?: string;
  referenceContainer?: string;
  onUpdate?: (key: string, value: string | number | boolean) => void;
};

const Settings = ({
  referenceType = 'element',
  referenceId = '',
  referenceContainer = '',
  onUpdate
}: SettingsProps) => {
  const {
    contexts: { SegmentsContext }
  } = usePlitziServiceContext();
  const { useStore } = createStoreHook<CommonState>();
  const [[schema, segments]] = useStore(['schema', 'segments']);
  const { segmentGet, segmentsFetch } = use(SegmentsContext) as SegmentsContextValue<'builder'>;

  const handleChangeReferenceType = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      onUpdate?.('referenceType', option?.value ?? '');
      onUpdate?.('referenceId', '');
      onUpdate?.('referenceContainer', '');
    },
    [onUpdate]
  );

  const handleChangeReferenceID = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      onUpdate?.('referenceId', option?.value ?? '');
      onUpdate?.('referenceContainer', '');
      if (option?.value && referenceType === 'segment') {
        void segmentGet(option.value);
      }
    },
    [onUpdate, referenceType, segmentGet]
  );

  const handleChangeReferenceContainer = useCallback(
    (option?: Exclude<Option, OptionGroup>) => onUpdate?.('referenceContainer', option?.value ?? ''),
    [onUpdate]
  );

  const typeOptions = useMemo(
    () => [
      { value: 'element', label: 'Element' },
      { value: 'segment', label: 'Segment' }
    ],
    []
  );

  const referenceSchema = useMemo(() => {
    switch (referenceType) {
      case 'segment': {
        return get(segments, `${referenceId}.schema`, undefined);
      }

      case 'element':
      default: {
        return schema;
      }
    }
  }, [referenceType, segments, referenceId, schema]);

  const elements = useMemo(() => {
    switch (referenceType) {
      case 'element':
        return Object.values((referenceSchema as Schema).flat).reduce<Option[]>(
          (acum, element) => [...acum, { value: element.id, label: get(element, 'definition.label') }],
          []
        );

      case 'segment':
        return new Promise<Option[]>(resolve => {
          void segmentsFetch().then(response => {
            const segments = get(response, 'edges', []).map<Option>((segment: Segment) => ({
              value: segment.identifier,
              label: get(segment, 'definition.name', segment.id)
            }));
            resolve(segments);
          });
        });

      default:
        return [];
    }
  }, [referenceSchema, referenceType, segmentsFetch]);

  const referenceContainers = useMemo(() => {
    if (!referenceId) {
      return [];
    }

    switch (referenceType) {
      case 'segment': {
        const segment = get(segments, referenceId);
        const baseElementId = get(segment, 'definition.baseElementId');
        if (!referenceSchema?.flat) {
          return [];
        }

        return Object.values(referenceSchema.flat)
          .filter(
            (element: Element) =>
              get(element, 'definition.type', '') === 'container' &&
              get(element, 'definition.rootId', '') === baseElementId &&
              Array.isArray(get(element, 'definition.items')) &&
              get(element, 'definition.items', []).length === 0
          )
          .map(container => ({ value: container.id, label: get(container, 'definition.label') }));
      }

      case 'element':
      default: {
        return [];
      }
    }
  }, [referenceId, referenceType, segments, referenceSchema?.flat]);

  return (
    <div className="flex h-full flex-col py-2">
      <Select2
        value={referenceType}
        onChange={handleChangeReferenceType}
        placeholder="Search..."
        label="Reference Type"
        options={typeOptions}
      />
      <Select2
        value={referenceId}
        label="Reference ID"
        onChange={handleChangeReferenceID}
        placeholder="Search..."
        options={elements}
      />
      {referenceType === 'segment' && (
        <Select2
          value={referenceContainer}
          label="Reference Container"
          placeholder="None"
          onChange={handleChangeReferenceContainer}
          options={referenceContainers}
        />
      )}
    </div>
  );
};

export default Settings;
