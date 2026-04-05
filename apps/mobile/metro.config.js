const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..'); // adjust depth to your monorepo root

const config = getDefaultConfig(projectRoot);

// Watch all packages in the monorepo
config.watchFolders = [workspaceRoot];

// Teach Metro where to resolve modules from
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];

// Tell Metro to follow symlinks (pnpm/yarn workspaces use these)
config.resolver.unstable_enableSymlinks = true;

// Allow .ts files to be resolved directly (your @repo/types points to .ts source)
config.resolver.sourceExts = [
    ...config.resolver.sourceExts,
    'ts', 'tsx', 'mts', 'cts'
];

module.exports = withNativeWind(config, { input: './global.css' });