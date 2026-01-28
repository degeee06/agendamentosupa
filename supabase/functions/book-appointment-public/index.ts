import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";
import webpush from "https://esm.sh/web-push";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const DenoEnv = (Deno as any).env;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails("mailto:suporte@oubook.com", VAPID_PUBLIC, VAPID_PRIVATE);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    return (await res.json()).access_token;
  } catch (e) {
    return null;
  }
}

const sendPushNotification = async (supabaseAdmin: any, userId: string, title: string, body: string) => {
  try {
    const { data: tokensData } = await supabaseAdmin.from('notification_tokens').select('token').eq('user_id', userId);
    if (!tokensData || tokensData.length === 0) return;
    
    const accessToken = await getAccessToken();
    const serviceAccount = JSON.parse(DenoEnv.get('FCM_SERVICE_ACCOUNT_KEY') || '{}');
    const projectId = serviceAccount.project_id;

    const promises = tokensData.map(async (t: any) => {
        const tokenStr = t.token.trim();
        if (tokenStr.startsWith('{')) {
            try {
                const sub = JSON.parse(tokenStr);
                await webpush.sendNotification(sub, JSON.stringify({ title, body, url: "/" }));
            } catch (err) { console.error("Web Push Error", err); }
        } else if (accessToken && projectId) {
            await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { token: t.token, notification: { title, body } } })
            });
        }
    });
    await Promise.all(promises);
  } catch (e) { console.error('Push Error', e); }
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tokenId, name, phone, email, date, time } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Validar link
    const { data: link, error: linkErr } = await supabase.from('one_time_links').select('*').eq('id', tokenId).single();
    if (linkErr || !link || link.is_used) {
        return new Response(JSON.stringify({ error: "Este link já foi utilizado ou é inválido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Buscar perfil para saber se precisa de pagamento
    const { data: biz } = await supabase.from('business_profiles').select('service_price').eq('user_id', link.user_id).single();
    const status = (biz?.service_price && biz.service_price > 0) ? 'Aguardando Pagamento' : 'Confirmado';

    // 3. Criar agendamento
    const { data: appt, error: apptErr } = await supabase.from('appointments').insert({
        user_id: link.user_id,
        name, phone, email, date, time, status
    }).select().single();

    if (apptErr) throw apptErr;

    // 4. Marcar link como usado
    await supabase.from('one_time_links').update({ is_used: true, appointment_id: appt.id }).eq('id', tokenId);

    // 5. Notificar profissional (Se for agendamento direto grátis, notifica na hora)
    if (status === 'Confirmado') {
        await sendPushNotification(supabase, link.user_id, "Novo Agendamento!", `${name} agendou para ${date} às ${time}`);
    }

    return new Response(JSON.stringify({ appointment: appt }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
