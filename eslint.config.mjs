import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  process: 'readonly',
  require: 'readonly',
  module: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
};

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      'no-console': ['warn'],
      indent: ['error', 2],
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: { globals: nodeGlobals, sourceType: 'commonjs' },
    rules: {
      'no-console': ['warn'],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'example/', 'react-native-awesome-library-example/', 'test/'],
  },
);
