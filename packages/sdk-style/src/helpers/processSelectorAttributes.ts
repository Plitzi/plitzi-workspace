import type { StyleItem, StyleState, StyleValue } from '@plitzi/sdk-shared';

type CssResult = { variables: Record<string, string>; value: string };

type Attributes = Record<
  string,
  {
    default: string[];
    states?: Record<StyleState, string[]>;
    variants?: Record<string, { default: string[]; states?: Record<StyleState, string[]> }>;
  }
>;

// Helpers

const getValue = (attribute: string, cssValue: string, nested: boolean = false) =>
  nested ? cssValue : `${attribute}:${cssValue};`;

const processObject = (obj?: Record<string, StyleValue>): string[] => {
  if (!obj) {
    return [];
  }

  const result: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const partial = processCssString(key, String(value));
    result.push(...partial.variables, partial.value);
  }

  return result;
};

// End - Helpers

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

function processSelectorAttributes(selector?: StyleItem) {
  if (!selector?.attributes || !Object.keys(selector.attributes).length) {
    return { attributes: { base: { default: [] } } };
  }

  const attributes: Attributes = {};
  for (const styleSelector in selector.attributes) {
    const block = selector.attributes[styleSelector];
    const defaultStyles = processObject(block.default);
    const states: NonNullable<Attributes[string]['states']> = {} as NonNullable<Attributes[string]['states']>;
    if (block.states) {
      for (const [state, styleObject] of Object.entries(block.states) as [StyleState, Record<string, StyleValue>][]) {
        const processed = processObject(styleObject);
        if (processed.length) {
          states[state] = processed;
        }
      }
    }

    const variants: NonNullable<Attributes[string]['variants']> = {};
    if (block.variants) {
      for (const variantName in block.variants) {
        const variantBlock = block.variants[variantName];
        const variantDefault = processObject(variantBlock.default);
        const variantStates: NonNullable<Attributes[string]['states']> = {} as NonNullable<
          Attributes[string]['states']
        >;
        if (variantBlock.states) {
          for (const [state, styleObject] of Object.entries(variantBlock.states) as [
            StyleState,
            Record<string, StyleValue>
          ][]) {
            const processed = processObject(styleObject);
            if (processed.length) {
              variantStates[state] = processed;
            }
          }
        }

        variants[variantName] = {
          default: variantDefault,
          ...(Object.keys(variantStates).length && { states: variantStates })
        };
      }
    }

    attributes[styleSelector] = {
      default: defaultStyles,
      ...(Object.keys(states).length && { states }),
      ...(Object.keys(variants).length && { variants })
    };
  }

  return { attributes };
}

export default processSelectorAttributes;
