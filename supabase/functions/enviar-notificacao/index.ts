// Add explicit type declarations for Deno APIs to resolve TypeScript errors.
// Supabase Edge Functions are executed in a Deno environment, which provides the global `Deno` object.
// This declaration informs the TypeScript compiler about the shape of this object when it's not
// automatically inferred, for example in a mixed Node/Deno monorepo.
declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

import { createClient } from 'npm:@supabase/supabase-js@2';
import * as jose from 'npm:jose@5.6.3';

// Função para obter o Token de Acesso do Google para autenticar com o FCM
async function getAccessToken(serviceAccount: any) {
  console.log('Gerando token de acesso do Google...');
  const privateKey = await jose.importPKCS8(serviceAccount.private_key, 'RS256');

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(serviceAccount.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setExpirationTime('1h')
    .setSubject(serviceAccount.client_email)
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Falha ao obter access token do Google: ${response.status} ${errorBody}`);
    throw new Error(`Falha ao obter access token do Google: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  console.log('Token de acesso gerado com sucesso.');
  return data.access_token;
}

// Função principal que é executada quando a Edge Function é chamada (via Webhook)
Deno.serve(async (req) => {
  console.log('Edge Function "enviar-notificacao" iniciada.');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { record: newAppointment } = await req.json();
    console.log('Recebido novo agendamento:', newAppointment);

    if (!newAppointment || !newAppointment.user_id) {
        throw new Error('Dados do agendamento ou user_id ausentes no payload do webhook.');
    }

    // 1. Obter credenciais do Firebase
    console.log('Carregando segredos do Supabase...');
    const serviceAccountJSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountJSON) throw new Error('Segredo FIREBASE_SERVICE_ACCOUNT_KEY não encontrado.');
    const serviceAccount = JSON.parse(serviceAccountJSON);
    const projectId = serviceAccount.project_id;
    console.log('Segredos carregados com sucesso.');

    // 2. Inicializar o cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    console.log('Cliente Supabase inicializado.');

    // 3. Buscar os tokens do usuário
    const userIdToNotify = newAppointment.user_id;
    console.log(`Buscando tokens para o usuário ID: ${userIdToNotify}`);
    const { data: tokensData, error: tokensError } = await supabaseClient
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', userIdToNotify);

    if (tokensError) throw tokensError;
    
    if (!tokensData || tokensData.length === 0) {
      console.log(`Nenhum token encontrado para o usuário: ${userIdToNotify}. Encerrando a função.`);
      return new Response(JSON.stringify({ message: "Nenhum token para notificar." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.log(`Encontrado(s) ${tokensData.length} token(s).`);

    // 4. Obter o token de acesso para autenticar com o FCM
    const accessToken = await getAccessToken(serviceAccount);
    
    // 5. Preparar e enviar a notificação para cada token
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    console.log(`Enviando para o endpoint do FCM: ${fcmEndpoint}`);

    const notificationsPromises = tokensData.map(async (tokenInfo) => {
      const notificationPayload = {
        message: {
          token: tokenInfo.push_token,
          notification: {
            title: 'Novo Agendamento! 🗓️',
            body: `${newAppointment.name} agendou para ${new Date(newAppointment.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às ${newAppointment.time}.`,
          },
          android: { notification: { channel_id: "high_importance_channel" } },
          apns: { payload: { aps: { sound: "default" } } },
        },
      };

      console.log(`Tentando enviar notificação para o token: ${tokenInfo.push_token.substring(0, 20)}...`);
      const response = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
      });

      if (!response.ok) {
          const errorBody = await response.json();
          const errorMessage = errorBody.error?.message || 'Erro desconhecido do FCM';
          console.error(`Falha ao enviar para o token ${tokenInfo.push_token.substring(0,20)}...: ${errorMessage}`);
          
          // Se o FCM disser que o token não é válido, removemos ele do banco
          if (errorMessage.includes('UNREGISTERED') || errorMessage.includes('invalid-registration-token')) {
              console.log(`Removendo token inválido: ${tokenInfo.push_token.substring(0,20)}...`);
              await supabaseClient.from('user_push_tokens').delete().eq('push_token', tokenInfo.push_token);
          }
      } else {
          console.log(`Notificação enviada com sucesso para o token: ${tokenInfo.push_token.substring(0, 20)}...`);
      }
    });

    await Promise.allSettled(notificationsPromises);

    console.log('Processo de notificação concluído.');
    return new Response(JSON.stringify({ success: true, message: 'Processo de notificação concluído.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('ERRO CRÍTICO NA EDGE FUNCTION:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
