const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const webpack = require('webpack');
const PACKAGE = require('../package.json');

module.exports = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)', '../stories/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-essentials', '@storybook/addon-interactions'],
  webpackFinal: async (config, { configType }) => {
    config.resolve = {
      ...config.resolve,
      symlinks: false,
      alias: {
        ...config.resolve.alias,
        fs: false,
        react: path.resolve('node_modules/react'),
        'react-dom': path.resolve('node_modules/react-dom'),
        '@modules': path.resolve('src/modules'),
        '@components': path.resolve('src/components')
      }
    };

    config.module.rules = config.module.rules.filter(rule => rule.sideEffects === undefined);

    config.module.rules.push({
      test: /(\.jsx|\.js)$/,
      exclude: /(node_modules|bower_components)/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            '@babel/preset-env',
            [
              '@babel/preset-react',
              {
                runtime: 'automatic'
              }
            ]
          ],
          // [classic] will disable new JSX compiler and [automatic] will enable it
          plugins: ['@babel/plugin-proposal-class-properties']
        }
      }
    });

    config.module.rules.push({
      test: /\.(sa|sc|c)ss$/,
      use: [
        {
          loader: MiniCssExtractPlugin.loader,
          options: {}
        },
        {
          loader: 'css-loader',
          options: {}
        },
        'postcss-loader',
        {
          loader: 'sass-loader',
          options: {
            sourceMap: true
          }
        }
      ],
      exclude: /(node_modules|bower_components)/
    });

    config.plugins = [
      ...config.plugins,
      new MiniCssExtractPlugin({}),
      new webpack.DefinePlugin({
        VERSION: JSON.stringify(PACKAGE.version)
      })
    ];

    // Return the altered config
    return config;
  },
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  docs: {
    autodocs: 'tag'
  }
};
