import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declara Deno para satisfazer o verificador de tipos do TypeScript.
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DenoEnv = (Deno as any).env;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Autentica o usuário que está chamando a função.
    const supabaseClient = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    // 2. Extrai o token do corpo da requisição.
    const { token } = await req.json();
    if (!token) {
      throw new Error('O token de notificação push é obrigatório.');
    }

    // 3. Inicializa o cliente admin para contornar a RLS.
    const supabaseAdmin = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Usa o `upsert` no token. Se o token já existir, atualiza o `user_id`
    // para o do usuário autenticado no momento. Isso re-associa corretamente um dispositivo
    // ao novo usuário que acabou de fazer login.
    const { error } = await supabaseAdmin
      .from('notification_tokens')
      .upsert({ token: token, user_id: user.id }, { onConflict: 'token' });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
