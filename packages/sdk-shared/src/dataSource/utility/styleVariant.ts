import { set } from '@plitzi/plitzi-ui/helpers/lodash';

import type { DataSourceUtility, DataSourceUtilityParamsValue, Element, Style, StyleItem } from '../../types';

const callback = (
  source: string | string[] | Record<string, string | string[]>,
  params: DataSourceUtilityParamsValue<string>,
  _element: Partial<Element>,
  dataSources = {} as { sourceTo?: Record<string, string | string[]> }
) => {
  const { key, variant, append } = params;
  if (!key) {
    return dataSources.sourceTo ?? {};
  }

  const currentKey = key || 'base';
  const variantValue = variant || source;
  if (typeof variantValue === 'object' && !Array.isArray(variantValue)) {
    return variantValue;
  }

  if (!append) {
    return set({}, currentKey, variantValue);
  }

  return set({ ...dataSources.sourceTo }, currentKey, variantValue);
};

const groupEntries = (entries: { groupLabel: string; option: { value: string; label: string } }[]) => {
  const grouped = entries.reduce<Record<string, { value: string; label: string }[]>>((acc, { groupLabel, option }) => {
    if (!(groupLabel in acc)) {
      acc[groupLabel] = [];
    }

    acc[groupLabel].push(option);

    return acc;
  }, {});

  return Object.entries(grouped).map(([label, options]) => ({ label, options }));
};

const styleVariant: DataSourceUtility<
  string | string[] | Record<string, string | string[]>,
  Record<string, string | string[]>,
  string
> = {
  action: 'styleVariant',
  title: 'Style Variant',
  type: 'utility',
  params: {
    key: {
      label: 'Selector Key',
      defaultValue: '',
      type: 'select',
      options: (_params: DataSourceUtilityParamsValue<string>, element?: Partial<Element>) => {
        const selectors = element?.definition?.styleSelectors;

        if (!element || !element.definition || !selectors) {
          return [];
        }

        const elementType = element.definition.type;
        const entries = Object.entries(selectors).flatMap(([styleSelector, cssSelectors]) => {
          const selectorsArr = cssSelectors ? [elementType, ...cssSelectors.split(' ')] : [elementType];

          return selectorsArr.map(selector => ({
            groupLabel: styleSelector,
            option: { value: `${selector}.${styleSelector}`, label: `${selector} (${styleSelector})` }
          }));
        });

        return groupEntries(entries);
      }
    },
    variant: {
      label: 'Variant',
      defaultValue: '',
      type: 'select',
      options: (
        params: DataSourceUtilityParamsValue<string>,
        element?: Partial<Element>,
        data?: { stylePlatform?: Style['platform'] }
      ) => {
        const selectors = element?.definition?.styleSelectors;
        const selectedKey = params.key || '';
        if (!element || !element.definition || !selectors || !data?.stylePlatform || !selectedKey.includes('.')) {
          return [];
        }

        const elementType = element.definition.type;
        const styleSelector = selectedKey.split('.').pop() || '';
        const cssSelector = selectors[styleSelector];
        if (!cssSelector) {
          return [];
        }

        const variantOptions: { label: string; value: string }[] = [];
        const resolvedKeys = [elementType, ...cssSelector.split(' ').filter(Boolean)];

        Object.entries(data.stylePlatform).forEach(([mode, platform]) => {
          resolvedKeys.forEach(key => {
            const item = platform[key];
            if (!(item as StyleItem | undefined)) {
              return;
            }

            const attributes = item.attributes;
            const block = attributes[styleSelector];
            Object.keys(block.variants || {}).forEach(v => {
              variantOptions.push({ value: v, label: `${mode}: ${v}` });
            });
          });
        });

        return variantOptions;
      }
    },
    append: {
      label: 'Append to Variant',
      description: 'Merge with existing variant values instead of replacing',
      defaultValue: false,
      type: 'checkbox'
    }
  },
  preview: { key: '', variant: '', append: '' },
  callback
};

export default styleVariant;
