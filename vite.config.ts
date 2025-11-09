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
      define: {},
      resolve: {
        alias: {
          // FIX: The original `process.cwd()` caused a TypeScript type error because the
          // full Node.js types were not available. `path.resolve()` without arguments
          // correctly resolves to the project root and avoids this issue.
          '@': path.resolve(),
        }
      }
    };
});