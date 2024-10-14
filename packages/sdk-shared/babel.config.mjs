const config = {
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    },
    development: {
      presets: [['@babel/preset-react', { runtime: 'automatic' }], ['@babel/preset-env', { modules: false }], 'minify'],
      plugins: [
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-transform-runtime',
        '@babel/plugin-transform-arrow-functions',
        '@babel/plugin-transform-template-literals'
      ]
    },
    production: {
      presets: [['@babel/preset-react', { runtime: 'automatic' }], ['@babel/preset-env', { modules: false }], 'minify'],
      plugins: [
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-transform-runtime',
        '@babel/plugin-transform-arrow-functions',
        '@babel/plugin-transform-template-literals'
      ]
    }
  }
};

export default config;
