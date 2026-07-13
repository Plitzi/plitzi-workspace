import Twig from 'twig';

Twig.extendFilter('object_as_json', (value: string) => (typeof value === 'object' ? JSON.stringify(value) : value));

const TOKEN_BASE = '{{\\s*(?<token>[a-zA-Z_][a-zA-Z0-9_]*(?:\\??\\.[a-zA-Z_][a-zA-Z0-9_]*)*)[^}]*}}';
const TOKEN_REGEX = new RegExp(TOKEN_BASE, 'g');
const TOKEN_STRICT_REGEX = new RegExp(`^${TOKEN_BASE}$`);

export const hasValidToken = (value?: string, strict = false): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const source = strict ? TOKEN_STRICT_REGEX : TOKEN_REGEX;
  source.lastIndex = 0;

  return source.test(value.trim());
};

export const processTwig = (
  template: string,
  variables: { [key: string]: unknown } = {},
  keepEmptyTokens = false,
  asRaw = false
) => {
  if (typeof template !== 'string') {
    return template;
  }

  try {
    TOKEN_REGEX.lastIndex = 0;
    let templateParsed = template;
    if (keepEmptyTokens) {
      [...templateParsed.matchAll(TOKEN_REGEX)].forEach(token => {
        if (token.groups) {
          templateParsed = templateParsed.replace(token[0], `{{ ${token.groups.token} | default('${token[0]}') }}`);
        }
      });
    }

    if (asRaw) {
      [...templateParsed.matchAll(TOKEN_REGEX)].forEach(token => {
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
      const parsed = JSON.parse(result) as string | object;
      if (parsed) {
        return parsed;
      }

      return result;
    } catch {
      return result;
    }
  } catch {
    return template;
  }
};
