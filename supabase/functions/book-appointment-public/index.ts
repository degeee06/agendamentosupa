
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";
import webpush from "https://esm.sh/web-push";

// FIX: Declare Deno to satisfy TypeScript type checker in non-Deno environments.
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper para resposta de erro com CORS
const errorResponse = (msg: string, status = 400) => new Response(
  JSON.stringify({ error: msg }), 
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);

async function getAccessToken(serviceAccountJSON: string | undefined) {
  if (!serviceAccountJSON) return null;
  try {
    const serviceAccount = JSON.parse(serviceAccountJSON);
    const privateKeyData = atob(serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\n/g, ''));
    const privateKeyBuffer = new Uint8Array(privateKeyData.length);
    for (let i = 0; i < privateKeyData.length; i++) privateKeyBuffer[i] = privateKeyData.charCodeAt(i);
    const key = await crypto.subtle.importKey("pkcs8", privateKeyBuffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"]);
    const jwt = await create({ alg: "RS256", typ: "JWT" }, { iss: serviceAccount.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", exp: getNumericDate(3600), iat: getNumericDate(0) }, key);
    const res = await fetch("https://oauth2.googleapis.com/token", { 
      method: "POST", 
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, 
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) 
    });
    const data = await res.json();
    return data.access_token;
  } catch (e) { 
    console.error("AccessToken Error:", e);
    return null; 
  }
}

serve(async (req: Request) => {
  // 1. TRATAMENTO IMEDIATO DE OPTIONS (CORS PREFLIGHT)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
    const fcmKey = Deno.env.get('FCM_SERVICE_ACCOUNT_KEY');

    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      webpush.setVapidDetails("mailto:suporte@oubook.com", VAPID_PUBLIC, VAPID_PRIVATE);
    }

    const { tokenId, name, phone, email, date, time } = await req.json();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Valida Link
    const { data: linkData, error: linkError } = await supabaseAdmin.from('one_time_links').select('user_id, is_used').eq('id', tokenId).single();
    if (linkError || !linkData || linkData.is_used) {
      return errorResponse('Link inválido ou já utilizado.');
    }

    const adminId = linkData.user_id;
    
    // Busca Dados do Profissional
    const [profileRes, businessRes, mpRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('plan, daily_usage, last_usage_date').eq('id', adminId).single(),
        supabaseAdmin.from('business_profiles').select('service_price').eq('user_id', adminId).single(),
        supabaseAdmin.from('mp_connections').select('access_token').eq('user_id', adminId).single()
    ]);
    
    if (profileRes.error) return errorResponse("Erro ao carregar perfil do profissional.");

    // Status do agendamento
    const status = (businessRes.data?.service_price > 0 && !!mpRes.data?.access_token) ? 'Aguardando Pagamento' : 'Confirmado';

    // Salva Agendamento
    const { data: appt, error: insertError } = await supabaseAdmin.from('appointments').insert({
        name, email, phone, date, time, user_id: adminId, status
    }).select().single();

    if (insertError) throw insertError;

    // Atualiza o link para usado
    await supabaseAdmin.from('one_time_links').update({ is_used: true, appointment_id: appt.id }).eq('id', tokenId);

    // Broadcast para o Dashboard (Realtime)
    const channel = supabaseAdmin.channel(`dashboard-${adminId}`);
    await channel.send({ type: 'broadcast', event: 'new_public_appointment', payload: appt });
    
    // ENVIO DE NOTIFICAÇÃO (SILENCIOSO - NÃO TRAVA O RESTO)
    (async () => {
      try {
        const { data: tokensData } = await supabaseAdmin.from('notification_tokens').select('token').eq('user_id', adminId);
        if (!tokensData || tokensData.length === 0) return;

        const accessToken = await getAccessToken(fcmKey);
        const projectId = fcmKey ? JSON.parse(fcmKey).project_id : null;
        const formattedDate = new Date(date + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const title = status === 'Confirmado' ? 'Novo Agendamento Confirmado!' : 'Novo Agendamento (Pendente)';
        const body = `${name} agendou para ${formattedDate} às ${time}.`;

        for (const t of tokensData) {
          const tokenStr = t.token.trim();
          if (tokenStr.startsWith('{')) {
             try {
               await webpush.sendNotification(JSON.parse(tokenStr), JSON.stringify({ title, body, url: "/" }));
             } catch (e) { console.error("Web Push fail", e); }
          } else if (accessToken && projectId) {
             try {
               await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: { token: tokenStr, notification: { title, body } } })
               });
             } catch (e) { console.error("FCM fail", e); }
          }
        }
      } catch (e) { console.error("Notification loop error", e); }
    })();

    return new Response(JSON.stringify({ success: true, appointment: appt }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      status: 200 
    });

  } catch (error: any) {
    console.error("Critical Error:", error);
    return errorResponse(error.message || 'Erro interno no servidor', 500);
  }
});
