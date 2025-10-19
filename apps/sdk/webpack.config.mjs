import path from 'path';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import HandlebarsPlugin from 'handlebars-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CompressionPlugin from 'compression-webpack-plugin';
import { WebpackAssetsManifest } from 'webpack-assets-manifest';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import PlitziPlugin from '@plitzi/plitzi-webpack';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import SpeedMeasurePlugin from 'speed-measure-webpack-plugin';
import threadLoader from 'thread-loader';
import * as sassEmbedded from 'sass-embedded';

// import PACKAGE from './package.json' assert { type: 'json' };
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json');

const smp = new SpeedMeasurePlugin();

const baseUrl = new URL('.', import.meta.url);
const DESTINATION = path.resolve(baseUrl.pathname, './dist/');

const packages = {
  '@plitzi/sdk-auth': path.resolve(baseUrl.pathname, '../../packages/sdk-auth/src'),
  '@plitzi/sdk-data-source': path.resolve(baseUrl.pathname, '../../packages/sdk-data-source/src'),
  '@plitzi/sdk-dev-tools': path.resolve(baseUrl.pathname, '../../packages/sdk-dev-tools/src'),
  '@plitzi/sdk-elements': path.resolve(baseUrl.pathname, '../../packages/sdk-elements/src'),
  '@plitzi/sdk-event-bridge': path.resolve(baseUrl.pathname, '../../packages/sdk-event-bridge/src'),
  '@plitzi/sdk-interactions': path.resolve(baseUrl.pathname, '../../packages/sdk-interactions/src'),
  '@plitzi/sdk-navigation': path.resolve(baseUrl.pathname, '../../packages/sdk-navigation/src'),
  '@plitzi/sdk-plugins': path.resolve(baseUrl.pathname, '../../packages/sdk-plugins/src'),
  '@plitzi/sdk-schema': path.resolve(baseUrl.pathname, '../../packages/sdk-schema/src'),
  '@plitzi/sdk-shared': path.resolve(baseUrl.pathname, '../../packages/sdk-shared/src'),
  '@plitzi/sdk-state': path.resolve(baseUrl.pathname, '../../packages/sdk-state/src'),
  '@plitzi/sdk-style': path.resolve(baseUrl.pathname, '../../packages/sdk-style/src'),
  '@plitzi/sdk-variables': path.resolve(baseUrl.pathname, '../../packages/sdk-variables/src')
};

// process.traceDeprecation = true // enable in case to debug node

const buildBase = (env, args) => {
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
      'ts-loader',
      '@babel/preset-env',
      '@babel/preset-react',
      '@babel/preset-typescript',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-transform-runtime',
      '@babel/plugin-transform-private-methods'
    ]
  );

  let modules = {
    entry: { 'plitzi-sdk': './src/index' },
    output: {
      pathinfo: false,
      chunkLoading: false,
      path: DESTINATION,
      filename: '[name].js',
      chunkFilename: 'plitzi-sdk-chunk-[name].js',
      library: {
        type: 'module'
      },
      crossOriginLoading: 'anonymous',
      globalObject: "(typeof self !== 'undefined' ? self : this)",
      publicPath: 'auto'
    },
    experiments: {
      outputModule: true
    },
    resolve: {
      symlinks: devMode,
      extensions: ['.js', '.mjs', '.es', '.cjs', '.ts', '.tsx'],
      alias: {
        '@modules': path.resolve('./src/modules'),
        '@components': path.resolve('./src/components'),
        handlebars: 'handlebars/dist/handlebars.min.js',
        path: false
      }
    },
    target: 'web',
    watchOptions: {
      ignored: /(node_modules|packages\/[a-z-]+\/dist)/
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          include: devMode
            ? [path.resolve(baseUrl.pathname, 'src'), ...Object.values(packages)]
            : [path.resolve(baseUrl.pathname, 'src')],
          use: [
            {
              loader: 'thread-loader',
              options: {
                poolTimeout: watch ? Infinity : 2000
              }
            },
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                happyPackMode: true
              }
            },
            {
              loader: 'babel-loader',
              options: {
                presets: [
                  '@babel/preset-env',
                  ['@babel/preset-react', { runtime: 'automatic' }], // [classic] will disable new JSX compiler and [automatic] will enable it
                  '@babel/preset-typescript'
                ],
                plugins: [
                  '@babel/plugin-proposal-class-properties',
                  '@babel/plugin-transform-runtime',
                  '@babel/plugin-transform-private-methods',
                  env.WEBPACK_SERVE && 'react-refresh/babel'
                ].filter(Boolean)
              }
            }
          ]
        },
        // Enable this only if there a .mjs complaining about imports
        {
          test: /\.m?js$/,
          resolve: { fullySpecified: false }
        },
        {
          test: /\.(png|jpg|gif|svg)$/,
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
                outputPath: 'fonts/'
              }
            }
          ]
        },
        {
          test: /\.(sa|sc|c)ss$/,
          use: [
            { loader: MiniCssExtractPlugin.loader, options: {} },
            { loader: 'css-loader', options: {} },
            'postcss-loader',
            {
              loader: 'sass-loader',
              options: {
                implementation: sassEmbedded,
                sourceMap: devMode,
                sassOptions: { quietDeps: true }
              }
            }
          ],
          exclude: /(node_modules|bower_components)\/(?!(@plitzi\/sdk-[a-z0-9_-]+)\/).*/
        }
      ]
    },
    externals: {
      react: 'react',
      'react-dom': 'react-dom',
      'react-dom/client': 'react-dom/client',
      'react-dom/server': 'react-dom/server'
    },
    plugins: [
      new webpack.DefinePlugin({
        VERSION: JSON.stringify(PACKAGE.version)
      }),
      new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /(es|pt|en).js/),
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
      }),
      new CleanWebpackPlugin({
        dry: devMode,
        verbose: devMode,
        protectWebpackAssets: false,
        cleanOnceBeforeBuildPatterns: [],
        cleanAfterEveryBuildPatterns: []
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
    modules.resolve.alias = { ...modules.resolve.alias, ...packages };
  } else {
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
      chunkFilename: 'plitzi-sdk-chunk-[name].css'
    })
  );

  return modules;
};

const buildSSR = (env, args) => {
  const modules = buildBase(env, args);

  return {
    ...modules,
    entry: { 'plitzi-sdk': './src/indexSSR.ts' },
    target: 'node',
    output: { ...modules.output, path: `${modules.output.path}/ssr/` },
    plugins: [
      new PlitziPlugin({
        isHost: true,
        exposes: [
          './src/services/hooks/usePlitziServiceContext',
          './src/modules/Component/ComponentContext',
          './src/modules/Component/ComponentProvider'
        ],
        shared: {
          react: { singleton: true, requiredVersion: false, eager: true },
          'react-dom': { singleton: true, requiredVersion: false, eager: true }
        }
      }),
      new webpack.DefinePlugin({
        VERSION: JSON.stringify(PACKAGE.version)
      }),
      new MiniCssExtractPlugin({
        filename: '[name].css',
        chunkFilename: 'plitzi-sdk-chunk-[name].css'
      })
    ]
  };
};

const buildCDN = (env, args) => {
  const modules = buildBase(env, args);

  return {
    ...modules,
    devServer: {
      compress: true,
      allowedHosts: 'all',
      hot: true,
      liveReload: false,
      historyApiFallback: true,
      static: {
        directory: path.join(process.cwd(), 'dist')
      },
      port: 3001
    },
    output: { ...modules.output, path: `${modules.output.path}/cdn/` },
    externals: {},
    plugins: [
      new PlitziPlugin({ isHost: true }),
      new HandlebarsPlugin({
        data: {
          title: '',
          jsPath: env.WEBPACK_SERVE ? '/plitzi-sdk.js' : '/cdn/plitzi-sdk.js',
          cssPath: env.WEBPACK_SERVE ? '/plitzi-sdk.css' : '/cdn/plitzi-sdk.css'
        },
        output: path.join(process.cwd(), 'dist', '[name].html'),
        entry: path.join(process.cwd(), 'index.hbs')
      }),
      ...modules.plugins
    ]
  };
};

let config;
if (process.argv.includes('onlyAnalyze')) {
  config = [buildBase];
} else if (process.argv.includes('serve')) {
  config = [buildCDN];
} else if (process.argv.includes('measure') || process.argv.includes('watch')) {
  config = [buildBase, buildCDN];
} else {
  config = [buildBase, buildSSR, buildCDN];
}

export default config;
