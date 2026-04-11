const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the monorepo root for shared packages
config.watchFolders = [monorepoRoot];

// 2. Let Metro find node_modules in both the mobile dir and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Ensure Metro knows the project root is the mobile directory
config.projectRoot = projectRoot;

module.exports = config;
