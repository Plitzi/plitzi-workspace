import Twig from 'twig';

Twig.extendFilter('object_as_json', (value: string) => (typeof value === 'object' ? JSON.stringify(value) : value));

// A token segment allows internal hyphens (a source idRef is `<type>_<idRef>` and an idRef may carry them), but
// never a leading or trailing one — the segment starts on `[a-zA-Z_]` and every '-' is followed by more word
// chars. Twig itself reads a '-' as subtraction, so `processTwig` rewrites any hyphenated path to `_context`
// subscript access before rendering; the charset here only has to recognise the token.
const TOKEN_SEGMENT = '[a-zA-Z_][a-zA-Z0-9_]*(?:-[a-zA-Z0-9_]+)*';
const TOKEN_BASE = `{{\\s*(?<token>${TOKEN_SEGMENT}(?:\\??\\.${TOKEN_SEGMENT})*)[^}]*}}`;
const TOKEN_REGEX = new RegExp(TOKEN_BASE, 'g');
const TOKEN_STRICT_REGEX = new RegExp(`^${TOKEN_BASE}$`);

// Turns a dotted token path into an expression Twig can resolve. A hyphen-free path is left as is, so existing
// behaviour is untouched; a path with a hyphen becomes `_context['seg'][...]` subscript access, which Twig reads
// as a key lookup rather than subtraction, without ever mutating the variables object.
const toTwigAccess = (path: string): string => {
  if (!path.includes('-')) {
    return path;
  }

  return `_context${path
    .split(/\??\./)
    .map(segment => `['${segment}']`)
    .join('')}`;
};

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
    const templateParsed = template.replace(TOKEN_REGEX, (full: string, path: string) => {
      const access = toTwigAccess(path);
      if (keepEmptyTokens) {
        return `{{ ${access} | default('${full}') }}`;
      }

      if (asRaw) {
        return `{{ ${access} | object_as_json }}`;
      }

      return full.replace(path, access);
    });

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
