// Packages
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import get from 'lodash/get';
import upperFirst from 'lodash/upperFirst';
import { produce } from 'immer';
import Button from '@plitzi/plitzi-ui-components/Button';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import BindingForm from './models/BindingForm';
import BindingSelected from './BindingSelected';
import { generateID } from '../../helpers/utils';

const DataSourceBinding = props => {
  const {
    id = '',
    bindings = emptyObject,
    bindingsAllowed = emptyObject,
    allowCustomBindings = false,
    onChange = noop
  } = props;
  const { dataSourceManager } = useContext(DataSourceContext);
  const [bindingFormValues, setBindingFormValues] = useState(() =>
    Object.keys(bindingsAllowed).reduce((acum, key) => ({ ...acum, [key]: null }), {})
  );

  const sources = useMemo(() => dataSourceManager.getSources(id, true, false), [id, dataSourceManager]);

  useEffect(() => {
    setBindingFormValues(Object.keys(bindingsAllowed).reduce((acum, key) => ({ ...acum, [key]: null }), {}));
  }, [id]);

  const handleClickAddBinding = category => () => {
    setBindingFormValues(state => ({
      ...state,
      [category]: { id: generateID(), fromPath: '', toPath: '', source: '', transformers: [], when: {}, enabled: true }
    }));
  };

  const handleClickUpdateBinding = useCallback(
    (category, id) => {
      const binding = bindings[category].find(bin => bin.id === id);
      if (!binding) {
        return;
      }

      setBindingFormValues({ [category]: binding });
    },
    [bindings]
  );

  const handleClickEnableBinding = useCallback(
    (category, id, isEnabled) =>
      onChange(
        produce(bindings, draft => {
          const binding = draft[category].find(bin => bin.id === id);
          if (!binding) {
            return;
          }

          binding.enabled = isEnabled;
        })
      ),
    [onChange, bindings]
  );

  const handleClickRemoveBinding = useCallback(
    (category, id) => {
      onChange(
        produce(bindings, draft => {
          const pos = draft[category].findIndex(binding => binding.id === id);
          if (pos > -1) {
            draft[category].splice(pos, 1);
          }

          if (draft[category].length === 0) {
            delete draft[category];
          }
        })
      );
    },
    [onChange, bindings]
  );

  const handleClickCloseForm = category => (isSaving, values) => {
    if (isSaving) {
      const { id, source, fromPath, toPath, transformers, when } = values;
      let finalBingins = bindings;
      if (!bindings || Array.isArray(bindings) || typeof bindings !== 'object') {
        finalBingins = {};
      }

      onChange(
        produce(finalBingins, draft => {
          if (!draft[category]) {
            draft[category] = [];
          }

          const index = draft[category].findIndex(b => b.id === id);
          if (index !== -1) {
            draft[category][index] = { id, source, fromPath, transformers, when, toPath };

            return;
          }

          draft[category].push({ id, source, fromPath, transformers, when, toPath });
        })
      );
    }

    setBindingFormValues(state => ({ ...state, [category]: null }));
  };

  if (Object.keys(sources).length === 0) {
    return (
      <div className="m-3 p-3 border-2 border-gray-300 border-dashed rounded text-center">
        Sources not found, Check if you have sources added
      </div>
    );
  }

  if (Object.keys(bindingsAllowed).length === 0) {
    return (
      <div className="m-3 p-3 border-2 border-gray-300 border-dashed rounded text-center">
        There are not bindings allowed
      </div>
    );
  }

  return Object.keys(bindingsAllowed).map((fkey, i) => (
    <ContainerCollapsable
      key={`${id}-${i}`}
      title={<div className="px-4 py-2">{upperFirst(fkey)}</div>}
      collapsed={!(bindings && bindings[fkey] && bindings[fkey].length > 0)}
    >
      {bindings && bindings[fkey] && (
        <div className="flex flex-col not-first:p-4 first:px-4 not-first:pt-4 overflow-auto">
          {bindings[fkey]
            .filter(binding => binding.id !== get(bindingFormValues, `${fkey}.id`))
            .map((binding, j) => {
              const { id, source, fromPath, toPath, transformers, when, enabled } = binding;

              return (
                <BindingSelected
                  key={`${i}-${j}`}
                  id={id}
                  sources={sources}
                  category={fkey}
                  source={source}
                  fromPath={fromPath}
                  toPath={toPath}
                  transformers={transformers}
                  when={when}
                  enabled={enabled}
                  onEnable={handleClickEnableBinding}
                  onUpdate={handleClickUpdateBinding}
                  onRemove={handleClickRemoveBinding}
                />
              );
            })}
        </div>
      )}
      {bindingFormValues[fkey] && sources && (
        <div
          className={classNames('border-t border-gray-300 py-4 px-4', {
            'mt-4': bindings && bindings[fkey] && Object.keys(bindings[fkey]).length > 0,
            'border-b': i !== Object.keys(bindingsAllowed).length - 1
          })}
        >
          <BindingForm
            value={bindingFormValues}
            category={fkey}
            onClose={handleClickCloseForm(fkey)}
            attributes={bindingsAllowed[fkey]}
            sources={sources}
            allowCustomBindings={fkey === 'attributes' && allowCustomBindings}
          />
        </div>
      )}
      {sources && !bindingFormValues[fkey] && (
        <div
          className={classNames('px-4 mb-4', {
            'pt-4': bindings && bindings[fkey] && Object.keys(bindings[fkey]).length > 0
          })}
        >
          <Button onClick={handleClickAddBinding(fkey)} className="w-full rounded-md">
            <i className="fas fa-link mr-1" />
            Add Binding
          </Button>
        </div>
      )}
    </ContainerCollapsable>
  ));
};

DataSourceBinding.propTypes = {
  id: PropTypes.string,
  bindings: PropTypes.object,
  bindingsAllowed: PropTypes.object,
  allowCustomBindings: PropTypes.bool,
  onChange: PropTypes.func
};

export default DataSourceBinding;
