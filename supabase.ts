
// FIX: The type declarations for `import.meta.env` must be wrapped in `declare global`
// to correctly augment the global `ImportMeta` type from within a module context.
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    // FIX: Add VITE_PRODUCTION_URL to the environment variable types to resolve a TypeScript error in index.tsx.
    readonly VITE_PRODUCTION_URL: string;
    readonly VITE_MP_CLIENT_ID: string;
    readonly VITE_MP_REDIRECT_URL: string;
    readonly VITE_REVENUECAT_ANDROID_KEY: string;
    // FIX: Add missing VITE_FIREBASE_VAPID_KEY to the global ImportMetaEnv interface.
    readonly VITE_FIREBASE_VAPID_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

import { createClient } from '@supabase/supabase-js';

// Lê as variáveis de ambiente fornecidas pelo Vite/Vercel.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação para garantir que as variáveis foram carregadas.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("As variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
