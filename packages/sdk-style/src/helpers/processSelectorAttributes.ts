import type { StyleCategory, StyleItem, StyleState, StyleValue } from '@plitzi/sdk-shared';

type CssResult = { variables: Record<string, string>; value: string };

const getValue = (attribute: string, cssValue: string, nested: boolean = false) =>
  nested ? cssValue : `${attribute}:${cssValue};`;

const processCssNonFunction = (result: CssResult, attribute: string, cssValue: string, nested: boolean = false) => {
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

const processCssFunction = (
  result: CssResult,
  attribute: string,
  functionName: string,
  functionContent: string,
  nested: boolean = false
) => {
  const myResult: CssResult = { variables: {}, value: '' };
  if (functionName === 'url') {
    const partialResult = processCssNonFunction(result, attribute, functionContent, true);
    myResult.variables = { ...myResult.variables, ...partialResult.variables };
    myResult.value = getValue(attribute, `${functionName}(${partialResult.value})`, nested);
  } else {
    myResult.value = getValue(attribute, `${functionName}(${functionContent})`, nested);
  }

  return myResult;
};

const processLayer = (result: CssResult, attribute: string, value: string, nested = false, skipAttribute = false) => {
  const myResult: CssResult = { variables: {}, value: '' };
  const subValues = value.replaceAll(';', '').match(/[a-z-]+\((?:[^()]+|\([^()]*\))*\)|[^\s]+/gi);
  if (!nested && subValues && subValues.length > 1) {
    subValues.forEach(subValue => {
      const partialResult = processLayer(result, attribute, subValue, true, skipAttribute);
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
    return processCssNonFunction(myResult, attribute, value, nested || skipAttribute);
  }

  const { functionName, functionContent } = matchFunction.groups;

  return processCssFunction(result, attribute, functionName, functionContent, nested || skipAttribute);
};

export const processCssString = (attribute: string, value?: string) => {
  const result: CssResult = { variables: {}, value: '' };
  const layers = value?.split(/,(?![^(]*\))/).map(layer => layer.trim()) ?? [];
  layers.forEach(layer => {
    const layerResult = processLayer(result, attribute, layer, false, true);

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

function processSelectorAttributes(selector: Extract<StyleItem, { type: 'element' }>): {
  attributes: Record<string, string[]>;
  stateAttributes: Record<StyleState, Record<string, string[]>>;
};
function processSelectorAttributes(selector: Exclude<StyleItem, { type: 'element' }>): {
  attributes: string[];
  stateAttributes: Record<StyleState, string[]>;
};
function processSelectorAttributes(selector: StyleItem) {
  if (selector.type === 'element') {
    const attributes: Record<string, string[]> = {};
    const stateAttributes: Record<StyleState, Record<string, string[]>> = {} as Record<
      StyleState,
      Record<string, string[]>
    >;

    for (const [styleSelector, selectorAttributes] of Object.entries(selector.attributes)) {
      for (const [key, value] of Object.entries(selectorAttributes)) {
        const partialResult = processCssString(key, value as string);
        if (!(attributes[styleSelector] as string[] | undefined)) {
          attributes[styleSelector] = [];
        }

        attributes[styleSelector].push(...partialResult.variables, partialResult.value);
      }
    }

    if (!selector.stateAttributes) {
      return { attributes, stateAttributes };
    }

    for (const [state, selectorAttributesGroups] of Object.entries(selector.stateAttributes) as [
      StyleState,
      Record<string, Partial<Record<StyleCategory, StyleValue>>>
    ][]) {
      for (const [styleSelector, selectorAttributes] of Object.entries(selectorAttributesGroups)) {
        for (const [key, value] of Object.entries(selectorAttributes)) {
          const partialResult = processCssString(key, value as string);
          if (!(stateAttributes[state] as Record<string, string[]> | undefined)) {
            stateAttributes[state] = {} as Record<string, string[]>;
          }

          if (!(stateAttributes[state][styleSelector] as string[] | undefined)) {
            stateAttributes[state][styleSelector] = [];
          }

          stateAttributes[state][styleSelector].push(...partialResult.variables, partialResult.value);
        }
      }
    }

    return { attributes, stateAttributes };
  }

  const attributes: string[] = [];
  const stateAttributes: Record<StyleState, string[]> = {} as Record<StyleState, string[]>;
  for (const [key, value] of Object.entries(selector.attributes)) {
    const partialResult = processCssString(key, value as string);
    attributes.push(...partialResult.variables, partialResult.value);
  }

  if (!selector.stateAttributes) {
    return { attributes, stateAttributes };
  }

  for (const [state, selectorAttributes] of Object.entries(selector.stateAttributes) as [
    StyleState,
    Partial<Record<StyleCategory, StyleValue>>
  ][]) {
    for (const [key, value] of Object.entries(selectorAttributes)) {
      const partialResult = processCssString(key, value as string);
      if (!(stateAttributes[state] as string[] | undefined)) {
        stateAttributes[state] = [];
      }

      stateAttributes[state].push(...partialResult.variables, partialResult.value);
    }
  }

  return { attributes, stateAttributes };
}

export default processSelectorAttributes;
