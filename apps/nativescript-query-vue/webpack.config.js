const webpack = require("@nativescript/webpack");
const { resolve } = require('path');

module.exports = (env) => {
	webpack.init(env);
	webpack.useConfig('vue');

	webpack.chainWebpack(config => {
		config.resolve.alias.set('@org/nativescript-utils', resolve(__dirname, `../../libs/nativescript-utils/src/index.ts`));
		config.resolve.alias.set('@org/state', resolve(__dirname, `../../libs/state/src/index.ts`));
	});
	
	return webpack.resolveConfig();
};
