module.exports = (/* { env } */) => {
  return {
    plugins: {
      tailwindcss: './tailwind.config',
      // 'cssnano': env === 'development' ? false : { preset: 'default' },
      autoprefixer: {}
    }
  };
};
