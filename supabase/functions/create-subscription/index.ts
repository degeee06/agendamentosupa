import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://www.asaas.com/api/v3";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// VALOR DA ASSINATURA MENSAL
const SUBSCRIPTION_VALUE = 5.00; 

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada.");

    // 1. Autenticação
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Usuário não autenticado.");

    const { cpf, name, phone } = await req.json();
    if (!cpf) throw new Error("CPF é obrigatório para gerar o Pix.");

    const asaasHeaders = {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY
    };

    // 2. Cliente Asaas
    let customerId = "";
    const searchCustomerRes = await fetch(`${ASAAS_API_URL}/customers?email=${encodeURIComponent(user.email || '')}`, { headers: asaasHeaders });
    const searchData = await searchCustomerRes.json();

    if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
        try {
            await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
                method: "POST", 
                headers: asaasHeaders,
                body: JSON.stringify({ cpfCnpj: cpf, mobilePhone: phone, name: name || undefined })
            });
        } catch (e) { console.warn("Update customer ignored"); }
    } else {
        const newCustomerRes = await fetch(`${ASAAS_API_URL}/customers`, {
            method: "POST",
            headers: asaasHeaders,
            body: JSON.stringify({
                name: name || "Usuário Oubook",
                email: user.email,
                cpfCnpj: cpf,
                mobilePhone: phone
            })
        });
        const newCustomerData = await newCustomerRes.json();
        if (!newCustomerRes.ok) throw new Error(`Erro Asaas Customer: ${JSON.stringify(newCustomerData.errors)}`);
        customerId = newCustomerData.id;
    }

    // 3. ASSINATURA - LÓGICA DE LIMPEZA (Modo Faxina)
    // Busca TODAS as assinaturas ativas do cliente
    const checkSubRes = await fetch(`${ASAAS_API_URL}/subscriptions?customer=${customerId}&status=ACTIVE`, { headers: asaasHeaders });
    const checkSubData = await checkSubRes.json();
    
    let subscriptionId = "";
    const activeSubs = checkSubData.data || [];

    // Itera sobre todas as assinaturas encontradas
    for (const sub of activeSubs) {
        // Verifica se o valor é diferente de SUBSCRIPTION_VALUE (5.00)
        if (Math.abs(sub.value - SUBSCRIPTION_VALUE) > 0.001) {
            console.log(`Cancelando assinatura incorreta (ID: ${sub.id}, Valor: ${sub.value})...`);
            await fetch(`${ASAAS_API_URL}/subscriptions/${sub.id}`, {
                method: "DELETE",
                headers: asaasHeaders
            });
        } else {
            // Se achou uma correta, usa ela.
            if (!subscriptionId) {
                subscriptionId = sub.id;
            }
        }
    }

    // Se após a faxina não tivermos um ID válido, cria uma nova
    if (!subscriptionId) {
        const subPayload = {
            customer: customerId,
            billingType: "PIX",
            value: SUBSCRIPTION_VALUE,
            nextDueDate: new Date().toISOString().split('T')[0],
            cycle: "MONTHLY",
            description: "Assinatura Oubook Premium",
            externalReference: `UPGRADE_${user.id}`
        };

        const subRes = await fetch(`${ASAAS_API_URL}/subscriptions`, {
            method: "POST",
            headers: asaasHeaders,
            body: JSON.stringify(subPayload)
        });
        const subData = await subRes.json();
        if (!subRes.ok) throw new Error(`Erro Asaas Subscription: ${JSON.stringify(subData.errors)}`);
        subscriptionId = subData.id;
    }

    // 4. Cobrança (Payment)
    const paymentsRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}/payments`, { headers: asaasHeaders });
    const paymentsData = await paymentsRes.json();
    
    let pendingPayment = paymentsData.data?.find((p: any) => p.status === 'PENDING');

    if (!pendingPayment) {
        throw new Error("Aguarde um momento e tente novamente (Cobrança processando).");
    }

    // 5. Última verificação de segurança no valor do pagamento
    if (Math.abs(pendingPayment.value - SUBSCRIPTION_VALUE) > 0.001) {
        console.log(`Pagamento com valor errado (${pendingPayment.value}). Corrigindo para ${SUBSCRIPTION_VALUE}...`);
        const updatePayRes = await fetch(`${ASAAS_API_URL}/payments/${pendingPayment.id}`, {
            method: "POST",
            headers: asaasHeaders,
            body: JSON.stringify({ value: SUBSCRIPTION_VALUE })
        });
        if (updatePayRes.ok) {
            pendingPayment = await updatePayRes.json();
        }
    }

    // 6. QR Code
    const pixRes = await fetch(`${ASAAS_API_URL}/payments/${pendingPayment.id}/pixQrCode`, { headers: asaasHeaders });
    const pixData = await pixRes.json();

    return new Response(JSON.stringify({
        subscriptionId: subscriptionId,
        paymentId: pendingPayment.id,
        qr_code: pixData.payload,
        qr_code_base64: pixData.encodedImage,
        value: SUBSCRIPTION_VALUE
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("Erro create-subscription:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});