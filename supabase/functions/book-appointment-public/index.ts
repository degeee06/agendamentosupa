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
  try {
    let serviceAccountJSON = DenoEnv.get('FCM_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountJSON) {
      throw new Error('Secret FCM_SERVICE_ACCOUNT_KEY ausente.');
    }

    serviceAccountJSON = serviceAccountJSON.trim();
    if (serviceAccountJSON.startsWith('"') && serviceAccountJSON.endsWith('"')) {
       serviceAccountJSON = serviceAccountJSON.slice(1, -1);
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountJSON);
        if (typeof serviceAccount === 'string') {
            serviceAccount = JSON.parse(serviceAccount);
        }
    } catch (e) {
        console.error("Erro de Parse JSON:", e);
        throw new Error('Falha ao fazer parse do JSON do FCM_SERVICE_ACCOUNT_KEY.');
    }

    if (!serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('JSON da conta de serviço incompleto.');
    }

    let privateKey = serviceAccount.private_key;
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const privateKeyBody = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '');

    const privateKeyBase64 = privateKeyBody.replace(/\s/g, '');
    const privateKeyData = atob(privateKeyBase64);
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

    const jwt = await create({ alg: "RS256", typ: "JWT" }, {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    }, key);

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
      throw new Error(`Google Auth Falhou: ${JSON.stringify(tokenData)}`);
    }

    return { accessToken: tokenData.access_token, projectId: serviceAccount.project_id };
  } catch (err) {
    console.error("Erro CRÍTICO em getAccessToken:", err);
    throw err;
  }
}


// Função para enviar notificações push usando a API v1 do FCM com auto-limpeza de tokens inválidos.
const sendPushNotification = async (supabaseAdmin: any, userId: string, title: string, body: string) => {
  console.log(`Iniciando envio de notificação para UserID: ${userId}`);
  
  try {
    const { data: tokensData, error: tokensError } = await supabaseAdmin
      .from('notification_tokens')
      .select('token')
      .eq('user_id', userId);

    if (tokensError) {
        return { success: false, error: 'Erro DB: ' + tokensError.message };
    }
    
    if (!tokensData || tokensData.length === 0) {
      return { success: false, error: 'Nenhum token encontrado.' };
    }

    let accessToken, projectId;
    try {
        const auth = await getAccessToken();
        accessToken = auth.accessToken;
        projectId = auth.projectId;
    } catch (e) {
        return { success: false, error: 'Erro Auth Google: ' + e.message };
    }

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const sendPromises = tokensData.map(async (t: { token: string }) => {
      const message = {
        message: {
          token: t.token,
          notification: { title, body },
        },
      };

      try {
          const res = await fetch(fcmEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          });
          
          if (!res.ok) {
              const errorText = await res.text();
              console.error(`FCM Rejeitou token ${t.token.substring(0, 10)}...: ${res.status}`, errorText);
              
              // LÓGICA DE AUTOCORREÇÃO (SELF-HEALING)
              // Se o token for inválido (404 / UNREGISTERED / INVALID_ARGUMENT), removemos do banco.
              let errorCode = '';
              try {
                  const errorJson = JSON.parse(errorText);
                  errorCode = errorJson.error?.details?.[0]?.errorCode || errorJson.error?.status;
              } catch (e) {}

              if (res.status === 404 || errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
                  console.log(`🗑️ Removendo token inválido do banco: ${t.token.substring(0, 10)}...`);
                  await supabaseAdmin.from('notification_tokens').delete().eq('token', t.token);
                  return { success: false, error: 'Token removido (Inválido/Expirado)' };
              }

              return { success: false, error: `FCM Error: ${errorText}` };
          } else {
              return { success: true };
          }
      } catch (fetchErr) {
          return { success: false, error: 'Network Error: ' + fetchErr.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successes = results.filter(r => r.success).length;
    console.log(`Envio concluído. Sucessos: ${successes}/${results.length}`);
    
    // Se pelo menos 1 deu certo, consideramos sucesso geral, mesmo que tokens velhos tenham sido deletados.
    return { success: successes > 0, results };

  } catch (error) {
    console.error('Erro fatal em sendPushNotification:', error);
    return { success: false, error: error.message };
  }
};


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const reqBody = await req.json();
    
    const supabaseAdmin = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- MODO DE TESTE ---
    if (reqBody.action === 'test-notification') {
        const { userId } = reqBody;
        if (!userId) throw new Error('UserId obrigatório.');
        
        const result = await sendPushNotification(
            supabaseAdmin, 
            userId, 
            'Teste de Notificação', 
            'Se você está lendo isso, a configuração está correta! 🚀'
        );
        
        return new Response(JSON.stringify({ success: result.success, details: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // --- FLUXO NORMAL DE AGENDAMENTO ---
    const { tokenId, name, phone, email, date, time } = reqBody;

    if (!tokenId || !name || !phone || !date || !time) {
      throw new Error('Dados incompletos.');
    }
    
    const { data: linkData, error: linkError } = await supabaseAdmin
      .from('one_time_links')
      .select('user_id, is_used')
      .eq('id', tokenId)
      .single();

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: 'Link inválido.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (linkData.is_used) {
      return new Response(JSON.stringify({ error: 'Link já utilizado.' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const adminId = linkData.user_id;

    const [profileRes, businessRes, mpRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('plan, daily_usage, last_usage_date').eq('id', adminId).single(),
        supabaseAdmin.from('business_profiles').select('service_price').eq('user_id', adminId).single(),
        supabaseAdmin.from('mp_connections').select('access_token').eq('user_id', adminId).single()
    ]);
    
    const adminProfile = profileRes.data;
    const businessProfile = businessRes.data;
    const mpConnection = mpRes.data;

    if (!adminProfile) throw new Error('Perfil profissional não encontrado.');

    if (adminProfile.plan === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      const currentUsage = adminProfile.last_usage_date === today ? adminProfile.daily_usage : 0;
      if (currentUsage >= 5) {
        return new Response(JSON.stringify({ error: 'Limite diário do profissional atingido.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    }

    const servicePrice = businessProfile?.service_price || 0;
    const hasMpConnection = !!mpConnection?.access_token;
    
    let initialStatus = 'Aguardando Pagamento';
    if (servicePrice <= 0 || !hasMpConnection) {
        initialStatus = 'Confirmado';
    }

    const { data: newAppointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        name, email, phone, date, time, user_id: adminId, status: initialStatus
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (adminProfile.plan === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      const newUsage = adminProfile.last_usage_date === today ? adminProfile.daily_usage + 1 : 1;
      await supabaseAdmin.from('profiles').update({ daily_usage: newUsage, last_usage_date: today }).eq('id', adminId);
    }
    
    await supabaseAdmin.from('one_time_links').update({ is_used: true, appointment_id: newAppointment.id }).eq('id', tokenId);
    
    const channel = supabaseAdmin.channel(`dashboard-${adminId}`);
    await channel.send({ type: 'broadcast', event: 'new_public_appointment', payload: newAppointment });
    
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

    const pushResult = await sendPushNotification(supabaseAdmin, adminId, pushTitle, pushBody);
    
    if (!pushResult.success) {
        console.warn("Aviso: Notificação Push falhou.", pushResult.error);
    }

    return new Response(JSON.stringify({ success: true, appointment: newAppointment, pushDebug: pushResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro Geral:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});