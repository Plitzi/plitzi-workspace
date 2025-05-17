import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

const callback = (source: string, params: { template: string }, dataSources = {}) => {
  const { template } = params;
  let content: string | object = source;
  try {
    content = processTwig(template, { source, ...dataSources });
  } catch {
    content = source;
  }

  return content;
};

const twigTemplate = {
  action: 'twigTemplate',
  title: 'Twig Template',
  type: 'utility',
  params: {
    template: {
      label: 'Template',
      defaultValue: 'Token {{source}} from the value selected to bind previously, other tokens via autocomplete',
      type: 'codemirror-text'
    }
  },
  preview: { template: '' },
  callback
};

export default twigTemplate;
