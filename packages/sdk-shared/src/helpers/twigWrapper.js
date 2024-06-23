// Packages
import Twig from 'twig';

const tokenRegex = /{{([ ]+|)(?<token>[a-zA-Z][a-zA-Z0-9._-]+)([ ]+|)}}/gim;

const isValidToken = token => !!token.match(tokenRegex);

const hasTokens = template => !!template.replaceAll(' ', '').match(/{{.*}}/gim);

const processTwig = (template, variables) => {
  try {
    template = Twig.twig({ data: template });

    return template.render(variables);
  } catch (e) {
    return undefined;
  }
};

export { processTwig, isValidToken, hasTokens };
