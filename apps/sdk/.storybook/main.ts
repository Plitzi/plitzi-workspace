import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    {
      directory: '../stories',
      files: '**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Components'
    }
  ],
  addons: ['@storybook/addon-links'],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  core: {
    disableTelemetry: true
  }
};

export default config;
