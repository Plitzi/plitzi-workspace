import defaultTheme from 'tailwindcss/defaultTheme';
import twConfig from '@plitzi/plitzi-ui/tailwind.config';

const config = {
  theme: {
    extend: {
      colors: twConfig.theme.extend.colors
    },
    groups: ['1', '2', '3', '4', '5'],
    fontFamily: {
      ...defaultTheme.fontFamily,
      rubik: ['Rubik', 'sans-serif']
    }
  },
  plugins: [...twConfig.plugins]
};

export default config;
