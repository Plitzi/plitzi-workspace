export type TemplateParams = {
  title: string;
  html: string;
  offlineData: string;
  jsPath: string;
  cssPath: string;
  builderJsPath?: string;
  builderCssPath?: string;
  pluginsJsPath?: string;
  react: string;
  reactJsx: string;
  reactDom: string;
  reactDomClient: string;
};

/**
 * Renders the full HTML page shell as a TypeScript template literal,
 * replacing the EJS template from the original Express-based SSR service.
 */
export const renderTemplate = (params: TemplateParams): string => {
  const {
    title,
    html,
    offlineData,
    jsPath,
    cssPath,
    builderCssPath,
    pluginsJsPath,
    react,
    reactJsx,
    reactDom,
    reactDomClient
  } = params;

  const importmapReact = JSON.stringify(
    {
      imports: {
        react,
        'react-dom': reactDom,
        'react-dom/client': reactDomClient,
        'react/jsx-runtime': reactJsx,
        '@plitzi/plitzi-sdk': jsPath
      }
    },
    null,
    2
  );

  const builderStylesheet = builderCssPath
    ? `    <link href="${builderCssPath}" rel="preload" as="style" />\n    <link href="${builderCssPath}" rel="stylesheet" />`
    : '';

  const pluginsScript = pluginsJsPath
    ? `      import { PlitziBuilder } from '${pluginsJsPath}';\n\n      render('plitzi', ${offlineData}, { plitziBuilder: PlitziBuilder }, false, true);`
    : `      render('plitzi', ${offlineData}, {}, false, true);`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="shortcut icon" href="https://cdn.plitzi.com/resources/img/favicon.svg" />

    <link rel="preconnect" href="https://fonts.gstatic.com" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://cdn.plitzi.com" />

    <link rel="modulepreload" href="${react}" crossorigin />
    <link rel="modulepreload" href="${reactDom}" crossorigin />

    <script type="importmap">
      ${importmapReact}
    </script>

    <link
      rel="preload"
      href="https://fonts.googleapis.com/icon?family=Material+Icons"
      as="style"
      onload="this.onload=null;this.rel='stylesheet';"
    />
    <noscript>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
    </noscript>

    <link href="${cssPath}" rel="preload" as="style" />
    <link href="${cssPath}" rel="stylesheet" />
${builderStylesheet}
  </head>

  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="plitzi" class="plitzi-root-container">${html}</div>
    <script type="module">
      import { render } from '${jsPath}';
${pluginsScript}
    </script>
  </body>
</html>`;
};
