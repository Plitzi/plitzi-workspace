import type { ComponentProp } from '@plitzi/sdk-shared';

/** The kinds a prop can be, as the kind picker lists them. */
export const TYPES: { value: ComponentProp['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'select', label: 'One of' },
  { value: 'json', label: 'Data' }
];

export const isPropType = (value: string): value is ComponentProp['type'] => TYPES.some(type => type.value === value);
