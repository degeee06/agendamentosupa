
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";
import webpush from "https://esm.sh/web-push";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DenoEnv = (Deno as any).env;
const VAPID_PUBLIC = DenoEnv.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = DenoEnv.get("VAPID_PRIVATE_KEY");

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails("mailto:suporte@oubook.com", VAPID_PUBLIC, VAPID_PRIVATE);
}

async function getAccessToken() {
  const serviceAccountJSON = DenoEnv.get('FCM_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountJSON) return null;
  try {
    const serviceAccount = JSON.parse(serviceAccountJSON);
    const privateKeyData = atob(serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\n/g, ''));
    const privateKeyBuffer = new Uint8Array(privateKeyData.length);
    for (let i = 0; i < privateKeyData.length; i++) privateKeyBuffer[i] = privateKeyData.charCodeAt(i);
    const key = await crypto.subtle.importKey("pkcs8", privateKeyBuffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"]);
    const jwt = await create({ alg: "RS256", typ: "JWT" }, { iss: serviceAccount.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", exp: getNumericDate(3600), iat: getNumericDate(0) }, key);
    const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
    
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch (e) { return null; }
}

const sendPushNotification = async (supabaseAdmin: any, userId: string, title: string, body: string) => {
  try {
    const { data: tokensData } = await supabaseAdmin.from('notification_tokens').select('token').eq('user_id', userId);
    if (!tokensData || tokensData.length === 0) return;

    const accessToken = await getAccessToken();
    const serviceAccountJSON = DenoEnv.get('FCM_SERVICE_ACCOUNT_KEY');
    const serviceAccount = serviceAccountJSON ? JSON.parse(serviceAccountJSON) : {};
    const projectId = serviceAccount.project_id;

    const promises = tokensData.map(async (t: any) => {
        const tokenStr = t.token.trim();
        // Se o token for um JSON, é Web Push. Se for texto puro, é FCM.
        if (tokenStr.startsWith('{')) {
            try {
                const sub = JSON.parse(tokenStr);
                await webpush.sendNotification(sub, JSON.stringify({ title, body, url: "/" }));
            } catch (err) { console.error("Web Push Error", err); }
        } else if (accessToken && projectId) {
            try {
              await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: { token: tokenStr, notification: { title, body } } })
              });
            } catch (err) { console.error("FCM Fetch Error", err); }
        }
    });
    await Promise.all(promises);
  } catch (e) { console.error('Push Global Logic Error', e); }
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tokenId, name, phone, email, date, time } = await req.json();
    const supabaseAdmin = createClient(DenoEnv.get('SUPABASE_URL') ?? '', DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // 1. Valida o link de uso único
    const { data: linkData, error: linkError } = await supabaseAdmin.from('one_time_links').select('user_id, is_used').eq('id', tokenId).single();
    if (linkError || !linkData || linkData.is_used) {
      return new Response(JSON.stringify({ error: 'Link inválido ou já utilizado.' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminId = linkData.user_id;

    // 2. Busca perfil e configurações
    const [profileRes, businessRes, mpRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('plan, daily_usage, last_usage_date').eq('id', adminId).single(),
        supabaseAdmin.from('business_profiles').select('service_price').eq('user_id', adminId).single(),
        supabaseAdmin.from('mp_connections').select('access_token').eq('user_id', adminId).single()
    ]);
    
    if (profileRes.error || !profileRes.data) throw new Error("Erro ao carregar perfil do profissional.");

    // Verifica limite do plano Trial
    if (profileRes.data.plan === 'trial') {
        const todayStr = new Date().toISOString().split('T')[0];
        const currentUsage = profileRes.data.last_usage_date === todayStr ? profileRes.data.daily_usage : 0;
        if (currentUsage >= 5) {
            return new Response(JSON.stringify({ error: 'Este profissional atingiu o limite diário de agendamentos.' }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }

    // 3. Determina o status inicial
    const status = (businessRes.data?.service_price > 0 && !!mpRes.data?.access_token) ? 'Aguardando Pagamento' : 'Confirmado';

    // 4. Cria o agendamento
    const { data: appt, error: insertError } = await supabaseAdmin.from('appointments').insert({
        name, email, phone, date, time, user_id: adminId, status
    }).select().single();

    if (insertError) throw insertError;

    // 5. Marca o link como usado
    await supabaseAdmin.from('one_time_links').update({ is_used: true, appointment_id: appt.id }).eq('id', tokenId);

    // 6. Atualiza uso diário
    if (profileRes.data.plan === 'trial') {
        const todayStr = new Date().toISOString().split('T')[0];
        const newUsage = profileRes.data.last_usage_date === todayStr ? profileRes.data.daily_usage + 1 : 1;
        await supabaseAdmin.from('profiles').update({ daily_usage: newUsage, last_usage_date: todayStr }).eq('id', adminId);
    }

    // 7. Envia broadcast para o dashboard do admin
    const channel = supabaseAdmin.channel(`dashboard-${adminId}`);
    await channel.send({ type: 'broadcast', event: 'new_public_appointment', payload: appt });
    
    // 8. Notifica profissional (ENVOLVIDO EM TRY/CATCH PARA NÃO QUEBRAR O PROCESSO)
    try {
      const formattedDate = new Date(date + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const pushTitle = status === 'Confirmado' ? 'Novo Agendamento Confirmado!' : 'Novo Agendamento (Pendente)';
      const pushBody = `${name} agendou para ${formattedDate} às ${time}.`;
      await sendPushNotification(supabaseAdmin, adminId, pushTitle, pushBody);
    } catch (pushErr) {
      console.error("Critical: Push notification logic failed, but appointment was saved.", pushErr);
    }

    return new Response(JSON.stringify({ success: true, appointment: appt }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error: any) {
    console.error("Booking Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno no servidor' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
