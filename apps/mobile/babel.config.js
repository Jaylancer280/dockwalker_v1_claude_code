module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Workaround: in monorepo builds, babel-preset-expo's expo-router plugin
      // fails to load because expo-router is in apps/mobile/node_modules/ but
      // babel-preset-expo is hoisted to root node_modules/. This plugin provides
      // the same EXPO_ROUTER_APP_ROOT replacement.
      './expo-router-babel-fix',
    ],
  };
};
