import { isStyleVariableCategory, StyleVariableCategory } from '@plitzi/sdk-shared/types';

import type { StyleItem, StyleThemeValue, StyleVariableValue } from '@plitzi/sdk-shared';

const isThemeValue = (value: StyleVariableValue): value is StyleThemeValue => typeof value === 'object';

const processSelectorVariables = (selector: Omit<StyleItem, 'cache'>) => {
  const { variables } = selector;
  if (!variables || !Object.keys(variables).length) {
    return undefined;
  }

  const selectorVariables: { default: string[]; light: string[]; dark: string[] } = {
    default: [],
    light: [],
    dark: []
  };

  Object.entries(variables).forEach(([key, variablesGroup]) => {
    // A category this version does not know is written as a custom one, as the switch's default always did.
    const category = isStyleVariableCategory(key) ? key : StyleVariableCategory.CUSTOM;

    switch (category) {
      case StyleVariableCategory.COLOR: {
        Object.entries(variablesGroup).forEach(([variable, value]) => {
          // A colour is one value or one per scheme. Only what was given is written: a side left out was written as
          // the text `undefined`, which a custom property accepts — and it overrode the good value wherever it applied.
          if (!isThemeValue(value)) {
            selectorVariables.default.push(`--${variable}:${String(value)};`);

            return;
          }

          if (value.default !== undefined) {
            selectorVariables.default.push(`--${variable}:${value.default};`);
          }

          if (value.light) {
            selectorVariables.light.push(`--${variable}:${value.light};`);
          }

          if (value.dark) {
            selectorVariables.dark.push(`--${variable}:${value.dark};`);
          }
        });

        break;
      }

      case StyleVariableCategory.SPACING:
      case StyleVariableCategory.SHADOW:
      case StyleVariableCategory.CUSTOM:
      default:
        Object.keys(variablesGroup).forEach(variable => {
          selectorVariables.default.push(`--${variable}:${variablesGroup[variable] as string};`);
        });
    }
  });

  return selectorVariables;
};

export default processSelectorVariables;
