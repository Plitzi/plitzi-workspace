import { StyleVariableCategory } from '@plitzi/sdk-shared/types';

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

  (Object.keys(variables) as StyleVariableCategory[]).forEach(category => {
    const variablesGroup = variables[category];
    if (!variablesGroup) {
      return;
    }

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
