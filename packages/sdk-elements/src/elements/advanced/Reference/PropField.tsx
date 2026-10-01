import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select2 from '@plitzi/plitzi-ui/Select2';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useMemo } from 'react';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ComponentProp } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type PropFieldProps = {
  name: string;
  prop: ComponentProp;
  value: unknown;
  onUpdate?: (key: string, value: string | number | boolean | object) => void;
};

/** The label a prop is shown under: what it declares, else its name. A required one says so. */
const labelOf = (name: string, prop: ComponentProp): string => `${prop.label ?? name}${prop.required ? ' *' : ''}`;

/** A value as the text box shows it: a template or a word as it is, anything else as JSON. */
const asText = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
};

/** What was typed into a `json` prop: the value it spells, or the text itself while it spells none — a template. */
const fromJson = (text: string): string | number | boolean | object => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
      return parsed;
    }

    return typeof parsed === 'object' && parsed !== null ? parsed : text;
  } catch {
    return text;
  }
};

const BooleanField = ({ name, prop, value, onUpdate }: PropFieldProps) => {
  const handleChange = useCallback(
    (event: ChangeEvent) => onUpdate?.(name, (event.target as HTMLInputElement).checked),
    [name, onUpdate]
  );

  return <Checkbox checked={value === true} onChange={handleChange} label={labelOf(name, prop)} size="xs" />;
};

const SelectField = ({ name, prop, value, onUpdate }: PropFieldProps) => {
  const options = useMemo(
    () => (prop.options ?? []).map(option => ({ value: option, label: prop.optionLabels?.[option] ?? option })),
    [prop.options, prop.optionLabels]
  );
  const handleChange = useCallback(
    (option?: Exclude<Option, OptionGroup>) => onUpdate?.(name, option?.value ?? ''),
    [name, onUpdate]
  );

  return (
    <Select2
      value={asText(value)}
      label={labelOf(name, prop)}
      onChange={handleChange}
      placeholder="None"
      options={options}
    />
  );
};

const JsonField = ({ name, prop, value, onUpdate }: PropFieldProps) => {
  const handleChange = useCallback((text: string) => onUpdate?.(name, fromJson(text)), [name, onUpdate]);

  return <TextArea value={asText(value)} label={labelOf(name, prop)} onChange={handleChange} size="xs" />;
};

const TextField = ({ name, prop, value, onUpdate }: PropFieldProps) => {
  const handleChange = useCallback(
    (text: string) =>
      onUpdate?.(
        name,
        prop.type === 'number' && text.trim() !== '' && !Number.isNaN(Number(text)) ? Number(text) : text
      ),
    [name, onUpdate, prop.type]
  );

  if (prop.type === 'textarea') {
    return <TextArea value={asText(value)} label={labelOf(name, prop)} onChange={handleChange} size="xs" />;
  }

  return <Input value={asText(value)} label={labelOf(name, prop)} onChange={handleChange} size="xs" />;
};

/**
 * One prop of an instance, with the control its declared type asks for. A text box takes a template as readily as a
 * value — `{{ item.name }}` — which is how an instance hands in what is around it.
 */
const PropField = (props: PropFieldProps) => {
  const { prop } = props;

  if (prop.type === 'boolean') {
    return <BooleanField {...props} />;
  }

  if (prop.type === 'select') {
    return <SelectField {...props} />;
  }

  if (prop.type === 'json') {
    return <JsonField {...props} />;
  }

  return <TextField {...props} />;
};

export default PropField;
