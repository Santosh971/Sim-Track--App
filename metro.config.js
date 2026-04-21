const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const watchFolders = [path.resolve(projectRoot, 'src')];

const config = {
  watchFolders,
  resolver: {
    extraNodeModules: {
      '@api': path.resolve(projectRoot, 'src/api'),
      '@components': path.resolve(projectRoot, 'src/components'),
      '@config': path.resolve(projectRoot, 'src/config'),
      '@constants': path.resolve(projectRoot, 'src/constants'),
      '@context': path.resolve(projectRoot, 'src/context'),
      '@hooks': path.resolve(projectRoot, 'src/hooks'),
      '@models': path.resolve(projectRoot, 'src/models'),
      '@navigation': path.resolve(projectRoot, 'src/navigation'),
      '@screens': path.resolve(projectRoot, 'src/screens'),
      '@services': path.resolve(projectRoot, 'src/services'),
      '@storage': path.resolve(projectRoot, 'src/storage'),
      '@native': path.resolve(projectRoot, 'src/native'),
      '@utils': path.resolve(projectRoot, 'src/utils'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);