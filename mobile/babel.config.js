module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Explicitly include expo-router babel plugin because in our monorepo,
      // babel-preset-expo is hoisted to root node_modules but expo-router
      // is in mobile/node_modules. The preset's hasModule('expo-router') check
      // fails from the root context, so we add the internal plugin manually.
      require("babel-preset-expo/build/expo-router-plugin").expoRouterBabelPlugin,
    ],
  };
};
