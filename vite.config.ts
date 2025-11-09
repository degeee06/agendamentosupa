import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({ 
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
          manifest: {
            name: 'Oubook',
            short_name: 'Oubook',
            description: 'A maneira mais inteligente de gerenciar seus agendamentos.',
            theme_color: '#000000',
            background_color: '#000000',
            display: 'fullscreen',
            start_url: '/',
            icons: [
              {
                src: 'https://cdn.vitbl.com/blob/vitbl/TRVJAKfTxkVINMhTb5Ql.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'https://cdn.vitbl.com/blob/vitbl/TRVJAKfTxkVINMhTb5Ql.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          }
        })
      ],
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});