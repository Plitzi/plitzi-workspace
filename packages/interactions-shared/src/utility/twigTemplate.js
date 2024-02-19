// Monorepo
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';

const callback = params => {
  const { template, returnMode } = params;
  let content = '';
  try {
    content = processTwig(template, params, true);
  } catch (e) {
    console.error(e);
  }

  if (returnMode === 'jsonObject') {
    try {
      return { content: JSON.parse(content) };
    } catch (e) {
      console.error(e);
    }
  } else if (returnMode === 'json') {
    try {
      JSON.parse(content);

      return { content };
    } catch (e) {
      return { content: '' };
    }
  }

  return { content };
};

const delayTime = {
  action: 'twigTemplate',
  title: 'Twig Template',
  type: 'utility',
  params: {
    returnMode: {
      label: 'Mode',
      canBind: false,
      type: 'select',
      defaultValue: 'text',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Json Text', value: 'json' },
        { label: 'Json Object', value: 'jsonObject' }
      ]
    },
    template: {
      label: 'Template',
      canBind: false,
      defaultValue: '',
      type: params => {
        const { returnMode } = params;
        if (returnMode === 'text') {
          return 'codemirror-text';
        }

        return 'codemirror-json';
      }
    }
  },
  preview: params => {
    const { returnMode } = params;
    let { template } = params;
    if (returnMode === 'jsonObject') {
      try {
        template = JSON.parse(processTwig(template, params, true));
        if (template && typeof template === 'object') {
          return {
            template: '',
            content: getPathsFromObeject(template).reduce((acum, templateItem) => ({ ...acum, [templateItem]: '' }), {})
          };
        }
      } catch (e) {
        // Nothing to do
      }
    }

    return { template: '', content: '' };
  },
  callback
};

export default delayTime;
