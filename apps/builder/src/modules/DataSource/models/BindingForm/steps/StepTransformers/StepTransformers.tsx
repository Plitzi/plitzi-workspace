import Button from '@plitzi/plitzi-ui/Button';
import Form, { useFormContext, useFormWatch } from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { produce } from 'immer';
import get from 'lodash-es/get';
import set from 'lodash-es/set';
import { useCallback, useMemo, useRef } from 'react';

import utility from '@plitzi/sdk-data-source/utility/index';

import TransformerParam from './TransformerParam';

import type { BindingSchema } from '../../BindingForm';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { DataSourceUtilityParams, SourceField } from '@plitzi/sdk-shared';

export type StepTransformersProps = {
  dataSourceFields?: Record<string, SourceField[]>;
};

const StepTransformers = ({ dataSourceFields }: StepTransformersProps) => {
  const form = useFormContext<BindingSchema>();
  const { control, setValue } = form;
  const watchTransformers = useFormWatch(form, 'transformers');
  const watchTransformersRef = useRef(watchTransformers);
  watchTransformersRef.current = watchTransformers;
  const utilityOptions = useMemo(
    () => Object.values(utility).map(({ title, action }) => ({ label: title, value: action })),
    []
  );

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
                    const { label, type, defaultValue, options } = paramDefinitions[paramKey];
                    const paramValue = get(
                      params as Record<string, string | number | boolean | undefined>,
                      paramKey,
                      defaultValue
                    );

                    return (
                      <TransformerParam
                        key={paramKey}
                        id={paramKey}
                        value={paramValue}
                        label={label}
                        index={i}
                        type={typeof type === 'function' ? type(params) : type}
                        onChange={handleChangeParam}
                        options={options}
                        dataSourceFields={dataSourceFields}
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

  // return (
  //   <div className="flex flex-col">
  //     <Heading as="h5" className="mb-4">
  //       Transformers
  //     </Heading>
  //     <div className="flex flex-col">
  //       {transformers &&
  //         transformers.map((transformer, i) => {
  //           const { action, params } = transformer;
  //           const paramDefinitions = get(utility, `${action}.params`, {});

  //           return (
  //             <div key={i} className="flex flex-col rounded-sm border border-gray-300 p-4 [&:not(:first-child)]:mt-4">
  //               <div className="flex items-center">
  //                 <Select2
  //                   className="w-full rounded-sm"
  //                   size="sm"
  //                   placeholder="Select a Transformer"
  //                   value={action}
  //                   onChange={handleChangeTransformerAction(i)}
  //                   options={utilityOptions}
  //                 />
  //                 <Button
  //                   intent="custom"
  //                   size="custom"
  //                   className="ml-4 flex h-6 w-6 items-center text-red-400 hover:text-red-500"
  //                   onClick={handleClickRemove(i)}
  //                   title="Remove"
  //                 >
  //                   <i className="fas fa-trash-alt" />
  //                 </Button>
  //               </div>
  //               {paramDefinitions &&
  //                 Object.keys(paramDefinitions).map(paramKey => {
  //                   const { label, defaultValue, options } = paramDefinitions[paramKey];
  //                   let { type } = paramDefinitions[paramKey];
  //                   const value = get(params, paramKey, defaultValue);
  //                   if (typeof type === 'function') {
  //                     type = type(params);
  //                   }

  //                   return (
  //                     <TransformerParam
  //                       key={paramKey}
  //                       id={paramKey}
  //                       value={value}
  //                       label={label}
  //                       type={type}
  //                       onChange={handleChangeParam(i)}
  //                       options={options}
  //                       dataSourceFields={dataSourceFields}
  //                     />
  //                   );
  //                 })}
  //             </div>
  //           );
  //         })}
  //       <Button className="rounded-sm [&:not(:first-child)]:mt-4" onClick={handleClickAdd}>
  //         Add Transformer
  //       </Button>
  //     </div>
  //   </div>
  // );
};

export default StepTransformers;
