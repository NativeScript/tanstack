const path = require('path');

/**
 * @param {typeof import('@nativescript/webpack')} webpack
 */
module.exports = (webpack) => {
  webpack.mergeWebpack((config) => {
    const shimPath = path.resolve(__dirname, 'solid-web-shim.js');

    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    // `$` keeps the match exact so `@solidjs/web/*` subpaths resolve normally.
    config.resolve.alias['@solidjs/web$'] = shimPath;
  });
};
