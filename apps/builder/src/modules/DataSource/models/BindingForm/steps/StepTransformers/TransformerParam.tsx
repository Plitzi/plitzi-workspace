import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Input from '@plitzi/plitzi-ui/Input';
import Select2 from '@plitzi/plitzi-ui/Select2';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import upperFirst from 'lodash/upperFirst';
import { useCallback, useMemo } from 'react';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { DataSourceUtilityParamType, SourceField } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type TransformerParamProps = {
  id?: string;
  value?: string | number | boolean;
  label?: string;
  type?: DataSourceUtilityParamType;
  index: number;
  options?: Option[] | Promise<Option[]>;
  dataSourceFields?: Record<string, SourceField[]>;
  onChange?: (index: number, id: string, value: string | number | boolean) => void;
};

const TransformerParam = ({
  label: labelProp = '',
  id = '',
  value = '',
  type = 'text',
  index,
  options,
  dataSourceFields,
  onChange
}: TransformerParamProps) => {
  const handleChangeText = useCallback((value: string) => onChange?.(index, id, value), [onChange, index, id]);

  const handleChangeCheck = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange?.(index, id, e.target.checked),
    [onChange, index, id]
  );

  const handleChangeSelect = useCallback(
    (option?: Exclude<Option, OptionGroup>) => onChange?.(index, id, option?.value ?? ''),
    [onChange, index, id]
  );

  const label = useMemo(() => (!labelProp ? upperFirst(id) : labelProp), [labelProp, id]);

  const fieldsDataSource = useMemo<AutoComplete[]>(() => {
    if (!dataSourceFields) {
      return ['source'];
    }

    return [
      ...Object.keys(dataSourceFields).reduce<AutoComplete[]>(
        (acum1, source) => [
          ...acum1,
          ...dataSourceFields[source].reduce<AutoComplete[]>(
            (acum2, field) => [...acum2, { type: 'token', value: `${source}.${field.path}` }],
            []
          )
        ],
        []
      ),
      { type: 'token', value: 'source' },
      { type: 'token', value: 'sourceTo' }
    ];
  }, [dataSourceFields]);

  return (
    <div className="flex w-full">
      {type === 'text' && (
        <Input className="w-full" size="xs" label={label} id={id} value={value as string} onChange={handleChangeText} />
      )}
      {type === 'select' && (
        <Select2
          size="xs"
          id={id}
          placeholder={`Select a ${label}`}
          label={label}
          value={value as string}
          onChange={handleChangeSelect}
          options={options}
        />
      )}
      {type === 'textarea' && (
        <TextArea
          className="w-full"
          size="xs"
          id={id}
          label={label}
          value={value as string}
          onChange={handleChangeText}
        />
      )}
      {type === 'checkbox' && (
        <Checkbox
          size="xs"
          id={id}
          label={label ? label : (value as string)}
          onChange={handleChangeCheck}
          checked={value as boolean}
        />
      )}
      {type === 'codemirror-text' && (
        <CodeMirror
          size="xs"
          id={id}
          value={value as string}
          label={label}
          theme="light"
          mode="text"
          autoComplete={fieldsDataSource}
          lineWrapping
          onChange={handleChangeText}
        />
      )}
    </div>
  );
};

export default TransformerParam;
