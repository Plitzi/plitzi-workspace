import capitalize from 'lodash-es/capitalize';

import type {
  Element,
  InteractionBaseCallback,
  InteractionCallback,
  InteractionPostCallback
} from '@plitzi/sdk-shared';

const getInteractions = (
  attributes: Element['attributes'],
  definition: Element['definition'],
  callback: InteractionCallback['callback'],
  postCallback: InteractionPostCallback
): Record<string, InteractionBaseCallback> => ({
  setState: {
    action: 'setState',
    title: `Update ${definition.label}`,
    type: 'callback',
    callback,
    postCallback,
    preview: {},
    params: {
      category: {
        label: 'Category',
        defaultValue: 'attribute',
        type: 'select',
        options: [
          { value: 'attribute', label: 'Attribute' },
          { value: 'state', label: 'State' }
        ]
      },
      key: {
        label: 'Key',
        defaultValue: undefined,
        type: 'select',
        when: params => params.category === 'attribute' || params.category === 'state',
        options: params => {
          const { category } = params;
          if (category === 'attribute') {
            return Object.keys(attributes).map(attribute => ({ value: attribute, label: attribute }));
          }

          if (category === 'state') {
            return [
              { value: 'visibility', label: 'Visibility' },
              ...Object.keys(definition.styleSelectors).map(styleSelector => ({
                value: `styleSelectors.${styleSelector}`,
                label: `Selector - ${capitalize(styleSelector)}`
              }))
            ];
          }

          return [];
        }
      },
      value: {
        label: 'Value',
        defaultValue: undefined,
        type: params => (typeof attributes[params.key as string] === 'boolean' ? 'select' : 'text'),
        when: params => !!params.category,
        options: params => {
          const { key } = params;
          if (typeof attributes[key as string] === 'boolean') {
            return [
              { value: 'true', label: 'True' },
              { value: 'false', label: 'False' }
            ];
          }

          return Object.keys(attributes).map(attribute => ({ value: attribute, label: attribute }));
        }
      },
      revertOnFinish: {
        label: 'Revert changes after interaction',
        defaultValue: false,
        type: 'boolean'
      }
    }
  }
});

export default getInteractions;
