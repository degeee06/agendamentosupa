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

    // Tenta lidar com casos onde a string do segredo pode ter aspas extras ou formatação incorreta
    serviceAccountJSON = serviceAccountJSON.trim();
    if (serviceAccountJSON.startsWith('"') && serviceAccountJSON.endsWith('"')) {
       serviceAccountJSON = serviceAccountJSON.slice(1, -1);
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountJSON);
        // Se o parse resultou em uma string (dupla stringificação), faz parse de novo
        if (typeof serviceAccount === 'string') {
            serviceAccount = JSON.parse(serviceAccount);
        }
    } catch (e) {
        console.error("Erro de Parse JSON:", e);
        throw new Error('Falha ao fazer parse do JSON do FCM_SERVICE_ACCOUNT_KEY. Verifique se o conteúdo é um JSON válido.');
    }

    if (!serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('JSON da conta de serviço incompleto (falta private_key ou client_email).');
    }

    // --- LIMPEZA ROBUSTA DA CHAVE PRIVADA ---
    let privateKey = serviceAccount.private_key;
    
    // 1. Converte literais \n em quebras de linha reais
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // 2. Remove cabeçalhos e rodapés
    const privateKeyBody = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '');

    // 3. Remove TODOS os caracteres de espaço em branco (espaços, tabs, quebras de linha)
    // Isso deixa apenas a string Base64 pura.
    const privateKeyBase64 = privateKeyBody.replace(/\s/g, '');

    // 4. Decodifica Base64 para binário
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
      console.error("Resposta de Erro do Google:", tokenData);
      throw new Error(`Google Auth Falhou: ${tokenData.error_description || JSON.stringify(tokenData)}`);
    }

    return { accessToken: tokenData.access_token, projectId: serviceAccount.project_id };
  } catch (err) {
    console.error("Erro CRÍTICO em getAccessToken:", err);
    throw err;
  }
}


// Função para enviar notificações push usando a API v1 do FCM.
const sendPushNotification = async (supabaseAdmin: any, userId: string, title: string, body: string) => {
  console.log(`Iniciando envio de notificação para UserID: ${userId}`);
  
  try {
    // 1. Busca Tokens
    const { data: tokensData, error: tokensError } = await supabaseAdmin
      .from('notification_tokens')
      .select('token')
      .eq('user_id', userId);

    if (tokensError) {
        console.error('Erro ao buscar tokens no Supabase:', tokensError);
        return { success: false, error: 'Erro de Banco de Dados: ' + tokensError.message };
    }
    
    if (!tokensData || tokensData.length === 0) {
      console.log(`Nenhum token de notificação encontrado na tabela 'notification_tokens' para o usuário: ${userId}`);
      return { success: false, error: 'Nenhum dispositivo registrado para este usuário. Ative as notificações no App.' };
    }

    console.log(`Encontrados ${tokensData.length} tokens para o usuário.`);

    // 2. Obtém Acesso ao FCM
    let accessToken, projectId;
    try {
        const auth = await getAccessToken();
        accessToken = auth.accessToken;
        projectId = auth.projectId;
        console.log(`Access Token gerado com sucesso. Project ID: ${projectId}`);
    } catch (e) {
        return { success: false, error: 'Erro na Autenticação Google: ' + e.message };
    }

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // 3. Envia para cada token
    const sendPromises = tokensData.map(async (t: { token: string }) => {
      const message = {
        message: {
          token: t.token,
          notification: {
            title: title,
            body: body,
          },
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
              const text = await res.text();
              console.error(`FCM Rejeitou token ${t.token.substring(0, 10)}...:`, res.status, text);
              return { success: false, error: `FCM Error (${res.status}): ${text}` };
          } else {
              const json = await res.json();
              console.log(`Sucesso FCM para token ${t.token.substring(0, 10)}...:`, json);
              return { success: true };
          }
      } catch (fetchErr) {
          console.error(`Erro de rede ao contatar FCM para token ${t.token}:`, fetchErr);
          return { success: false, error: 'Network Error: ' + fetchErr.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successes = results.filter(r => r.success).length;
    console.log(`Envio concluído. Sucessos: ${successes}/${results.length}`);
    
    if (successes === 0) {
        // Se todos falharam, retorna o erro do primeiro
        return { success: false, error: results[0]?.error || 'Todos os envios falharam.' };
    }
    
    return { success: successes > 0, results };

  } catch (error) {
    console.error('Erro fatal em sendPushNotification:', error);
    return { success: false, error: 'Erro Interno: ' + error.message };
  }
};


serve(async (req: Request) => {
  // Lida com a requisição de preflight do CORS.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const reqBody = await req.json();
    
    // Usa o cliente admin para contornar as políticas de RLS e para enviar notificações.
    const supabaseAdmin = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- MODO DE TESTE ---
    // Permite disparar uma notificação de teste diretamente para verificar a configuração
    if (reqBody.action === 'test-notification') {
        const { userId } = reqBody;
        if (!userId) throw new Error('UserId é obrigatório para teste.');
        
        const result = await sendPushNotification(
            supabaseAdmin, 
            userId, 
            'Teste de Notificação', 
            'Se você está lendo isso, seu sistema de notificações está configurado corretamente! 🚀'
        );
        
        // RETORNA 200 MESMO COM ERRO PARA QUE O CLIENTE POSSA LER O CORPO "result"
        // O cliente verificará `data.success`
        return new Response(JSON.stringify({ success: result.success, details: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // --- FLUXO NORMAL DE AGENDAMENTO ---
    const { tokenId, name, phone, email, date, time } = reqBody;

    if (!tokenId || !name || !phone || !date || !time) {
      throw new Error('Detalhes de agendamento obrigatórios ausentes.');
    }
    
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
      await supabaseAdmin
        .from('profiles')
        .update({ daily_usage: newUsage, last_usage_date: today })
        .eq('id', adminId);
    }
    
    // 6. Marca o link como utilizado E vincula o appointment_id.
    await supabaseAdmin
      .from('one_time_links')
      .update({ 
        is_used: true,
        appointment_id: newAppointment.id 
      })
      .eq('id', tokenId);
    
    // 7. Envia uma notificação de broadcast para o dashboard do usuário.
    const channel = supabaseAdmin.channel(`dashboard-${adminId}`);
    await channel.send({
      type: 'broadcast',
      event: 'new_public_appointment',
      payload: newAppointment,
    });
    
    // 8. Tenta enviar Push Notification
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

    // Não aguardamos falha crítica aqui, apenas logamos
    const pushResult = await sendPushNotification(
      supabaseAdmin,
      adminId,
      pushTitle,
      pushBody
    );
    
    if (!pushResult.success) {
        console.warn("Aviso: Notificação Push falhou, mas agendamento foi criado.", pushResult.error);
    }

    return new Response(JSON.stringify({ success: true, appointment: newAppointment, pushDebug: pushResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro Geral na Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});