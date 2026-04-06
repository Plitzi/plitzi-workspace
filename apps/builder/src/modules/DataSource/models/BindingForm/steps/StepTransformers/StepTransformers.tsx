import Button from '@plitzi/plitzi-ui/Button';
import Form, { useFormContext, useFormWatch } from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import { get, set } from '@plitzi/plitzi-ui/helpers';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { produce } from 'immer';
import { useCallback, useMemo, useRef } from 'react';

import utility, { utilityOptions } from '@plitzi/sdk-data-source/utility';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import TransformerParam from './TransformerParam';

import type { BindingSchema } from '../../BindingForm';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { BuilderState, DataSourceUtilityParams, DisplayMode, SourceField } from '@plitzi/sdk-shared';

export type StepTransformersProps = {
  dataSourceFields?: Record<string, SourceField[]>;
};

const StepTransformers = ({ dataSourceFields }: StepTransformersProps) => {
  const form = useFormContext<BindingSchema>();
  const { control, setValue } = form;
  const watchTransformers = useFormWatch(form, 'transformers');
  const watchTransformersRef = useRef(watchTransformers);
  watchTransformersRef.current = watchTransformers;
  const { useStore } = createStoreHook<BuilderState>();
  const [stylePlatform] = useStore('style.platform');
  const styleSelectors = useMemo(() => {
    return (Object.keys(stylePlatform) as DisplayMode[]).map(displayMode => ({
      label: displayMode,
      options: Object.values(stylePlatform[displayMode])
        .filter(selector => selector.type === 'class')
        .map(selector => ({ label: selector.name, value: selector.name }))
    }));
  }, [stylePlatform]);

  const handleClickAdd = useCallback(
    () => setValue('transformers', [...watchTransformers, { type: 'utility', action: '', params: {} }]),
    [setValue, watchTransformers]
  );

  const handleClickRemove = useCallback(
    (index: number) => () => {
      setValue(
        'transformers',
        produce(watchTransformers, draft => {
          draft.splice(index, 1);
        })
      );
    },
    [setValue, watchTransformers]
  );

  const handleChangeTransformerAction = useCallback(
    (index: number) => (option?: Exclude<Option, OptionGroup>) => {
      const paramDefinitions = get(utility, `${option?.value}.params`, {}) as DataSourceUtilityParams;
      const params = Object.keys(paramDefinitions).reduce(
        (acum, paramKey) => ({ ...acum, [paramKey]: paramDefinitions[paramKey].defaultValue }),
        {}
      );

      setValue(
        'transformers',
        produce(watchTransformers, draft => {
          set(draft, `${index}.action`, option?.value ?? '');
          set(draft, `${index}.params`, params);
        })
      );
    },
    [setValue, watchTransformers]
  );

  const handleChangeParam = useCallback(
    (index: number, id: string, paramValue: unknown) => {
      setValue(
        'transformers',
        produce(watchTransformersRef.current, draft => {
          set(draft, `${index}.params.${id}`, paramValue);
        })
      );
    },
    [setValue]
  );

  return (
    <Form.Custom
      name="transformers"
      control={control}
      render={({ field: { ref, value } }) => (
        <div className="flex flex-col gap-4" ref={ref}>
          <Heading as="h5">Transformers</Heading>
          <div className="flex flex-col gap-4">
            {value.map((transformer, i: number) => {
              const { action, params } = transformer;
              const paramDefinitions = get(utility, `${action}.params`, {}) as DataSourceUtilityParams;

              return (
                <div key={i} className="flex flex-col gap-4 rounded-sm border border-gray-300 p-2">
                  <div className="flex items-center gap-4">
                    <Select2
                      size="xs"
                      placeholder="Select a Transformer"
                      value={action}
                      onChange={handleChangeTransformerAction(i)}
                      options={utilityOptions}
                    />
                    <Button intent="danger" size="xs" onClick={handleClickRemove(i)} title="Remove">
                      <Button.Icon icon="fas fa-trash-alt" />
                    </Button>
                  </div>
                  {Object.keys(paramDefinitions).map(paramKey => {
                    const { label, description, type, defaultValue, options, disabled } = paramDefinitions[paramKey];
                    const paramValue = get(
                      params as Record<string, string | number | boolean | undefined>,
                      paramKey,
                      defaultValue
                    );

                    return (
                      <TransformerParam
                        key={paramKey}
                        id={paramKey}
                        type={typeof type === 'function' ? type(params) : type}
                        label={label}
                        description={description}
                        value={paramValue}
                        index={i}
                        options={action === 'styleSelector' && paramKey === 'selector' ? styleSelectors : options}
                        dataSourceFields={dataSourceFields}
                        disabled={typeof disabled === 'function' ? disabled(params) : disabled}
                        onChange={handleChangeParam}
                      />
                    );
                  })}
                </div>
              );
            })}
            <Button size="xs" onClick={handleClickAdd}>
              Add Transformer
            </Button>
          </div>
        </div>
      )}
    />
  );
};

export default StepTransformers;
