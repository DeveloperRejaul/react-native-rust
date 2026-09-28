import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ include: /\.(tsx?|jsx?)$/ })],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
  },
  define: {
    global: 'globalThis',
    __DEV__: JSON.stringify(true),
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: ['.web.js', '.web.tsx', '.js', '.tsx'],
      loader: { '.js': 'jsx' },
    },
    include: ['react-native-web'],
  },
});
