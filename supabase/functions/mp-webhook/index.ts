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
  } catch (e) { return null; }
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
  } catch (e) { console.error('Push Global Error:', e); }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const body = await req.json();
    const paymentId = body.data?.id || body.id;
    if (!paymentId) return new Response("Ok", { status: 200 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Localizar o registro do pagamento e agendamento
    const { data: paymentRecord } = await supabase.from("payments").select("appointment_id, amount, appointment:appointments(user_id, name, date, time)").eq("mp_payment_id", paymentId.toString()).single();

    if (paymentRecord) {
        // 2. Verificar status no MP
        const { data: mp } = await supabase.from("mp_connections").select("access_token").eq("user_id", paymentRecord.appointment.user_id).single();
        if (mp) {
            const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { "Authorization": `Bearer ${mp.access_token}` } });
            const mpData = await mpRes.json();

            if (mpData.status === 'approved') {
                // Atualiza agendamento e pagamento
                await supabase.from("appointments").update({ status: 'Confirmado' }).eq('id', paymentRecord.appointment_id);
                await supabase.from("payments").update({ status: 'approved' }).eq('mp_payment_id', paymentId.toString());

                // Notifica
                await sendPushNotification(supabase, paymentRecord.appointment.user_id, 'Pagamento Aprovado!', `${paymentRecord.appointment.name} confirmou o agendamento para ${paymentRecord.appointment.date}.`);
                return new Response(JSON.stringify({ status: 'approved' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }
    }

    return new Response("Ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response("Ok", { status: 200, headers: corsHeaders });
  }
});
