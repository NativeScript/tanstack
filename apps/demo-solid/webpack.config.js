const path = require('path');
const webpack = require('@nativescript/webpack');

module.exports = (env) => {
  webpack.init(env);

  webpack.chainWebpack((config) => {
    config.devServer.hotOnly(true);
    config.devServer.hot(true);

    // Resolve the workspace source entry because packages/tanstack-router/solid is generated only after build.
    config.resolve.alias.set('@nativescript/tanstack-router/solid', path.resolve(__dirname, '../../packages/tanstack-router/src/solid/index.ts'));
  });

  return webpack.resolveConfig();
};
