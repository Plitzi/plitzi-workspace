import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Input from '@plitzi/plitzi-ui/Input';
import Select2 from '@plitzi/plitzi-ui/Select2';
import Switch from '@plitzi/plitzi-ui/Switch';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import clsx from 'clsx';
import upperFirst from 'lodash-es/upperFirst';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import ParamBinding from './ParamBinding';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ElementInteraction, InteractionParamType } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type NodeBodyParamProps = {
  className?: string;
  nodeId?: string;
  id: keyof ElementInteraction;
  label?: string;
  value?: string | boolean | number;
  type?: InteractionParamType | ((params: Record<string, unknown>) => InteractionParamType);
  options?: Option[] | ((params: Record<string, unknown>) => Option[]);
  canBind?: boolean;
  params?: Record<string, unknown>;
  fields: Record<string, { name: string; label: string; placeholder: string; group: string }>;
  onChange?: (id: keyof ElementInteraction, value: string | boolean | number) => void;
};

const NodeBodyParam = ({
  className = '',
  nodeId = '',
  id,
  label = '',
  value = '',
  type: typeProp = 'text',
  options: optionsProp,
  canBind = true,
  params = emptyObject,
  fields,
  onChange
}: NodeBodyParamProps) => {
  const type = useMemo(() => (typeof typeProp === 'function' ? typeProp(params) : typeProp), [params, typeProp]);
  const options = useMemo(
    () => (type === 'select' && typeof optionsProp === 'function' ? optionsProp(params) : optionsProp),
    [optionsProp, params, type]
  );
  const [isBinding, setIsBinding] = useState(() => canBind && typeof value === 'string' && isValidToken(value, true));
  const [internalOptions, setInternalOptions] = useState<Option[]>([]);

  const handleChangeInput = useCallback((value?: string) => onChange?.(id, value ?? ''), [id, onChange]);

  const handleChangeSwitch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange?.(id, e.target.checked),
    [id, onChange]
  );

  const handleChangeSelect = useCallback(
    (option?: Exclude<Option, OptionGroup>) => onChange?.(id, option?.value ?? ''),
    [onChange, id]
  );

  const handleClickBind = useCallback(() => {
    onChange?.(id, '');
    setIsBinding(state => !state);
  }, [id, onChange]);

  const processOptions = useCallback(
    (options: Option[] | ((params: Record<string, unknown>) => Option[]) = [], params: Record<string, unknown>) => {
      const optionsAux: Option[] = [];
      if (typeof options === 'function') {
        const opts = options(params);
        if (Array.isArray(opts)) {
          optionsAux.push(...opts);
        }
      } else if (Array.isArray(options)) {
        optionsAux.push(...options);
      }

      setInternalOptions(optionsAux);
    },
    []
  );

  useEffect(() => {
    processOptions(options, params);
  }, [options, params, processOptions]);

  const finalLabel = useMemo(() => (!label ? upperFirst(id) : label), [label, id]);
  const fieldsKeys = useMemo<AutoComplete[]>(
    () =>
      Object.values(fields).reduce<AutoComplete[]>(
        (acum, field) => [...acum, { type: 'token', value: field.name }],
        []
      ),
    [fields]
  );

  return (
    <div className={clsx('flex w-full flex-col not-first:mt-2', className)}>
      {isBinding && (
        <label htmlFor={id} className="text-xs">
          {finalLabel}
        </label>
      )}
      <div className="flex grow basis-0">
        {!isBinding && type === 'text' && (
          <Input
            className="w-full"
            size="xs"
            label={finalLabel}
            id={id}
            value={value as string}
            onChange={handleChangeInput}
          />
        )}
        {!isBinding && type === 'select' && (
          <Select2
            size="xs"
            label={finalLabel}
            placeholder={`Select a ${finalLabel}`}
            value={value as string}
            onChange={handleChangeSelect}
            options={internalOptions}
            allowCreateOptions
          />
        )}
        {!isBinding && type === 'boolean' && (
          <div className="flex w-full items-center">
            <Switch size="xs" label={finalLabel} checked={value as boolean} onChange={handleChangeSwitch} />
          </div>
        )}
        {!isBinding && type === 'textarea' && (
          <TextArea
            label={finalLabel}
            className="w-full"
            size="xs"
            value={value as string}
            onChange={handleChangeInput}
          />
        )}
        {!isBinding && type === 'codemirror-json' && (
          <CodeMirror
            label={finalLabel}
            className="min-h-20"
            value={value as string}
            theme="light"
            mode="json"
            autoComplete={fieldsKeys}
            lineWrapping
            onChange={handleChangeInput}
          />
        )}
        {!isBinding && type === 'codemirror-text' && (
          <CodeMirror
            label={finalLabel}
            className="min-h-20"
            value={value as string}
            theme="light"
            mode="text"
            autoComplete={fieldsKeys}
            lineWrapping
            onChange={handleChangeInput}
          />
        )}
        {isBinding && <ParamBinding nodeId={nodeId} id={id} onChange={onChange} value={value as string} />}
        {canBind && (
          <Button size="sm" className="ml-2 w-8 rounded-sm" onClick={handleClickBind}>
            {!isBinding && <i className="fa-solid fa-plug" />}
            {isBinding && <i className="fa-solid fa-plug-circle-xmark" />}
          </Button>
        )}
      </div>
    </div>
  );
};

export default NodeBodyParam;
