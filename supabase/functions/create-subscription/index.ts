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
const SUBSCRIPTION_VALUE = 29.90; 

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada.");

    // 1. Autenticação do Usuário via Supabase Auth
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

    // 2. Obter ou Criar Cliente no Asaas
    let customerId = "";
    
    // Busca pelo email do usuário logado
    const searchCustomerRes = await fetch(`${ASAAS_API_URL}/customers?email=${encodeURIComponent(user.email || '')}`, { headers: asaasHeaders });
    const searchData = await searchCustomerRes.json();

    if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
        // Atualiza CPF se necessário
        try {
            await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
                method: "POST", 
                headers: asaasHeaders,
                body: JSON.stringify({ cpfCnpj: cpf, mobilePhone: phone, name: name || undefined })
            });
        } catch (e) { console.warn("Update customer ignored"); }
    } else {
        // Cria novo cliente
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

    // 3. Criar Assinatura (Subscription)
    // Verifica se já existe assinatura ativa para não duplicar (opcional, mas bom)
    const checkSubRes = await fetch(`${ASAAS_API_URL}/subscriptions?customer=${customerId}&status=ACTIVE`, { headers: asaasHeaders });
    const checkSubData = await checkSubRes.json();
    
    let subscriptionId = "";

    if (checkSubData.data && checkSubData.data.length > 0) {
        subscriptionId = checkSubData.data[0].id;
    } else {
        const subPayload = {
            customer: customerId,
            billingType: "PIX",
            value: SUBSCRIPTION_VALUE,
            nextDueDate: new Date().toISOString().split('T')[0], // Cobra hoje
            cycle: "MONTHLY",
            description: "Assinatura Oubook Premium",
            externalReference: `UPGRADE_${user.id}` // Link mágico para o webhook identificar
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

    // 4. Obter a cobrança (payment) gerada pela assinatura para pegar o QR Code
    // Assinaturas geram cobranças. Precisamos da cobrança 'PENDING' atual.
    const paymentsRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}/payments`, { headers: asaasHeaders });
    const paymentsData = await paymentsRes.json();
    
    const pendingPayment = paymentsData.data?.find((p: any) => p.status === 'PENDING');

    if (!pendingPayment) {
        throw new Error("Nenhuma cobrança pendente encontrada para esta assinatura.");
    }

    // 5. Pegar o QR Code dessa cobrança
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