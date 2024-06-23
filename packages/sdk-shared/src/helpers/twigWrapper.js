// Packages
import Twig from 'twig';

const tokenRegex = /{{([ ]+|)(?<token>[a-zA-Z][a-zA-Z0-9._-]+)([ ]+|)}}/gim;

const isValidToken = token => !!token.match(tokenRegex);

const hasTokens = template => !!template.replaceAll(' ', '').match(/{{.*}}/gim);

const processTwig = (template, variables = {}, keepEmptyTokens = false) => {
  try {
    if (keepEmptyTokens) {
      [...template.matchAll(tokenRegex)].forEach(token => {
        template = template.replace(token[0], `{{ ${token.groups.token} | default('${token[0]}') }}`);
      });
    }

    template = Twig.twig({ data: template });

    return template.render(variables);
  } catch (e) {
    return undefined;
  }
};

export { processTwig, isValidToken, hasTokens };
