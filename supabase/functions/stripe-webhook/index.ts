import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN"); // Opcional: configure no Asaas e nas variáveis

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaass-access-token',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validação de Token (Segurança do Webhook)
    const requestToken = req.headers.get('asaas-access-token');
    if (ASAAS_WEBHOOK_TOKEN && requestToken !== ASAAS_WEBHOOK_TOKEN) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { event, payment } = body;

    console.log(`[Asaas Webhook] Evento: ${event}, Payment ID: ${payment?.id}`);

    if (!payment || !payment.id) {
        return new Response(JSON.stringify({ ignored: true }), { status: 200, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Eventos de sucesso do Asaas
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        
        // 1. Atualizar status na tabela payments
        // Usamos mp_payment_id pois é onde guardamos o ID do Asaas
        const { error: payError } = await supabaseAdmin
            .from('payments')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('mp_payment_id', payment.id);

        if (payError) console.error("Erro ao atualizar pagamento:", payError);

        // 2. Buscar o appointment_id associado (via externalReference ou busca no banco)
        // Se salvamos externalReference na criação, podemos usar payment.externalReference
        // Caso contrário, buscamos na tabela payments.
        
        let appointmentId = payment.externalReference;

        if (!appointmentId) {
            const { data: payData } = await supabaseAdmin
                .from('payments')
                .select('appointment_id')
                .eq('mp_payment_id', payment.id)
                .single();
            appointmentId = payData?.appointment_id;
        }

        if (appointmentId) {
            // 3. Confirmar o agendamento
            const { error: apptError } = await supabaseAdmin
                .from('appointments')
                .update({ status: 'Confirmado' })
                .eq('id', appointmentId);
                
            if (apptError) console.error("Erro ao confirmar agendamento:", apptError);
            else console.log(`Agendamento ${appointmentId} confirmado via Asaas.`);
        }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})