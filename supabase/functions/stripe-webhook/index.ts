import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN"); 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaass-access-token',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Se for chamada manual do Frontend para polling (simula webhook)
    const requestUrl = new URL(req.url);
    // Tenta ler o body uma única vez
    let body;
    try {
        body = await req.json();
    } catch(e) {
        body = {};
    }

    // Verifica se é uma chamada de polling (manual) ou webhook real
    const isManualCheck = body.action === 'payment.updated' && body.id;

    if (!isManualCheck) {
        // Validação de Token (Segurança do Webhook Real do Asaas)
        const requestToken = req.headers.get('asaas-access-token');
        if (ASAAS_WEBHOOK_TOKEN && requestToken !== ASAAS_WEBHOOK_TOKEN) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Lógica para Polling Manual (Front pergunta: "E aí, pagou?")
    if (isManualCheck) {
        const paymentId = body.id; // ID do Asaas
        const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
        
        if (!ASAAS_API_KEY) throw new Error("API Key não configurada");

        // Consulta direta ao Asaas
        const asaasRes = await fetch(`https://www.asaas.com/api/v3/payments/${paymentId}`, {
            headers: { "access_token": ASAAS_API_KEY }
        });
        const asaasData = await asaasRes.json();
        
        const isApproved = asaasData.status === 'RECEIVED' || asaasData.status === 'CONFIRMED';
        
        // Se aprovado, processa a lógica de sucesso
        if (isApproved) {
             // 1. Atualiza pagamentos de agendamento (se existir)
             await supabaseAdmin
            .from('payments')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('mp_payment_id', paymentId);

            if (asaasData.externalReference) {
                 // Verifica se é Upgrade ou Agendamento
                 if (asaasData.externalReference.startsWith('UPGRADE_')) {
                     const userId = asaasData.externalReference.split('UPGRADE_')[1];
                     await supabaseAdmin
                        .from('profiles')
                        .update({ plan: 'premium' })
                        .eq('id', userId);
                 } else {
                     await supabaseAdmin
                        .from('appointments')
                        .update({ status: 'Confirmado' })
                        .eq('id', asaasData.externalReference);
                 }
            }
        }

        return new Response(JSON.stringify({ status: isApproved ? 'approved' : asaasData.status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Lógica para Webhook Real (Asaas avisa: "Pagou!")
    const { event, payment } = body;

    console.log(`[Asaas Webhook] Evento: ${event}, Payment ID: ${payment?.id}`);

    if (!payment || !payment.id) {
        return new Response(JSON.stringify({ ignored: true }), { status: 200, headers: corsHeaders });
    }

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        
        // 1. Atualizar status na tabela payments (apenas se existir registro lá)
        await supabaseAdmin
            .from('payments')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('mp_payment_id', payment.id);

        // 2. Processar a lógica de negócio baseada na externalReference
        let ref = payment.externalReference;

        if (ref) {
            if (ref.startsWith('UPGRADE_')) {
                // É UM UPGRADE DE PLANO
                const userId = ref.split('UPGRADE_')[1];
                console.log(`Processando Upgrade Premium para usuário: ${userId}`);
                
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update({ plan: 'premium' })
                    .eq('id', userId);
                
                if (profileError) console.error("Erro ao atualizar perfil:", profileError);
                else console.log("Perfil atualizado para Premium com sucesso.");

            } else {
                // É UM AGENDAMENTO (ref é o appointment_id)
                console.log(`Confirmando agendamento: ${ref}`);
                const { error: apptError } = await supabaseAdmin
                    .from('appointments')
                    .update({ status: 'Confirmado' })
                    .eq('id', ref);
                    
                if (apptError) console.error("Erro ao confirmar agendamento:", apptError);
            }
        } else {
            // Tentativa de fallback para pagamentos sem externalReference (busca na tabela payments)
            const { data: payData } = await supabaseAdmin
                .from('payments')
                .select('appointment_id')
                .eq('mp_payment_id', payment.id)
                .single();
            
            if (payData?.appointment_id) {
                 await supabaseAdmin
                .from('appointments')
                .update({ status: 'Confirmado' })
                .eq('id', payData.appointment_id);
            }
        }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})