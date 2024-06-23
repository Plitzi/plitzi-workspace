// Packages
import Twig from 'twig';

const tokenRegex = /{{([ ]+|)(?<token>[a-zA-Z][a-zA-Z0-9._-]+)([ ]+|)}}/gim;

const isValidToken = token => !!token.match(tokenRegex);

const hasTokens = template => !!template.replaceAll(' ', '').match(/{{.*}}/gim);

const processTwig = (template, variables = {}, keepEmptyTokens = false) => {
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

    templateParsed = Twig.twig({ data: templateParsed });

    return templateParsed.render(variables);
  } catch (e) {
    return template;
  }
};

export { processTwig, isValidToken, hasTokens };
