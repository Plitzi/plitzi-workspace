import { processTwig, processTwigValue } from '../../helpers/twigWrapper';

import type { DataSourceUtility, DataSourceUtilityParamsValue, Element } from '../../types';

export type TwigTemplateReturnMode = 'text' | 'value';

/**
 * What a template hands the attribute: its rendered TEXT (the default — a label, a URL, a class name), or the VALUE
 * of its one expression (`value`).
 *
 * Text is what a template is for most of the time, and it is also why a list could never be fed a filtered array: its
 * `items` received the array written out as JSON, and a list keeps only arrays. `value` answers `{{ source|filter(…) }}`
 * with the array itself, `{{ count > 0 }}` with a boolean and `{{ total }}` with the number — see `processTwigValue`.
 */
const callback = (
  source: unknown,
  params: DataSourceUtilityParamsValue<string>,
  _element: Partial<Element>,
  dataSources = {} as Record<string, unknown>
): unknown => {
  const { template, returnMode = 'text' } = params;
  const context = { source, ...dataSources };
  try {
    return returnMode === 'value' ? processTwigValue(template, context) : processTwig(template, context);
  } catch {
    return source;
  }
};

const twigTemplate: DataSourceUtility<unknown, unknown, string> = {
  action: 'twigTemplate',
  title: 'Twig Template',
  type: 'utility',
  params: {
    template: {
      label: 'Template',
      defaultValue:
        'Tokens {{source}} from the value selected to bind previously, {{sourceTo}} is your original value, other tokens via autocomplete',
      type: 'codemirror-text'
    },
    returnMode: {
      label: 'Returns',
      defaultValue: 'text',
      type: 'select',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Value (a single {{ expression }})', value: 'value' }
      ]
    }
  },
  preview: { template: '' },
  callback
};

export default twigTemplate;
