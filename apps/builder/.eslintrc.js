const path = require('path');

module.exports = {
  env: {
    'cypress/globals': true,
    browser: true,
    es6: true,
    jest: true
  },
  parser: '@babel/eslint-parser',
  extends: ['airbnb', 'prettier', 'plugin:cypress/recommended'],
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-react']
    },
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    moment: true,
    handlebars: true,
    google: true,
    jQuery: true,
    $: true,
    VERSION: true
  },
  ignorePatterns: ['**/node_modules/**', '**/dist/**'],
  plugins: ['react', 'cypress'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      },
      alias: [
        [
          'apollo-upload-client/createUploadLink',
          path.resolve('./node_modules/apollo-upload-client/src/createUploadLink.mjs')
        ],
        ['@pmodules', path.resolve('./src/modules/')],
        ['@pcomponents', path.resolve('./src/components/')],
        ['@plitzi/plitzi-ui-components/hooks', path.resolve('./node_modules/@plitzi/plitzi-ui-components/dist/hooks')],
        ['@plitzi/plitzi-ui-components', path.resolve('./node_modules/@plitzi/plitzi-ui-components/dist/components')]
      ]
    }
  },
  rules: {
    'react/require-default-props': 0,
    'import/no-cycle': 0,
    'import/named': 0,
    'no-loop-func': 0,
    'no-async-promise-executor': 0,
    'import/no-named-as-default-member': 0,
    'cypress/no-assigning-return-values': 'error',
    'cypress/no-unnecessary-waiting': 'error',
    'cypress/assertion-before-screenshot': 'warn',
    'cypress/no-force': 'warn',
    'cypress/no-async-tests': 'error',
    'no-alert': 0,
    'no-unused-vars': 1,
    'no-shadow': 0,
    'no-await-in-loop': 0,
    'no-underscore-dangle': 0,
    'import/no-extraneous-dependencies': 0,
    'react/require-extension': 0,
    'react/jsx-filename-extension': 0,
    'arrow-body-style': 0,
    'prefer-arrow-callback': 0,
    'func-names': 0,
    'react/forbid-prop-types': 0,
    'no-param-reassign': 0,
    'no-console': 0,
    'max-len': [2, { code: 120, ignoreTemplateLiterals: true, ignoreStrings: true }],
    'jsx-a11y/control-has-associated-label': 0,
    'react/no-unused-prop-types': 0,
    'react/jsx-one-expression-per-line': 0,
    'react/sort-comp': 0,
    'arrow-parens': ['error', 'as-needed'],
    'space-before-function-paren': 0,
    'import/prefer-default-export': 0,
    'jsx-a11y/label-has-associated-control': 0,
    'jsx-a11y/no-static-element-interactions': 0,
    'jsx-a11y/click-events-have-key-events': 0,
    'jsx-a11y/no-noninteractive-tabindex': 0,
    'import/no-named-as-default': 0,
    'react/jsx-pascal-case': 0,
    'jsx-a11y/no-noninteractive-element-interactions': 0,
    'jsx-a11y/anchor-is-valid': 0,
    'react/no-array-index-key': 0,
    'react/jsx-curly-brace-presence': 0,
    'function-paren-newline': 0,
    'no-useless-return': 0,
    'object-curly-newline': 0,
    indent: 0,
    'comma-dangle': ['error', 'never'],
    'react/prefer-stateless-function': 0,
    'operator-linebreak': ['error', 'after'],
    'react/jsx-props-no-spreading': 0,
    'react/function-component-definition': 0,
    'react/destructuring-assignment': 0,
    'class-methods-use-this': 0,
    'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
    'no-use-before-define': 0,
    'no-plusplus': 0
  }
};
