
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DenoEnv = (Deno as any).env;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseClient = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const { token } = await req.json();
    if (!token) throw new Error('Token obrigatório.');

    const supabaseAdmin = createClient(DenoEnv.get('SUPABASE_URL') ?? '', DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { error } = await supabaseAdmin
      .from('notification_tokens')
      .upsert({ token: token, user_id: user.id }, { onConflict: 'token' });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
