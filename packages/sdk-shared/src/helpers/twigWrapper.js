// Packages
import Twig from 'twig';

Twig.extendFilter('object_as_json', value => (typeof value === 'object' ? JSON.stringify(value) : value));

const tokenRegex = /{{([ ]+|)(?<token>[a-zA-Z][a-zA-Z0-9._-]+)([ ]+|)}}/gim;

const isValidToken = token => !!token.match(tokenRegex);

const hasTokens = template => !!template.replaceAll(' ', '').match(/{{.*}}/gim);

const processTwig = (template, variables = {}, keepEmptyTokens = false, asRaw = false) => {
  if (typeof template !== 'string') {
    return template;
  }

  try {
    let templateParsed = template;
    if (keepEmptyTokens) {
      [...templateParsed.matchAll(tokenRegex)].forEach(token => {
        templateParsed = templateParsed.replace(token[0], `{{ ${token.groups.token} | default('${token[0]}') }}`);
      });
    }

    if (asRaw) {
      [...templateParsed.matchAll(tokenRegex)].forEach(token => {
        templateParsed = templateParsed.replace(token[0], `{{ ${token.groups.token} | object_as_json }}`);
      });
    }

    templateParsed = Twig.twig({ data: templateParsed });
    const result = templateParsed.render(variables);
    if (!asRaw) {
      return result;
    }

    try {
      if (JSON.parse(result)) {
        return JSON.parse(result);
      }

      return result;
    } catch (e) {
      return result;
    }
  } catch (e) {
    return template;
  }
};

export { processTwig, isValidToken, hasTokens };
