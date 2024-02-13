// Relatives
import { processTwig } from '../../../helpers/twigWrapper';

const callback = (source, params, dataSources = {}) => {
  const { template } = params;
  let content = source;
  try {
    content = processTwig(template, { source, ...dataSources }, true);
  } catch (e) {
    content = source;
  }

  return content;
};

const delayTime = {
  action: 'twigTemplate',
  title: 'Twig Template',
  type: 'utility',
  params: {
    template: {
      label: 'Template',
      defaultValue: 'Tokens Availables {{source}} and others via autocomplete',
      type: 'codemirror-text'
    }
  },
  preview: { template: '' },
  callback
};

export default delayTime;
