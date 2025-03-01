const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HandlebarsPlugin = require('handlebars-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const TerserPlugin = require('terser-webpack-plugin');
const PlitziPlugin = require('@plitzi/plitzi-webpack');
const webpack = require('webpack');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const threadLoader = require('thread-loader');

const smp = new SpeedMeasurePlugin();

const PACKAGE = require('./package.json');

const DESTINATION = path.resolve(__dirname, './dist/');

const build = (env, args) => {
  const devMode = args.mode !== 'production';
  const onlyGzip = env.onlyGzip || false;
  const onlyAnalyze = env.onlyAnalyze || false;
  const watch = env.watch || false;
  const measure = env.measure || false;

  threadLoader.warmup(
    {
      poolTimeout: watch ? Infinity : 2000
    },
    [
      // modules to load
      // can be any module, i. e.
      'babel-loader',
      '@babel/preset-env',
      '@babel/preset-react',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-transform-runtime',
      '@babel/plugin-transform-async-to-generator',
      '@babel/plugin-transform-private-methods'
    ]
  );

  let modules = {
    entry: { 'plitzi-builder': './src/index.js' },
    output: {
      pathinfo: false,
      path: DESTINATION,
      filename: '[name].js',
      chunkFilename: 'plitzi-builder-chunk-[name].js',
      library: 'PlitziBuilder',
      libraryTarget: 'umd',
      crossOriginLoading: 'anonymous',
      globalObject: "(typeof self !== 'undefined' ? self : this)",
      publicPath: 'auto'
    },
    watchOptions: {
      ignored: ['**/*.test.js', '**/*.spec.js']
    },
    resolve: {
      symlinks: false,
      extensions: ['.js', '.mjs', '.es', '.cjs'],
      alias: {
        '@node_modules': path.resolve('node_modules'),
        '@pmodules': path.resolve('./src/modules'),
        '@pcomponents': path.resolve('./src/components'),
        path: false
      }
    },
    target: 'web',
    devServer: {
      compress: true,
      allowedHosts: 'all',
      hot: true,
      liveReload: false,
      historyApiFallback: true,
      static: {
        directory: path.join(__dirname, 'dist')
      },
      port: 3000
    },
    module: {
      rules: [
        {
          test: /(\.jsx|\.js)$/,
          exclude: /(node_modules|bower_components)\/(?!(@plitzi\/sdk-[a-z0-9_-]+)\/).*/,
          use: [
            {
              loader: 'thread-loader',
              options: {
                poolTimeout: watch ? Infinity : 2000
              }
            },
            {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]], // [classic] will disable new JSX compiler and [automatic] will enable it
                plugins: [
                  '@babel/plugin-proposal-class-properties',
                  '@babel/plugin-transform-runtime',
                  '@babel/plugin-transform-async-to-generator',
                  '@babel/plugin-transform-private-methods',
                  env.WEBPACK_SERVE && 'react-refresh/babel'
                ].filter(Boolean)
              }
            }
          ]
        },
        {
          test: /\.(png|jpg|gif|svg|...)$/,
          loader: 'url-loader',
          exclude: /(node_modules|bower_components)\/(?!(@plitzi\/sdk-[a-z0-9_-]+)\/).*/
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]',
                outputPath: 'assets/'
              }
            }
          ]
        },
        {
          test: /\.(sa|sc)ss$/,
          use: [
            { loader: MiniCssExtractPlugin.loader, options: {} },
            { loader: 'css-loader', options: {} },
            'postcss-loader',
            {
              loader: 'sass-loader',
              options: {
                implementation: require('sass-embedded'),
                sourceMap: devMode,
                sassOptions: { quietDeps: true }
              }
            }
          ],
          exclude: /(node_modules|bower_components)\/(?!(@plitzi\/sdk-[a-z0-9_-]+)\/).*/
        },
        {
          test: /\.(c)ss$/,
          use: [
            { loader: MiniCssExtractPlugin.loader, options: {} },
            { loader: 'css-loader', options: { url: false } },
            'postcss-loader'
          ]
        }
      ]
    },
    plugins: [
      new PlitziPlugin({
        isHost: true,
        shared: {
          react: { singleton: true, requiredVersion: false, eager: true },
          'react-dom': { singleton: true, requiredVersion: false, eager: true },
          'react-router': { singleton: true, requiredVersion: false, eager: true },
          'react-router-dom': { singleton: true, requiredVersion: false, eager: true }
        }
      }),
      new webpack.DefinePlugin({
        VERSION: JSON.stringify(PACKAGE.version)
      }),
      new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /(es|pt|en).js/),
      new HandlebarsPlugin({
        data: {
          title: '',
          jsPath: '/plitzi-builder.js',
          cssPath: '/plitzi-builder.css'
        },
        output: path.join(process.cwd(), 'dist', '[name].html'),
        entry: path.join(process.cwd(), 'index.hbs')
      }),
      new WebpackAssetsManifest({
        output: 'app-manifest.json',
        integrity: true,
        integrityHashes: ['sha384'],
        sortManifest: false,
        transform: assets => ({
          accessGroup: [],
          author: 'Carlos Rodriguez <crodriguez@plitzi.com>',
          created: '',
          updated: '',
          pluginVersion: PACKAGE.version,
          assets
        })
      }),
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1
      }),
      new CompressionPlugin({
        algorithm: 'gzip',
        filename: onlyGzip ? '[path][base]' : '[path][base].gz',
        deleteOriginalAssets: onlyGzip,
        test: /\.js$|\.css$|\.html$/,
        threshold: 0,
        minRatio: 0.8
      })
    ],
    stats: {
      colors: true
    }
  };

  if (env.WEBPACK_SERVE) {
    modules.plugins.push(new ReactRefreshWebpackPlugin());
  }

  if (devMode) {
    modules.devtool = 'cheap-module-source-map';
  } else {
    modules.plugins.push(new CleanWebpackPlugin());
    modules.optimization = {
      usedExports: true,
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            output: {
              comments: /(webpackIgnore:true|webpackIgnore: true)/
            }
          },
          extractComments: false
        })
      ]
    };
  }

  if (onlyAnalyze) {
    modules.plugins.push(new BundleAnalyzerPlugin({ analyzerPort: 4001, defaultSizes: 'stat' }));
  }

  if (measure) {
    modules = smp.wrap(modules);
  }

  // https://github.com/stephencookdev/speed-measure-webpack-plugin/issues/167
  modules.plugins.push(
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: 'plitzi-builder-chunk-[name].css'
    })
  );

  return modules;
};

module.exports = [build];
