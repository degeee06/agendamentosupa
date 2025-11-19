import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Constrói a URL do Webhook baseada na URL do projeto Supabase
// Ex: https://xyz.supabase.co -> https://xyz.supabase.co/functions/v1/mp-webhook
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/mp-webhook`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Recebe dados do frontend
    const { amount, description, professionalId, appointmentId, payerEmail } = await req.json();

    if (!amount || !professionalId || !appointmentId) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Busca o token do profissional (quem recebe o dinheiro)
    const { data: mp, error: mpError } = await supabase
      .from("mp_connections")
      .select("access_token")
      .eq("user_id", professionalId)
      .single();

    if (mpError || !mp) {
      return new Response(JSON.stringify({ error: "Profissional não conectou o Mercado Pago." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Cria pagamento via API do Mercado Pago (PIX)
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mp.access_token}`,
        "X-Idempotency-Key": appointmentId // Evita cobrança duplicada para o mesmo agendamento
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        description: description || "Serviço Agendado",
        payment_method_id: "pix",
        notification_url: WEBHOOK_URL, // <--- IMPORTANTE: Garante que o MP avise a gente
        payer: { 
            email: payerEmail || "cliente@email.com" 
        },
        // external_reference ajuda a identificar no painel do MP
        external_reference: appointmentId 
      }),
    });

    const paymentData = await mpRes.json();

    if (!mpRes.ok) {
        console.error("Erro MP Create:", paymentData);
        throw new Error(paymentData.message || "Erro ao criar pagamento no Mercado Pago");
    }

    // 3. Salva o registro na tabela 'payments' para vincular MP <-> Agendamento
    const { error: dbError } = await supabase.from("payments").insert({
        appointment_id: appointmentId,
        mp_payment_id: paymentData.id.toString(),
        status: paymentData.status,
        amount: Number(amount)
    });

    if (dbError) {
        console.error("Erro ao salvar pagamento no DB:", dbError);
        // Não paramos o fluxo, pois o PIX foi gerado, mas o webhook pode falhar sem esse registro.
    }

    // Retorna os dados necessários para o Frontend (QR Code Base64 e Copia e Cola)
    const responsePayload = {
        id: paymentData.id,
        status: paymentData.status,
        qr_code: paymentData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: paymentData.point_of_interaction?.transaction_data?.ticket_url
    };

    return new Response(JSON.stringify(responsePayload), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});