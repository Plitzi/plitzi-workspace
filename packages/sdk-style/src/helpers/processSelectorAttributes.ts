import type { StyleCategory, StyleItem } from '@plitzi/sdk-shared';

type CssResult = { variables: Record<string, string>; value: string };

const getValue = (attribute: string, cssValue: string, nested: boolean = false) =>
  nested ? cssValue : `${attribute}:${cssValue};`;

export const processCssString = (attribute: string, value?: string) => {
  const result: CssResult = { variables: {}, value: '' };

  const processCssFunction = (
    attribute: string,
    functionName: string,
    functionContent: string,
    nested: boolean = false
  ) => {
    const myResult: CssResult = { variables: {}, value: '' };
    if (functionName === 'url') {
      const partialResult = processCssNonFunction(attribute, functionContent, true);
      myResult.variables = { ...myResult.variables, ...partialResult.variables };
      myResult.value = getValue(attribute, `${functionName}(${partialResult.value})`, nested);
    } else {
      myResult.value = getValue(attribute, `${functionName}(${functionContent})`, nested);
    }

    return myResult;
  };

  const processCssNonFunction = (attribute: string, cssValue: string, nested: boolean = false) => {
    const myResult: CssResult = { variables: {}, value: '' };
    const matchContent = cssValue.replaceAll('"', '').match(/var\((?<variableName>--[\w-]+)\)(?<extraContent>\S.+)/);
    if (!matchContent || !matchContent.groups) {
      myResult.value = getValue(attribute, cssValue, nested);

      return myResult;
    }

    const { variableName, extraContent } = matchContent.groups;
    let newVariable = `${variableName}-parsed`;
    const newVariableValue = `var(${variableName})+"${extraContent}"`;
    if (result.variables[newVariable] && result.variables[newVariable] !== newVariableValue) {
      newVariable = `${newVariable}-${Object.keys(result.variables).length}`;
    }

    myResult.variables[newVariable] = newVariableValue;
    myResult.value = getValue(attribute, `var(${newVariable})`, nested);

    return myResult;
  };

  const processLayer = (attribute: string, value: string, nested = false, skipAttribute = false) => {
    const myResult: CssResult = { variables: {}, value: '' };
    const subValues = value.replaceAll(';', '').match(/[a-z-]+\((?:[^()]+|\([^()]*\))*\)|[^\s]+/gi);
    if (!nested && subValues && subValues.length > 1) {
      subValues.forEach(subValue => {
        const partialResult = processLayer(attribute, subValue, true, skipAttribute);
        myResult.variables = { ...myResult.variables, ...partialResult.variables };
        if (myResult.value) {
          myResult.value = `${myResult.value} ${partialResult.value}`;
        } else {
          myResult.value = partialResult.value;
        }
      });

      return myResult;
    }

    value = subValues?.[0] ?? value;

    const matchFunction = value.match(
      /^(?!var\()\s*(?<functionName>[a-z-]+)\s*\(\s*(?<functionContent>[\s\S]*)\s*\)\s*$/i
    );
    if (!matchFunction || !matchFunction.groups) {
      return processCssNonFunction(attribute, value, nested || skipAttribute);
    }

    const { functionName, functionContent } = matchFunction.groups;

    return processCssFunction(attribute, functionName, functionContent, nested || skipAttribute);
  };

  const layers = value?.split(/,(?![^(]*\))/).map(layer => layer.trim()) ?? [];

  layers.forEach(layer => {
    const layerResult = processLayer(attribute, layer, false, true);

    result.variables = { ...result.variables, ...layerResult.variables };
    if (result.value) {
      result.value = `${result.value},${layerResult.value}`;
    } else {
      result.value = layerResult.value;
    }
  });

  if (result.value) {
    result.value = `${attribute}:${result.value};`;
  }

  return {
    variables: Object.keys(result.variables).map(variable => `${variable}:${result.variables[variable]};`),
    value: result.value
  };
};

const processSelectorAttributes = (selector: Omit<StyleItem, 'cache'>) => {
  const { attributes } = selector;
  const result: string[] = [];
  (Object.keys(attributes) as StyleCategory[]).forEach(key => {
    const partialResult = processCssString(key, attributes[key] as string);
    result.push(...partialResult.variables, partialResult.value);
  });

  return result;
};

export default processSelectorAttributes;
