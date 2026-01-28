// Importa os módulos Deno necessários.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";

// Declaração para satisfazer o verificador de tipos do TypeScript.
declare const Deno: any;

// Headers CORS padrão.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DenoEnv = (Deno as any).env;

// Função auxiliar para obter um token de acesso OAuth2 a partir da chave da conta de serviço.
async function getAccessToken() {
  const serviceAccountJSON = DenoEnv.get('FCM_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountJSON) {
    throw new Error('O segredo FCM_SERVICE_ACCOUNT_KEY não está configurado no Supabase.');
  }

  const serviceAccount = JSON.parse(serviceAccountJSON);

  // Formata a chave privada para importação.
  const privateKeyData = atob(
    serviceAccount.private_key
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\\n/g, '') // FIX: Correctly remove escaped newlines from the environment secret.
  );
  const privateKeyBuffer = new Uint8Array(privateKeyData.length);
  for (let i = 0; i < privateKeyData.length; i++) {
    privateKeyBuffer[i] = privateKeyData.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );

  // Cria o JWT para solicitar o token de acesso.
  const jwt = await create({ alg: "RS256", typ: "JWT" }, {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: getNumericDate(3600), // Expira em 1 hora
    iat: getNumericDate(0),
  }, key);

  // Solicita o token de acesso ao Google.
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Erro ao obter token de acesso: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}


// Função para enviar notificações push usando a API v1 do FCM.
const sendPushNotification = async (supabaseAdmin: any, userId: string, title: string, body: string) => {
  try {
    const { data: tokensData, error: tokensError } = await supabaseAdmin
      .from('notification_tokens')
      .select('token')
      .eq('user_id', userId);

    if (tokensError) throw tokensError;
    if (!tokensData || tokensData.length === 0) {
      console.log(`Nenhum token de notificação encontrado para o usuário: ${userId}`);
      return;
    }

    const accessToken = await getAccessToken();
    const serviceAccount = JSON.parse(DenoEnv.get('FCM_SERVICE_ACCOUNT_KEY'));
    const projectId = serviceAccount.project_id;
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const sendPromises = tokensData.map((t: { token: string }) => {
      const message = {
        message: {
          token: t.token,
          notification: {
            title: title,
            body: body,
          },
        },
      };

      return fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    });

    const responses = await Promise.all(sendPromises);
    
    responses.forEach(async (response, index) => {
        if (!response.ok) {
            console.error(`Erro ao enviar notificação para o token ${tokensData[index].token}: ${response.statusText}`, await response.text());
        }
    });

    console.log(`Tentativa de envio de ${responses.length} notificações concluída.`);

  } catch (error) {
    console.error('Erro inesperado na função sendPushNotification:', error.message);
  }
};


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

    // 2. Verifica o perfil do profissional (Limites) E Perfil de Negócio (Preço) E Conexão MP.
    const [profileRes, businessRes, mpRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('plan, daily_usage, last_usage_date').eq('id', adminId).single(),
        supabaseAdmin.from('business_profiles').select('service_price').eq('user_id', adminId).single(),
        supabaseAdmin.from('mp_connections').select('access_token').eq('user_id', adminId).single()
    ]);
    
    const adminProfile = profileRes.data;
    const businessProfile = businessRes.data;
    const mpConnection = mpRes.data;

    if (profileRes.error || !adminProfile) {
        throw new Error('Não foi possível encontrar o perfil do profissional.');
    }

    // Verifica limite do plano Trial
    if (adminProfile.plan === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      const currentUsage = adminProfile.last_usage_date === today ? adminProfile.daily_usage : 0;
      if (currentUsage >= 5) {
        return new Response(JSON.stringify({ error: 'Este profissional atingiu o limite de agendamentos para hoje. Tente novamente amanhã.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    }

    // 3. Determina o status inicial
    // Se preço > 0 E tem conta conectada -> Aguardando Pagamento
    // Se preço == 0 OU não tem conta -> Confirmado
    const servicePrice = businessProfile?.service_price || 0;
    const hasMpConnection = !!mpConnection?.access_token;
    
    let initialStatus = 'Aguardando Pagamento';
    if (servicePrice <= 0 || !hasMpConnection) {
        initialStatus = 'Confirmado';
    }

    // 4. Insere o novo agendamento
    const { data: newAppointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        name, email, phone, date, time, user_id: adminId, status: initialStatus
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 5. Atualiza a contagem de uso se for um plano 'trial'.
    if (adminProfile.plan === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      const newUsage = adminProfile.last_usage_date === today ? adminProfile.daily_usage + 1 : 1;
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ daily_usage: newUsage, last_usage_date: today })
        .eq('id', adminId);
      
      if (updateProfileError) {
        console.error(`CRÍTICO: Falha ao atualizar o uso para ${adminId} após o agendamento.`, updateProfileError);
      }
    }
    
    // 6. Marca o link como utilizado E vincula o appointment_id.
    const { error: updateLinkError } = await supabaseAdmin
      .from('one_time_links')
      .update({ 
        is_used: true,
        appointment_id: newAppointment.id 
      })
      .eq('id', tokenId);
    
    if (updateLinkError) {
      console.error(`CRÍTICO: Falha ao marcar o link ${tokenId} como usado após o agendamento.`, updateLinkError);
    }

    // 7. Envia uma notificação de broadcast para o dashboard do usuário.
    const channel = supabaseAdmin.channel(`dashboard-${adminId}`);
    await channel.send({
      type: 'broadcast',
      event: 'new_public_appointment',
      payload: newAppointment,
    });
    
    // Notificação Push:
    // Se já confirmou (grátis), avisa que confirmou. Se pendente, avisa que é pendente.
    const formattedDate = new Date(date + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    let pushTitle = 'Novo Agendamento';
    let pushBody = `${name} agendou para ${formattedDate} às ${time}.`;

    if (initialStatus === 'Aguardando Pagamento') {
        pushTitle = 'Novo Agendamento (Pendente)';
        pushBody = `${name} iniciou um agendamento. Aguardando pagamento.`;
    } else {
        pushTitle = 'Novo Agendamento Confirmado!';
        pushBody = `${name} agendou para ${formattedDate} às ${time}.`;
    }

    await sendPushNotification(
      supabaseAdmin,
      adminId,
      pushTitle,
      pushBody
    );

    return new Response(JSON.stringify({ success: true, appointment: newAppointment }), {
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