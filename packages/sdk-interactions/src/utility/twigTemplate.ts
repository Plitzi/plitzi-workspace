import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';

import type { InteractionBaseCallback } from '@plitzi/sdk-shared';

const delayTime: InteractionBaseCallback<{ returnMode: 'jsonObject' | 'json' | 'text'; template: string }> = {
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
    const { template, returnMode } = params;
    if (returnMode === 'jsonObject') {
      try {
        const templateParsed = JSON.parse(processTwig(template, params) as string) as
          | { [key: string]: unknown }
          | undefined;
        if (templateParsed && typeof templateParsed === 'object') {
          return {
            template: '',
            content: getPathsFromObeject(templateParsed).reduce(
              (acum, templateItem) => ({ ...acum, [templateItem]: '' }),
              {}
            )
          };
        }
      } catch {
        // Nothing to do
      }
    }

    return { template: '', content: '' };
  },
  callback: params => {
    const { template, returnMode } = params;
    let content: string | object = '';
    try {
      content = processTwig(template, params);
    } catch (e) {
      console.error(e);
    }

    if (returnMode === 'jsonObject') {
      try {
        return { content: JSON.parse(content as string) as object };
      } catch (e) {
        console.error(e);
      }
    } else if (returnMode === 'json') {
      try {
        JSON.parse(content as string);

        return { content };
      } catch {
        return { content: '' };
      }
    }

    return { content };
  }
};

export default delayTime;
