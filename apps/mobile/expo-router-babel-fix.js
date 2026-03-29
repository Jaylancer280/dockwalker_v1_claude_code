/**
 * Workaround for monorepo builds where babel-preset-expo cannot resolve
 * expo-router from root node_modules. This plugin replaces
 * process.env.EXPO_ROUTER_APP_ROOT with the correct path, matching
 * what babel-preset-expo's expo-router-plugin would do.
 */
var path = require('path');

module.exports = function (api) {
  var t = api.types;
  var appRoot = path.resolve(__dirname, 'app');

  return {
    name: 'expo-router-app-root-fix',
    visitor: {
      MemberExpression: function (nodePath, state) {
        if (
          nodePath.get('object').matchesPattern('process.env') &&
          t.isStringLiteral(nodePath.toComputedKey())
        ) {
          var key = nodePath.toComputedKey().value;
          if (key === 'EXPO_ROUTER_APP_ROOT') {
            var filename = state.filename || (state.file && state.file.opts && state.file.opts.filename) || '';
            var relativePath = path.relative(path.dirname(filename), appRoot);
            var posix = relativePath.split(path.sep).join('/');
            nodePath.replaceWith(t.stringLiteral(posix.startsWith('.') ? posix : './' + posix));
          } else if (key === 'EXPO_ROUTER_IMPORT_MODE') {
            nodePath.replaceWith(t.stringLiteral('sync'));
          }
        }
      }
    }
  };
};
