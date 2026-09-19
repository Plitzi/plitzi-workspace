import type {
  StyleAncestors,
  StyleItem,
  StyleObject,
  StyleState,
  StyleStates,
  StyleValue,
  StyleVariants
} from '@plitzi/sdk-shared';

type CssResult = { variables: Record<string, string>; value: string };

type ProcessedStates = Partial<Record<StyleState, string[]>>;
type ProcessedVariants = Record<string, { default: string[]; states?: ProcessedStates }>;

export type ProcessedAncestors = Record<string, { states?: ProcessedStates; variants?: ProcessedVariants }>;

export type Attributes = Record<
  string,
  { default: string[]; states?: ProcessedStates; variants?: ProcessedVariants; ancestors?: ProcessedAncestors }
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
  // The terminator only, not every semicolon in the value. A `data:` URI carries its media type as
  // `image/svg+xml;charset=utf-8`, and stripping that one turned a working icon into a URI no browser resolves —
  // silently, and only once the selector was next saved, so the JSON on disk stayed right and the builder broke it.
  const subValues = value.replace(/\s*;\s*$/, '').match(/[a-z-]+\((?:[^()]+|\([^()]*\))*\)|[^\s]+/gi);
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

const processStates = (states?: StyleStates): ProcessedStates | undefined => {
  if (!states) {
    return undefined;
  }

  const processed: ProcessedStates = {};
  for (const [state, styleObject] of Object.entries(states) as [StyleState, StyleObject][]) {
    const values = processObject(styleObject);
    if (values.length) {
      processed[state] = values;
    }
  }

  return Object.keys(processed).length ? processed : undefined;
};

const processVariants = (variants?: StyleVariants): ProcessedVariants | undefined => {
  if (!variants) {
    return undefined;
  }

  const processed: ProcessedVariants = {};
  for (const [variantName, variantBlock] of Object.entries(variants)) {
    const states = processStates(variantBlock.states);
    processed[variantName] = { default: processObject(variantBlock.default), ...(states && { states }) };
  }

  return Object.keys(processed).length ? processed : undefined;
};

const processAncestors = (ancestors?: StyleAncestors): ProcessedAncestors | undefined => {
  if (!ancestors) {
    return undefined;
  }

  const processed: ProcessedAncestors = {};
  for (const [ancestorName, ancestor] of Object.entries(ancestors)) {
    const states = processStates(ancestor.states);
    const variants = processVariants(ancestor.variants);
    if (states || variants) {
      processed[ancestorName] = { ...(states && { states }), ...(variants && { variants }) };
    }
  }

  return Object.keys(processed).length ? processed : undefined;
};

function processSelectorAttributes(selector?: StyleItem): { attributes: Attributes } {
  if (!selector?.attributes || !Object.keys(selector.attributes).length) {
    return { attributes: { base: { default: [] } } };
  }

  const attributes: Attributes = {};
  for (const styleSelector in selector.attributes) {
    const block = selector.attributes[styleSelector];
    const states = processStates(block.states);
    const variants = processVariants(block.variants);
    const ancestors = processAncestors(block.ancestors);

    attributes[styleSelector] = {
      default: processObject(block.default),
      ...(states && { states }),
      ...(variants && { variants }),
      ...(ancestors && { ancestors })
    };
  }

  return { attributes };
}

export default processSelectorAttributes;
