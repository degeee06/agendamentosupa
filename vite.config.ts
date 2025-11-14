import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {},
      resolve: {
        alias: {
          // FIX: Replaced `__dirname` which is not available in ESM with a compatible equivalent.
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      }
    };
});