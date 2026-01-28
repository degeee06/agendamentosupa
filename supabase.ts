
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_PRODUCTION_URL: string;
    readonly VITE_MP_CLIENT_ID: string;
    readonly VITE_MP_REDIRECT_URL: string;
    readonly VITE_REVENUECAT_ANDROID_KEY: string;
    readonly VITE_FIREBASE_VAPID_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("As variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
