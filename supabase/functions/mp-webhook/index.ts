import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const url = new URL(req.url);
    // O Mercado Pago envia o tipo de tópico e o ID na query string ou no corpo
    // Formato comum: ?topic=payment&id=123456789
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const id = url.searchParams.get("id") || url.searchParams.get("data.id");

    // Se vier no body (formato novo)
    let bodyId = null;
    let bodyAction = null;
    if (req.body) {
        try {
            const body = await req.json();
            bodyId = body.data?.id;
            bodyAction = body.action;
        } catch (e) {
            // Body vazio ou inválido, ignora
        }
    }

    const paymentId = id || bodyId;
    const action = topic || bodyAction;

    // Só nos interessa atualizações de pagamento
    if ((action !== "payment" && action !== "payment.updated") || !paymentId) {
        return new Response("Ignored", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Busca na nossa tabela 'payments' para saber qual agendamento é esse
    const { data: paymentRecord, error: paymentError } = await supabase
        .from("payments")
        .select("appointment_id, mp_payment_id, appointment:appointments(user_id)") // user_id é o profissional
        .eq("mp_payment_id", paymentId)
        .single();

    if (paymentError || !paymentRecord) {
        console.log(`Pagamento ${paymentId} não encontrado no sistema.`);
        return new Response("Payment not found locally", { status: 200 }); 
        // Retorna 200 para o MP parar de tentar reenviar, já que não é um pagamento nosso
    }

    // 2. Precisamos consultar o status atual na API do Mercado Pago para garantir
    // Para isso, precisamos do token do PROFISSIONAL (dono do agendamento)
    const professionalId = paymentRecord.appointment.user_id;
    
    const { data: connection } = await supabase
        .from("mp_connections")
        .select("access_token")
        .eq("user_id", professionalId)
        .single();

    if (!connection) {
        console.error("Profissional desconectou o MP.");
        return new Response("Professional disconnected", { status: 200 });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
            "Authorization": `Bearer ${connection.access_token}`
        }
    });

    if (!mpRes.ok) {
        console.error("Erro ao buscar pagamento no MP");
        return new Response("MP API Error", { status: 500 });
    }

    const mpData = await mpRes.json();
    const status = mpData.status; // approved, pending, rejected, etc.

    // 3. Atualiza a tabela 'payments'
    await supabase.from("payments").update({
        status: status,
        updated_at: new Date().toISOString()
    }).eq("mp_payment_id", paymentId);

    // 4. Se aprovado, atualiza o agendamento para 'Confirmado' (ou lógica específica de pago)
    if (status === "approved") {
        await supabase.from("appointments").update({
            status: "Confirmado" // Ou criar um status novo 'Pago' se preferir
        }).eq("id", paymentRecord.appointment_id);
        
        console.log(`Agendamento ${paymentRecord.appointment_id} confirmado via Pix!`);
    }

    return new Response("OK", { status: 200 });

  } catch (e: any) {
    console.error("Webhook Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});