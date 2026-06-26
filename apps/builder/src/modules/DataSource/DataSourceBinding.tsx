/* eslint-disable @typescript-eslint/no-dynamic-delete */

import Button from '@plitzi/plitzi-ui/Button';
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import { get, upperFirst } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { produce } from 'immer';
import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';

import getSourcesByElementId from '@plitzi/sdk-elements/dataSource/getSourcesByElementId';
import { generateID } from '@plitzi/sdk-shared/helpers/utils';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { StyleBindingsAllowed } from '@plitzi/sdk-shared/style/styleConstants';

import BindingSelected from './BindingSelected';
import BindingForm from './models/BindingForm';

import type { Element, ElementBinding, BindingCategory } from '@plitzi/sdk-shared';

const bindingCategories: BindingCategory[] = ['attributes', 'style', 'initialState'];

export type DataSourceBindingProps = {
  id?: string;
  bindings?: Element['definition']['bindings'];
  element: Element;
  onChange?: (bindings: Element['definition']['bindings']) => void;
};

const DataSourceBinding = ({ id = '', bindings, element, onChange }: DataSourceBindingProps) => {
  const [[flat, sourcesDefinition]] = useBuilderStore(['schema.flat', 'sources']);
  const { attributes, definition } = element;
  const [bindingFormValues, setBindingFormValues] = useState<Record<keyof typeof attributes, ElementBinding | null>>(
    () => Object.keys(attributes).reduce((acum, key) => ({ ...acum, [key]: null }), {})
  );
  const sources = useMemo(
    () =>
      Object.values(getSourcesByElementId(sourcesDefinition, flat, id))
        .filter(source => source.meta.source)
        .reduce((acum, source) => ({ ...acum, [source.meta.source as string]: source.meta }), {}),
    [sourcesDefinition, id, flat]
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
      if (!bindings?.[category]) {
        return;
      }

      const binding = bindings[category].find(bin => bin.id === id);
      if (!binding) {
        return;
      }

      setBindingFormValues({ [category]: binding });
    },
    [bindings]
  );

  const handleClickEnableBinding = useCallback(
    (category: BindingCategory, id: string, isEnabled: boolean) => {
      if (!bindings || !bindings[category]) {
        return;
      }

      onChange?.(
        produce(bindings, draft => {
          if (!draft[category]) {
            return;
          }

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
      if (!bindings || !bindings[category]) {
        return;
      }

      onChange?.(
        produce(bindings, draft => {
          if (!draft[category]) {
            return;
          }

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
        ...Object.keys(definition.styleSelectors).flatMap(styleSelector => [
          { path: `styleSelectors.${styleSelector}`, label: `Style Selector - ${styleSelector}` },
          { path: `styleVariant.${styleSelector}`, label: `Style Variant - ${styleSelector}` }
        ])
      ]
    }),
    [attributes, definition]
  );

  if (Object.keys(sources).length === 0) {
    return (
      <div className="m-3 rounded-sm border-2 border-dashed border-gray-300 p-3 text-center text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
        Sources not found, Check if you have sources added
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {bindingCategories.map((fkey, i) => {
        let binding = bindings?.[fkey];
        if (!binding || !Array.isArray(binding)) {
          binding = [];
        }

        return (
          <Fragment key={`${id}_${i}`}>
            {i !== 0 && <div className="h-0.5 w-full bg-gray-300 dark:bg-zinc-700" />}
            <ContainerCollapsable collapsed={!binding.length}>
              <ContainerCollapsable.Header
                title={upperFirst(fkey)}
                className="w-full px-2"
                placement="right"
                iconCollapsed={<i className="fa-solid fa-chevron-right" />}
                iconExpanded={<i className="fa-solid fa-chevron-down" />}
              />
              <ContainerCollapsable.Content gap={4} className="p-2">
                <div className="flex flex-col gap-2 overflow-auto">
                  {binding
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
                {bindingFormValues[fkey] && (
                  <div
                    className={clsx('border-t border-gray-300 py-4 dark:border-zinc-700', {
                      'mt-4': !!binding.length,
                      'border-b': i !== bindingCategories.length - 1
                    })}
                  >
                    <BindingForm
                      value={bindingFormValues[fkey]}
                      category={fkey}
                      onClose={handleClickCloseForm(fkey)}
                      attributes={bindingsAvailables[fkey]}
                      sources={sources}
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
