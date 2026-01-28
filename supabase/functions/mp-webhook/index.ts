import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DenoEnv = (Deno as any).env;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função auxiliar para obter token OAuth (Necessário para FCM v1)
async function getAccessToken() {
  let serviceAccountJSON = DenoEnv.get('FCM_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountJSON) throw new Error('FCM_SERVICE_ACCOUNT_KEY não configurado.');
  
  serviceAccountJSON = serviceAccountJSON.trim();
  if (serviceAccountJSON.startsWith('"') && serviceAccountJSON.endsWith('"')) {
     serviceAccountJSON = serviceAccountJSON.slice(1, -1);
  }

  let serviceAccount = JSON.parse(serviceAccountJSON);
  if (typeof serviceAccount === 'string') serviceAccount = JSON.parse(serviceAccount);
  
  let privateKey = serviceAccount.private_key;
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  const privateKeyBody = privateKey.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '');
  const privateKeyBase64 = privateKeyBody.replace(/\s/g, '');
  const privateKeyData = atob(privateKeyBase64);
  const privateKeyBuffer = new Uint8Array(privateKeyData.length);
  for (let i = 0; i < privateKeyData.length; i++) privateKeyBuffer[i] = privateKeyData.charCodeAt(i);
  
  const key = await crypto.subtle.importKey("pkcs8", privateKeyBuffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"]);
  const jwt = await create({ alg: "RS256", typ: "JWT" }, { iss: serviceAccount.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", exp: getNumericDate(3600), iat: getNumericDate(0) }, key);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  return { accessToken: (await tokenResponse.json()).access_token, projectId: serviceAccount.project_id };
}

// Envia Push com autocorreção de tokens inválidos
const sendPushNotification = async (supabaseAdmin: any, userId: string, title: string, body: string) => {
  try {
    const { data: tokensData } = await supabaseAdmin.from('notification_tokens').select('token').eq('user_id', userId);
    if (!tokensData || tokensData.length === 0) return;
    
    const auth = await getAccessToken();
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`;

    await Promise.all(tokensData.map(async (t: any) => {
        try {
            const res = await fetch(fcmEndpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { token: t.token, notification: { title, body } } })
            });
            
            if (!res.ok) {
                const text = await res.text();
                console.error(`FCM Erro token ${t.token.substring(0,8)}...:`, text);
                
                // Remove token inválido do banco
                if (res.status === 404 || text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) {
                    console.log(`Removendo token inválido: ${t.token}`);
                    await supabaseAdmin.from('notification_tokens').delete().eq('token', t.token);
                }
            }
        } catch (e) {
            console.error('Fetch error:', e);
        }
    }));
  } catch (e) { console.error('Push error', e); }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let topic = url.searchParams.get("topic") || url.searchParams.get("type");
    let id = url.searchParams.get("id") || url.searchParams.get("data.id");
    let bodyId = null;
    let bodyAction = null;
    if (req.body) { try { const body = await req.json(); bodyId = body.id || body.data?.id; bodyAction = body.action || body.type; } catch (e) {} }

    const paymentId = id || bodyId;
    const action = topic || bodyAction || (paymentId ? "payment.updated" : null);

    if ((action !== "payment" && action !== "payment.updated") || !paymentId) {
        return new Response(JSON.stringify({ message: "Ignored" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: paymentRecord } = await supabase
        .from("payments")
        .select("appointment_id, mp_payment_id, status, appointment:appointments(user_id, name, date, time, status)") 
        .eq("mp_payment_id", paymentId)
        .single();

    if (!paymentRecord) {
        return new Response(JSON.stringify({ message: "Payment not found locally" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); 
    }

    const professionalId = paymentRecord.appointment.user_id;
    const { data: connection } = await supabase.from("mp_connections").select("access_token").eq("user_id", professionalId).single();
    
    if (!connection) {
        return new Response(JSON.stringify({ error: "Professional disconnected" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${connection.access_token}` }
    });
    
    if (!mpRes.ok) throw new Error("MP API Error");
    
    const mpData = await mpRes.json();
    const status = mpData.status;

    await supabase.from("payments").update({ status: status, updated_at: new Date().toISOString() }).eq("mp_payment_id", paymentId);

    if (status === "approved") {
        const { data: updatedRows } = await supabase
            .from("appointments")
            .update({ status: "Confirmado" })
            .eq("id", paymentRecord.appointment_id)
            .neq("status", "Confirmado")
            .select();
        
        if (updatedRows && updatedRows.length > 0) {
            const appt = paymentRecord.appointment;
            const formattedDate = new Date(appt.date + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            
            await sendPushNotification(supabase, professionalId, 'Pagamento Recebido!', `${appt.name} confirmou o agendamento para ${formattedDate} às ${appt.time}.`);
        }
    }

    return new Response(JSON.stringify({ status: status }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});