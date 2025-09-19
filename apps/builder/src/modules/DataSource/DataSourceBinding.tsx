/* eslint-disable @typescript-eslint/no-dynamic-delete */
import Button from '@plitzi/plitzi-ui/Button';
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import classNames from 'classnames';
import { produce } from 'immer';
import capitalize from 'lodash/capitalize';
import get from 'lodash/get';
import upperFirst from 'lodash/upperFirst';
import { useCallback, use, useEffect, useMemo, useState, Fragment } from 'react';

import { StyleBindingsAllowed } from '@plitzi/sdk-shared';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';

import BindingSelected from './BindingSelected';
import BindingForm from './models/BindingForm';
import { generateID } from '../../helpers/utils';

import type { Element, ElementBinding } from '@plitzi/sdk-shared';

export type BindingCategory = 'attributes' | 'style' | 'initialState';

const bindingCategories: BindingCategory[] = ['attributes', 'style', 'initialState'];

export type DataSourceBindingProps = {
  id?: string;
  bindings?: Record<string, ElementBinding[]>;
  allowCustomBindings?: boolean;
  element: Element;
  onChange?: (bindings: Record<string, ElementBinding[]>) => void;
};

const DataSourceBinding = ({
  id = '',
  bindings,
  allowCustomBindings = false,
  element,
  onChange
}: DataSourceBindingProps) => {
  const { getSourcesByElementId } = use(DataSourceContext);
  const { schema } = use(BuilderSchemaContext);
  const { attributes, definition } = element;
  const [bindingFormValues, setBindingFormValues] = useState<Record<keyof typeof attributes, ElementBinding | null>>(
    () => Object.keys(attributes).reduce((acum, key) => ({ ...acum, [key]: null }), {})
  );
  const sources = useMemo(
    () =>
      Object.values(getSourcesByElementId(schema.flat, id)).reduce(
        (acum, source) => ({ ...acum, [source.meta.source]: source.meta }),
        {}
      ),
    [getSourcesByElementId, id, schema.flat]
  );

  useEffect(() => {
    setBindingFormValues(Object.keys(attributes).reduce((acum, key) => ({ ...acum, [key]: null }), {}));
  }, [id, attributes]);

  const handleClickAddBinding = useCallback(
    (category: BindingCategory) => () => {
      setBindingFormValues(state => ({
        ...state,
        [category]: {
          id: generateID(),
          fromPath: '',
          toPath: '',
          source: '',
          transformers: [],
          when: undefined,
          enabled: true
        }
      }));
    },
    []
  );

  const handleClickUpdateBinding = useCallback(
    (category: BindingCategory, id: string) => {
      const binding = bindings?.[category].find(bin => bin.id === id);
      if (!binding) {
        return;
      }

      setBindingFormValues({ [category]: binding });
    },
    [bindings]
  );

  const handleClickEnableBinding = useCallback(
    (category: BindingCategory, id: string, isEnabled: boolean) => {
      if (!bindings) {
        return;
      }

      onChange?.(
        produce(bindings, draft => {
          const binding = draft[category].find(bin => bin.id === id);
          if (!binding) {
            return;
          }

          binding.enabled = isEnabled;
        })
      );
    },
    [onChange, bindings]
  );

  const handleClickRemoveBinding = useCallback(
    (category: BindingCategory, id: string) => {
      if (!bindings) {
        return;
      }

      onChange?.(
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

  const handleClickCloseForm = (category: BindingCategory) => (isSaving: boolean, values?: ElementBinding) => {
    if (isSaving && values) {
      const { id, source, fromPath, toPath, transformers, when } = values;
      let finalBingings = bindings as Record<string, ElementBinding[]>;
      if (!bindings || Array.isArray(bindings) || typeof bindings !== 'object') {
        finalBingings = {};
      }

      onChange?.(
        produce(finalBingings, draft => {
          if (!(draft[category] as ElementBinding[] | undefined)) {
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

  const bindingsAvailables = useMemo(
    () => ({
      attributes: Object.keys(attributes).map(attributeKey => ({ path: attributeKey, label: attributeKey })),
      style: StyleBindingsAllowed,
      initialState: [
        { path: 'visibility', label: 'Visibility' },
        ...Object.keys(definition.styleSelectors).map(styleSelector => ({
          path: `styleSelectors.${styleSelector}`,
          label: `Selector - ${capitalize(styleSelector)}`
        }))
      ]
    }),
    [attributes, definition]
  );

  if (Object.keys(sources).length === 0) {
    return (
      <div className="m-3 rounded-sm border-2 border-dashed border-gray-300 p-3 text-center">
        Sources not found, Check if you have sources added
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {bindingCategories.map((fkey, i) => {
        const binding = bindings && (bindings[fkey] as ElementBinding[] | undefined);

        return (
          <Fragment key={`${id}_${i}`}>
            {i !== 0 && <div className="h-0.5 w-full bg-gray-300" />}
            <ContainerCollapsable collapsed={!(binding && bindings[fkey].length > 0)}>
              <ContainerCollapsable.Header
                title={upperFirst(fkey)}
                className="w-full"
                placement="right"
                iconCollapsed={<i className="fa-solid fa-chevron-up" />}
                iconExpanded={<i className="fa-solid fa-chevron-down" />}
              />
              <ContainerCollapsable.Content gap={4} className="py-2">
                {binding && (
                  <div className="flex flex-col gap-2 overflow-auto">
                    {bindings[fkey]
                      .filter(binding => binding.id && binding.id !== get(bindingFormValues, `${fkey}.id`, ''))
                      .map((binding, j) => {
                        const { id, source, fromPath, toPath, transformers, when, enabled } = binding;

                        return (
                          <BindingSelected
                            key={`${i}_${j}`}
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
                {bindingFormValues[fkey] && (
                  <div
                    className={classNames('border-t border-gray-300 px-4 py-4', {
                      'mt-4': binding && Object.keys(bindings[fkey]).length > 0,
                      'border-b': i !== bindingCategories.length - 1
                    })}
                  >
                    <BindingForm
                      value={bindingFormValues[fkey]}
                      category={fkey}
                      onClose={handleClickCloseForm(fkey)}
                      attributes={bindingsAvailables[fkey]}
                      sources={sources}
                      allowCustomBindings={fkey === 'attributes' && allowCustomBindings}
                    />
                  </div>
                )}
                {!bindingFormValues[fkey] && (
                  <Button onClick={handleClickAddBinding(fkey)} size="sm" className="w-full" iconPlacement="before">
                    <Button.Icon icon="fas fa-link" />
                    Add Binding
                  </Button>
                )}
              </ContainerCollapsable.Content>
            </ContainerCollapsable>
          </Fragment>
        );
      })}
    </div>
  );
};

export default DataSourceBinding;
