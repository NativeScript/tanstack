
const webpack = require('@nativescript/webpack');
const { resolve } = require('path');

module.exports = (env) => {
  webpack.init(env);

  webpack.chainWebpack((config) => {
    config.resolve.alias.set(
      '@org/nativescript-utils',
      resolve(__dirname, `../../libs/nativescript-utils/src/index.ts`)
    );
    config.resolve.alias.set(
      '@org/state',
      resolve(__dirname, `../../libs/state/src/index.ts`)
    );
    config.resolve.alias.set(
      'solid-js/web',
      resolve(__dirname, `node_modules/solid-js/web/dist/web.js`)
    );
  });

  return webpack.resolveConfig();
};
