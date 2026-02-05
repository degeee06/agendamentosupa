import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from 'https://esm.sh/stripe@14.21.0'

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- ACTION: RETRIEVE (Recuperar dados do QR Code para pagamentos existentes) ---
    if (action === 'retrieve') {
        const { paymentId } = body; // Usamos o mp_payment_id do banco, que agora será o PaymentIntent ID
        
        if (!paymentId) {
             return new Response(JSON.stringify({ error: "ID necessário para recuperação." }), { 
                status: 400, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        // Busca o PaymentIntent no Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);

        const nextAction = paymentIntent.next_action;
        const pixData = nextAction?.pix_display_qr_code;

        const responsePayload = {
            id: paymentIntent.id,
            status: paymentIntent.status === 'succeeded' ? 'approved' : 'pending',
            qr_code: pixData?.data, // Código copia e cola
            qr_code_url: pixData?.image_url_png, // URL da imagem
            ticket_url: pixData?.hosted_regulatory_receipt_url // Opcional
        };

        return new Response(JSON.stringify(responsePayload), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    // --- ACTION: CREATE (Padrão - Criar novo pagamento Pix via Stripe) ---
    const { amount, description, professionalId, appointmentId, payerEmail } = body;

    if (!amount || !appointmentId) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Nota: Como solicitado, estamos substituindo o Mercado Pago pelo Stripe no painel admin.
    // Assumimos que o Stripe configurado (ENVs) é a conta plataforma que recebe os pagamentos.
    // Se fosse um marketplace complexo, usaríamos Stripe Connect headers aqui.

    // Cria PaymentIntent via API do Stripe (PIX)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100), // Stripe usa centavos e inteiros
      currency: 'brl',
      payment_method_types: ['pix'],
      description: description || "Serviço Agendado",
      metadata: {
          appointmentId: appointmentId,
          professionalId: professionalId // Útil para webhooks
      },
      receipt_email: payerEmail || undefined,
    });

    // Salva o registro na tabela 'payments'
    // Mapeamos mp_payment_id para o ID do PaymentIntent do Stripe para manter compatibilidade de schema
    const { error: dbError } = await supabase.from("payments").insert({
        appointment_id: appointmentId,
        mp_payment_id: paymentIntent.id, 
        status: 'pending', // Stripe começa como requires_payment_method ou requires_action, tratamos como pending
        amount: Number(amount)
    });

    if (dbError) {
        console.error("Erro ao salvar pagamento no DB:", dbError);
    }

    const nextAction = paymentIntent.next_action;
    const pixData = nextAction?.pix_display_qr_code;

    const responsePayload = {
        id: paymentIntent.id,
        status: 'pending',
        qr_code: pixData?.data, // Código copia e cola
        qr_code_url: pixData?.image_url_png, // URL da imagem hospedada pelo Stripe
        ticket_url: pixData?.hosted_regulatory_receipt_url
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