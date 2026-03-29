/**
 * Workaround for monorepo builds where babel-preset-expo cannot resolve
 * expo-router from root node_modules. This plugin replaces
 * process.env.EXPO_ROUTER_APP_ROOT with the correct path, matching
 * what babel-preset-expo's expo-router-plugin would do.
 */
const path = require('path');

module.exports = function (api) {
  const { types: t } = api;
  const appRoot = path.resolve(__dirname, 'app');

  return {
    name: 'expo-router-app-root-fix',
    visitor: {
      MemberExpression(nodePath, state) {
        if (
          nodePath.get('object').matchesPattern('process.env') &&
          t.isStringLiteral(nodePath.toComputedKey())
        ) {
          const key = nodePath.toComputedKey().value;
          if (key === 'EXPO_ROUTER_APP_ROOT') {
            const filename = state.filename || state.file?.opts?.filename || '';
            const relativePath = path.relative(path.dirname(filename), appRoot);
            const posix = relativePath.split(path.sep).join('/');
            nodePath.replaceWith(t.stringLiteral(posix.startsWith('.') ? posix : './' + posix));
          } else if (key === 'EXPO_ROUTER_IMPORT_MODE') {
            nodePath.replaceWith(t.stringLiteral('sync'));
          }
        },
      },
    },
  };
};
