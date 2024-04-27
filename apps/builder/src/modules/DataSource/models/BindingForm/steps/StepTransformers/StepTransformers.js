// Packages
import React, { useCallback, useMemo, useState } from 'react';
import noop from 'lodash/noop';
import set from 'lodash/set';
import get from 'lodash/get';
import { produce } from 'immer';
import Button from '@plitzi/plitzi-ui-components/Button';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import Select2 from '@plitzi/plitzi-ui-components/Select2';

// Monorepo
import utility from '@plitzi/sdk-data-source/utility';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import TransformerParam from './TransformerParam';

const transformersDefault = [];

/**
 * @param {{
 *   transformers?: object[];
 *   dataSourceFields?: object;
 *   onBack?: () => void;
 *   onNext?: (values: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const StepTransformers = props => {
  const {
    transformers: transformersProp = transformersDefault,
    dataSourceFields = emptyObject,
    onBack = noop,
    onNext = noop
  } = props;
  const [transformers, setTransformers] = useState(transformersProp);
  const utilityOptions = useMemo(
    () => Object.values(utility).map(({ title, action }) => ({ label: title, value: action })),
    [utility]
  );

  const handleClickBack = useCallback(() => onBack(), [onBack]);

  const handleClickNext = useCallback(() => onNext({ transformers }), [onNext, transformers]);

  const handleClickAdd = useCallback(
    () => setTransformers(state => [...state, { type: 'utility', action: '', params: {} }]),
    []
  );

  const handleClickRemove = index => () => {
    setTransformers(state =>
      produce(state, draft => {
        draft.splice(index, 1);
      })
    );
  };

  const handleChangeTransformerAction = index => option => {
    const paramDefinitions = get(utility, `${option.value}.params`, {});

    const params = Object.keys(paramDefinitions).reduce(
      (acum, paramKey) => ({ ...acum, [paramKey]: paramDefinitions[paramKey].defaultValue }),
      {}
    );

    setTransformers(state =>
      produce(state, draft => {
        set(draft, `${index}.action`, option.value);
        set(draft, `${index}.params`, params);
      })
    );
  };

  const handleChangeParam = index => (id, value) => {
    setTransformers(state =>
      produce(state, draft => {
        set(draft, `${index}.params.${id}`, value);
      })
    );
  };

  return (
    <div className="flex flex-col">
      <Heading type="h5" className="mb-4">
        Transformers
      </Heading>
      <div className="flex flex-col">
        {transformers &&
          transformers.map((transformer, i) => {
            const { action, params } = transformer;
            const paramDefinitions = get(utility, `${action}.params`, {});

            return (
              <div key={i} className="flex flex-col border border-gray-300 rounded p-4 not-first:mt-4">
                <div className="flex items-center">
                  <Select2
                    className="rounded w-full"
                    size="sm"
                    placeholder="Select a Transformer"
                    value={action}
                    onChange={handleChangeTransformerAction(i)}
                    options={utilityOptions}
                  />
                  <Button
                    intent="custom"
                    size="custom"
                    className="flex items-start flex items-center w-6 h-6 text-red-400 hover:text-red-500 ml-4"
                    onClick={handleClickRemove(i)}
                    title="Remove"
                  >
                    <i className="fas fa-trash-alt" />
                  </Button>
                </div>
                {paramDefinitions &&
                  Object.keys(paramDefinitions).map(paramKey => {
                    const { label, defaultValue, options } = paramDefinitions[paramKey];
                    let { type } = paramDefinitions[paramKey];
                    const value = get(params, paramKey, defaultValue);
                    if (typeof type === 'function') {
                      type = type(params);
                    }

                    return (
                      <TransformerParam
                        key={paramKey}
                        id={paramKey}
                        value={value}
                        label={label}
                        type={type}
                        onChange={handleChangeParam(i)}
                        options={options}
                        dataSourceFields={dataSourceFields}
                      />
                    );
                  })}
              </div>
            );
          })}
        <Button className="rounded not-first:mt-4" onClick={handleClickAdd}>
          Add Transformer
        </Button>
      </div>
      <div className="flex justify-between mt-4">
        <Button onClick={handleClickBack} className="mr-4 rounded-md text-xs">
          Back
        </Button>
        <Button onClick={handleClickNext} className="rounded-md text-xs">
          {transformers.length === 0 ? 'Skip' : 'Next'}
        </Button>
      </div>
    </div>
  );
};

export default StepTransformers;
