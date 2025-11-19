import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Constrói a URL do Webhook baseada na URL do projeto Supabase
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/mp-webhook`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- ACTION: RETRIEVE (Recuperar dados do QR Code para pagamentos existentes) ---
    if (action === 'retrieve') {
        const { paymentId, professionalId } = body;
        
        if (!paymentId || !professionalId) {
             return new Response(JSON.stringify({ error: "IDs necessários para recuperação." }), { 
                status: 400, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        // 1. Busca token do profissional
        const { data: mp, error: mpError } = await supabase
            .from("mp_connections")
            .select("access_token")
            .eq("user_id", professionalId)
            .single();

        if (mpError || !mp) {
             return new Response(JSON.stringify({ error: "Profissional desconectado." }), { 
                status: 400, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        // 2. Busca dados no Mercado Pago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                "Authorization": `Bearer ${mp.access_token}`
            }
        });

        if (!mpRes.ok) {
            throw new Error("Erro ao buscar pagamento no Mercado Pago.");
        }

        const paymentData = await mpRes.json();

        // 3. Monta payload de resposta igual ao de criação
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
    }

    // --- ACTION: CREATE (Padrão - Criar novo pagamento) ---
    const { amount, description, professionalId, appointmentId, payerEmail } = body;

    if (!amount || !professionalId || !appointmentId) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 1. Busca o token do profissional
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
        "X-Idempotency-Key": appointmentId 
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        description: description || "Serviço Agendado",
        payment_method_id: "pix",
        notification_url: WEBHOOK_URL,
        payer: { 
            email: payerEmail || "cliente@email.com" 
        },
        external_reference: appointmentId 
      }),
    });

    const paymentData = await mpRes.json();

    if (!mpRes.ok) {
        console.error("Erro MP Create:", paymentData);
        throw new Error(paymentData.message || "Erro ao criar pagamento no Mercado Pago");
    }

    // 3. Salva o registro na tabela 'payments'
    const { error: dbError } = await supabase.from("payments").insert({
        appointment_id: appointmentId,
        mp_payment_id: paymentData.id.toString(),
        status: paymentData.status,
        amount: Number(amount)
    });

    if (dbError) {
        console.error("Erro ao salvar pagamento no DB:", dbError);
    }

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