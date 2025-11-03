import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          external: [/^@capacitor\/.*/],
        },
      },
      define: {},
      resolve: {
        alias: {
          // Fix: `__dirname` is not available in ES modules. `path.resolve()` correctly points to the project root.
          '@': path.resolve(),
        }
      }
    };
});