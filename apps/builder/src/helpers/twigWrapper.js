// Packages
import Twig from 'twig';

const tokenRegex = /{{([ ]+|)(?<token>[a-zA-Z][a-zA-Z0-9._-]+)([ ]+|)}}/gim;

const isValidToken = token => !!token.match(tokenRegex);

const hasTokens = template => !!template.replaceAll(' ', '').match(/{{.*}}/gim);

const isValidTokenName = tokenName => !!tokenName.match(/^[a-zA-Z][a-zA-Z0-9]+$/gim);

const processTokens = (template, asString) => {
  const matches = [...template.matchAll(tokenRegex)];
  template = template.replaceAll(/{{([ ]+|)([a-z0-9_-]+)/gim, "{{attribute(_context, '$2')");
  matches.forEach(match => {
    const { token } = match.groups;
    token.split('.').forEach((tokenPart, i) => {
      const isValid = isValidTokenName(tokenPart);
      if (!isValid && i > 0) {
        template = template.replaceAll(`.${tokenPart}`, `['${tokenPart}']`);
      }
    });
  });

  if (asString) {
    return template;
  }

  return template.replaceAll('}}', '| json_encode }}');
};

const processTwig = (template, variables, asString = false) => {
  try {
    template = processTokens(template, asString);
    template = Twig.twig({ data: template });
    template = template.render(variables);
    if (asString) {
      return template;
    }

    template = template.replaceAll('""', '"');

    return JSON.parse(template);
  } catch (e) {
    return undefined;
  }
};

export { processTwig, isValidToken, hasTokens, processTokens };
