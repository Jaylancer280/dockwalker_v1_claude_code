const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [...(config.watchFolders || []), monorepoRoot];

// Resolve packages from both the app and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// css-interop is nested inside nativewind's node_modules — Metro can't find it
// from root-hoisted packages like expo-router. Map it explicitly.
config.resolver.extraNodeModules = {
  'react-native-css-interop': path.resolve(
    projectRoot,
    'node_modules/nativewind/node_modules/react-native-css-interop'
  ),
};

module.exports = withNativeWind(config, { input: './global.css' });
