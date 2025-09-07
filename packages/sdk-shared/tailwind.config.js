import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';
import { colors } from '@plitzi/plitzi-ui/tailwind';

const config = {
  theme: {
    extend: {
      colors
    },
    groups: ['1', '2', '3', '4', '5'],
    fontFamily: {
      ...defaultTheme.fontFamily,
      rubik: ['Rubik', 'sans-serif']
    }
  },
  plugins: [
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

export default config;
