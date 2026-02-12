import Twig from 'twig';

Twig.extendFilter('object_as_json', (value: string) => (typeof value === 'object' ? JSON.stringify(value) : value));

const tokenRegex = /{{([ ]+|)(?<token>[a-zA-Z][a-zA-Z0-9._-]+)([ ]+|)}}/gim;
const strictTokenRegex = /^{{([ ]+|)(?<token>[a-zA-Z][a-zA-Z0-9._-]+)([ ]+|)}}$/gim;

const isValidToken = (token: string, strict: boolean = false) =>
  strict ? !!token.trim().match(strictTokenRegex) : !!token.trim().match(tokenRegex);

const hasTokens = (template?: string) =>
  typeof template === 'string' && !!template.replaceAll(' ', '').match(/{{.*}}/gim);

const processTwig = (
  template: string,
  variables: { [key: string]: unknown } = {},
  keepEmptyTokens = false,
  asRaw = false
) => {
  if (typeof template !== 'string') {
    return template;
  }

  try {
    let templateParsed = template;
    if (keepEmptyTokens) {
      [...templateParsed.matchAll(tokenRegex)].forEach(token => {
        if (token.groups) {
          templateParsed = templateParsed.replace(token[0], `{{ ${token.groups.token} | default('${token[0]}') }}`);
        }
      });
    }

    if (asRaw) {
      [...templateParsed.matchAll(tokenRegex)].forEach(token => {
        if (token.groups) {
          templateParsed = templateParsed.replace(token[0], `{{ ${token.groups.token} | object_as_json }}`);
        }
      });
    }

    if ('variables' in variables) {
      // Due that interactions have a variables context, these needs to be at root level
      variables = { ...variables, ...(variables.variables as Record<string, string>) };
    }

    const twigTemplate = Twig.twig({ data: templateParsed });
    const result = twigTemplate.render(variables);
    if (!asRaw) {
      return result;
    }

    try {
      if (JSON.parse(result)) {
        return JSON.parse(result) as string | object;
      }

      return result;
    } catch {
      return result;
    }
  } catch {
    return template;
  }
};

export { processTwig, isValidToken, hasTokens };
