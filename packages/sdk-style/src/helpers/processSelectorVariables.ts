import { isStyleVariableCategory, StyleVariableCategory } from '@plitzi/sdk-shared/types';

import type { StyleItem, StyleThemeValue } from '@plitzi/sdk-shared';

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
        Object.keys(variablesGroup).forEach(variable => {
          const variableValue = variablesGroup[variable] as StyleThemeValue;
          selectorVariables.default.push(`--${variable}:${variableValue.default};`);
          if (variableValue.light) {
            selectorVariables.light.push(`--${variable}:${variableValue.light};`);
          }

          if (variableValue.dark) {
            selectorVariables.dark.push(`--${variable}:${variableValue.dark};`);
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
