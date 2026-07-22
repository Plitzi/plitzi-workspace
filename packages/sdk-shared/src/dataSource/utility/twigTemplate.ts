import { processTwig } from '../../helpers/twigWrapper';

import type { DataSourceUtility, DataSourceUtilityParamsValue, Element } from '../../types';

const callback = (
  source: string,
  params: DataSourceUtilityParamsValue<string>,
  _element: Partial<Element>,
  dataSources = {} as Record<string, unknown>
) => {
  const { template } = params;
  let content: string | object = source;
  try {
    const result = processTwig(template, { source, ...dataSources });
    if (typeof result === 'string' || (typeof result === 'object' && result !== null)) {
      content = result;
    }
  } catch {
    content = source;
  }

  return content;
};

const twigTemplate: DataSourceUtility<string, string | object, string> = {
  action: 'twigTemplate',
  title: 'Twig Template',
  type: 'utility',
  params: {
    template: {
      label: 'Template',
      defaultValue:
        'Tokens {{source}} from the value selected to bind previously, {{sourceTo}} is your original value, other tokens via autocomplete',
      type: 'codemirror-text'
    }
  },
  preview: { template: '' },
  callback
};

export default twigTemplate;
