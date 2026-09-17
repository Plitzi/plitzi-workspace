import { get } from '@plitzi/plitzi-ui/helpers';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo } from 'react';

import { resolveLayoutChain } from '@plitzi/sdk-shared/schema/layoutChain';
import { useCommonStore } from '@plitzi/sdk-shared/store';

export type LayoutPickerProps = {
  layout?: string;
  layoutContainer?: string;
  /** The layout being edited, when it is one: it cannot sit in itself, nor in a shell that already sits in it. */
  ownLayoutId?: string;
  onUpdate?: (key: string, value: string) => void;
};

/** Which shell something is rendered inside, and the container in that shell its content goes into. */
const LayoutPicker = ({ layout = '', layoutContainer = '', ownLayoutId, onUpdate }: LayoutPickerProps) => {
  const [flat] = useCommonStore('schema.flat');

  const layouts = useMemo(
    () =>
      Object.values(flat).filter(
        element =>
          get(element, 'definition.type', '') === 'layoutContainer' &&
          (!ownLayoutId ||
            !resolveLayoutChain(id => flat[id], element.id, '').some(link => link.layout === ownLayoutId))
      ),
    [flat, ownLayoutId]
  );

  const layoutContainers = useMemo(() => {
    if (!layout) {
      return [];
    }

    return Object.values(flat).filter(
      element => get(element, 'definition.type', '') === 'container' && get(element, 'definition.rootId', '') === layout
    );
  }, [flat, layout]);

  const handleChangeLayout = useCallback(
    (value: string) => {
      onUpdate?.('layout', value);
      onUpdate?.('layoutContainer', '');
    },
    [onUpdate]
  );

  const handleChangeLayoutContainer = useCallback((value: string) => onUpdate?.('layoutContainer', value), [onUpdate]);

  return (
    <>
      <Select value={layout} placeholder="None" label="Layout" onChange={handleChangeLayout} size="xs">
        {layouts.map(({ id, definition: { label } }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      {layout && (
        <Select
          value={layoutContainer}
          placeholder="None"
          label="Layout Container Body"
          onChange={handleChangeLayoutContainer}
          size="xs"
        >
          {layoutContainers.map(({ id, definition: { label } }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      )}
    </>
  );
};

export default LayoutPicker;
