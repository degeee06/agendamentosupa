import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // 1. Autenticar o usuário que está fazendo a chamada (o admin).
    const supabaseClient = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user: adminUser } } = await supabaseClient.auth.getUser();
    if (!adminUser) {
      throw new Error('Usuário não autenticado.');
    }

    // 2. Usar o cliente admin para verificar o cargo do autor da chamada.
    const supabaseAdmin = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single();

    if (adminError || !adminProfile) {
      throw new Error('Não foi possível verificar as permissões do administrador.');
    }
    if (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem criar usuários.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 3. Extrair os dados do novo usuário do corpo da requisição.
    const { full_name, employee_id, password } = await req.json();
    if (!full_name || !employee_id || !password) {
      throw new Error('Nome completo, nº do crachá e senha são obrigatórios.');
    }
     if (password.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres.');
    }

    // 4. Criar o novo usuário usando o cliente admin.
    const email = `employee_${employee_id}@arranchou.app`;
    
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirma o email, pois não há fluxo de email.
        user_metadata: {
            full_name: full_name,
            employee_id: employee_id,
        },
        app_metadata: {
            role: 'employee' // Todos os usuários criados aqui são funcionários.
        }
    });

    if (createError) {
      // Trata o erro específico de "usuário já existe" de forma mais amigável.
      if (createError.message.includes('User already exists')) {
          return new Response(JSON.stringify({ error: 'Um usuário com este Nº do Crachá já existe.' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 409, // 409 Conflict é um bom código de status para isso.
          });
      }
      throw createError; // Lança outros erros.
    }

    // O gatilho 'on_auth_user_created' no banco de dados irá criar automaticamente
    // a entrada correspondente na tabela 'profiles'.

    return new Response(JSON.stringify({ success: true, user: newUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201, // 201 Created é o código de status apropriado.
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});