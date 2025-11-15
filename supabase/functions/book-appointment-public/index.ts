import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declaração para satisfazer o verificador de tipos do TypeScript em ambientes não-Deno.
declare const Deno: any;

// Headers CORS padrão para invocação da função a partir do navegador.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DenoEnv = (Deno as any).env;

serve(async (req: Request) => {
  // Lida com a requisição de preflight do CORS.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tokenId, name, phone, email, date, time } = await req.json();

    if (!tokenId || !name || !phone || !date || !time) {
      throw new Error('Detalhes de agendamento obrigatórios ausentes.');
    }
    
    // Usa o cliente admin para contornar as políticas de RLS.
    const supabaseAdmin = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Valida o link de uso único.
    const { data: linkData, error: linkError } = await supabaseAdmin
      .from('one_time_links')
      .select('user_id, is_used')
      .eq('id', tokenId)
      .single();

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: 'Link inválido ou expirado.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (linkData.is_used) {
      return new Response(JSON.stringify({ error: 'Este link de agendamento já foi utilizado.' }), {
        status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const adminId = linkData.user_id;

    // 2. Verifica o perfil do profissional e o limite de uso.
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan, daily_usage, last_usage_date')
      .eq('id', adminId)
      .single();
    
    if (profileError || !adminProfile) {
        throw new Error('Não foi possível encontrar o perfil do profissional.');
    }

    if (adminProfile.plan === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      const currentUsage = adminProfile.last_usage_date === today ? adminProfile.daily_usage : 0;
      if (currentUsage >= 5) {
        return new Response(JSON.stringify({ error: 'Este profissional atingiu o limite de agendamentos para hoje. Tente novamente amanhã.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    }

    // 3. Insere o novo agendamento e retorna os dados.
    const { data: newAppointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        name, email, phone, date, time, user_id: adminId, status: 'Pendente'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 4. Atualiza a contagem de uso se for um plano 'trial'.
    if (adminProfile.plan === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      const newUsage = adminProfile.last_usage_date === today ? adminProfile.daily_usage + 1 : 1;
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ daily_usage: newUsage, last_usage_date: today })
        .eq('id', adminId);
      
      if (updateProfileError) {
        // Erro não-crítico para o usuário final, mas deve ser logado.
        console.error(`CRÍTICO: Falha ao atualizar o uso para ${adminId} após o agendamento.`, updateProfileError);
      }
    }
    
    // 5. Marca o link como utilizado.
    const { error: updateLinkError } = await supabaseAdmin
      .from('one_time_links')
      .update({ is_used: true })
      .eq('id', tokenId);
    
    if (updateLinkError) {
      console.error(`CRÍTICO: Falha ao marcar o link ${tokenId} como usado após o agendamento.`, updateLinkError);
    }

    // 6. Envia uma notificação de broadcast para o dashboard do usuário.
    // Isso é necessário porque a inserção com a chave de admin (service_role) não dispara o Realtime baseado em RLS.
    const channel = supabaseAdmin.channel(`dashboard-${adminId}`);
    await channel.send({
      type: 'broadcast',
      event: 'new_public_appointment',
      payload: newAppointment,
    });


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