const { join } = require('path');
const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    // join(__dirname, "src/**/!(*.stories|*.spec).{js,html}")
    join(__dirname, 'src/**/*.{js,html}'),
    join(__dirname, 'node_modules/@plitzi/plitzi-ui-components/dist/**/!(*.stories|*.spec).{js,html}')
  ],
  theme: {
    extend: {},
    groups: ['1', '2', '3', '4', '5'],
    fontFamily: {
      ...defaultTheme.fontFamily,
      rubik: ['Rubik', 'sans-serif']
    },
    colors: {
      ...defaultTheme.colors({ colors }),
      transparent: 'transparent',
      current: 'currentColor',
      primary: {
        50: '',
        100: '',
        200: '',
        300: '',
        400: '',
        500: '',
        600: '',
        700: '',
        800: '',
        900: ''
      },
      blue: {
        50: '#f7fafb',
        100: '#e3f1fc',
        200: '#c4dbfa',
        300: '#9ab8f2',
        400: '#7290e7',
        500: '#5b6bdf',
        600: '#4a4fcf',
        700: '#393bad',
        800: '#28287f',
        900: '#16194f'
      },
      indigo: {
        50: '#f9fafb',
        100: '#edf0fb',
        200: '#d9d7f8',
        300: '#b8b1ed',
        400: '#9d87e0',
        500: '#8462d4',
        600: '#6c46c0',
        700: '#51349c',
        800: '#37246e',
        900: '#1e1641'
      },
      purple: {
        50: '#fcfbfb',
        100: '#f8f0f6',
        200: '#f0d2ed',
        300: '#e0a8d6',
        400: '#d77aba',
        500: '#c355a1',
        600: '#a83a81',
        700: '#802b5f',
        800: '#591e3e',
        900: '#331322'
      },
      cerise: {
        50: '#fdfcfb',
        100: '#fbf1ee',
        200: '#f7d0dc',
        300: '#eca4b8',
        400: '#e8738f',
        500: '#da4f6d',
        600: '#c2354e',
        700: '#9a2838',
        800: '#6e1c25',
        900: '#421114'
      },
      coral: {
        50: '#fcfbfa',
        100: '#faf1e6',
        200: '#f6d5cb',
        300: '#e9aa9f',
        400: '#df7b70',
        500: '#cd574c',
        600: '#b23d33',
        700: '#8a2d27',
        800: '#601f1b',
        900: '#3a1310'
      },
      ochre: {
        50: '#fcfbf8',
        100: '#f9f0dc',
        200: '#f3d9b5',
        300: '#e1b282',
        400: '#ce8552',
        500: '#b56231',
        600: '#974820',
        700: '#73361a',
        800: '#4e2513',
        900: '#31160d'
      },
      olive: {
        50: '#fafaf6',
        100: '#f5f0dc',
        200: '#e9deb5',
        300: '#cbbb81',
        400: '#a29251',
        500: '#82722f',
        600: '#67581f',
        700: '#4f411a',
        800: '#352c14',
        900: '#221b0e'
      },
      wenge: {
        50: '#f8f9f7',
        100: '#eef0ec',
        200: '#d9e0d6',
        300: '#b0bfac',
        400: '#7b987e',
        500: '#5d7857',
        600: '#4a5e3e',
        700: '#3a4630',
        800: '#283023',
        900: '#191d18'
      },
      navy: {
        50: '#f5f9f9',
        100: '#e2f1f9',
        200: '#bee0f1',
        300: '#8dc1dd',
        400: '#569cc3',
        500: '#407aa9',
        600: '#35608e',
        700: '#2b486e',
        800: '#1e304d',
        900: '#121d32'
      },
      cyan: {
        50: '#f6f9fa',
        100: '#e0f1fb',
        200: '#bddef8',
        300: '#8ebdec',
        400: '#5e97dd',
        500: '#4874ce',
        600: '#3b58b9',
        700: '#2f4296',
        800: '#212c6b',
        900: '#131b44'
      }
    }
  },
  plugins: [
    // eslint-disable-next-line global-require
    require('@tailwindcss/forms'),
    plugin(function ({ addVariant, e }) {
      addVariant('not-first', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.${e(`not-first${separator}${className}`)}:not(:first-child)`;
        });
      });
    }),
    plugin(function ({ addVariant, e }) {
      addVariant('not-last', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.${e(`not-last${separator}${className}`)}:not(:last-child)`;
        });
      });
    }),
    plugin(function ({ addVariant, e }) {
      addVariant('not-hover', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.${e(`not-hover${separator}${className}`)}:not(:hover)`;
        });
      });
    }),
    plugin(({ addVariant, theme }) => {
      const groups = theme('groups') || [];

      groups.forEach(group => {
        addVariant(`group-${group}-hover`, () => {
          return `:merge(.group-${group}):hover &`;
        });
      });
    })
  ]
};
