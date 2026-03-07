const path = require('path');
const Webpack = require('webpack');

/**
 * @param {typeof import('@nativescript/webpack')} webpack
 */
module.exports = (webpack) => {
  webpack.mergeWebpack((config) => {
    const shimPath = path.resolve(__dirname, 'solid-web-shim.js');
    const jsxRuntimeShimPath = path.resolve(__dirname, 'solid-js-jsx-runtime-shim.js');

    if (!config.resolve) {
      config.resolve = {};
    }

    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }

    config.resolve.alias['solid-js/web$'] = shimPath;
    config.resolve.alias['solid-js/web'] = shimPath;
    config.resolve.alias['solid-js/jsx-runtime$'] = jsxRuntimeShimPath;
    config.resolve.alias['solid-js/jsx-dev-runtime$'] = jsxRuntimeShimPath;

    config.plugins = config.plugins || [];
    config.plugins.push(new Webpack.NormalModuleReplacementPlugin(/^solid-js\/web$/, shimPath));
    config.plugins.push(new Webpack.NormalModuleReplacementPlugin(/^solid-js\/jsx-runtime$/, jsxRuntimeShimPath));
    config.plugins.push(new Webpack.NormalModuleReplacementPlugin(/^solid-js\/jsx-dev-runtime$/, jsxRuntimeShimPath));
  });
};
