const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withRust } = require('@rejaul/react-native-rust/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

module.exports = withRust(mergeConfig(getDefaultConfig(__dirname), config));
