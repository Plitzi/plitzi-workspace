import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback, useMemo } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';

import PropField from './PropField';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { SpaceComponent } from '@plitzi/sdk-shared';

type SettingsProps = {
  referenceType?: 'element' | 'component';
  referenceId?: string;
  onUpdate?: (key: string, value: string | number | boolean | object) => void;
  /** An instance's props arrive here as the attributes they are. */
  [prop: string]: unknown;
};

const TYPE_OPTIONS = [
  { value: 'element', label: 'Element' },
  { value: 'component', label: 'Component' }
];

type ComponentPropsProps = {
  component: SpaceComponent;
  values: Record<string, unknown>;
  onUpdate?: SettingsProps['onUpdate'];
};

/** Each prop the placed component declares, with what this instance hands in for it. */
const ComponentProps = ({ component, values, onUpdate }: ComponentPropsProps) => (
  <div className="flex flex-col gap-2">
    {Object.entries(component.props ?? {}).map(([name, prop]) => (
      <PropField key={name} name={name} prop={prop} value={values[name]} onUpdate={onUpdate} />
    ))}
  </div>
);

const Settings = ({ referenceType = 'element', referenceId = '', onUpdate, ...values }: SettingsProps) => {
  const [[flat, components]] = useCommonStore(['schema.flat', 'schema.components']);

  const handleChangeType = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      onUpdate?.('referenceType', option?.value ?? 'element');
      onUpdate?.('referenceId', '');
    },
    [onUpdate]
  );

  const handleChangeReference = useCallback(
    (option?: Exclude<Option, OptionGroup>) => onUpdate?.('referenceId', option?.value ?? ''),
    [onUpdate]
  );

  const options = useMemo(() => {
    if (referenceType === 'component') {
      return Object.values(components).map<Option>(component => ({
        value: component.id,
        label: component.label ?? component.id
      }));
    }

    return Object.values(flat).map<Option>(element => ({ value: element.id, label: element.definition.label }));
  }, [referenceType, components, flat]);

  const component: SpaceComponent | undefined =
    referenceType === 'component' && Object.hasOwn(components, referenceId) ? components[referenceId] : undefined;

  return (
    <div className="flex h-full flex-col gap-2 py-2">
      <Select2 value={referenceType} label="Reference Type" onChange={handleChangeType} options={TYPE_OPTIONS} />
      <Select2
        value={referenceId}
        label={referenceType === 'component' ? 'Component' : 'Element'}
        onChange={handleChangeReference}
        placeholder="Search..."
        options={options}
      />
      {component && <ComponentProps component={component} values={values} onUpdate={onUpdate} />}
    </div>
  );
};

export default Settings;
