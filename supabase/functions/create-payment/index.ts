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
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ASAAS_API_KEY) {
        throw new Error("ASAAS_API_KEY não configurada no Supabase.");
    }

    const body = await req.json();
    const { action } = body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- HELPER: HEADERS ASAAS ---
    const asaasHeaders = {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY
    };

    // --- ACTION: RETRIEVE (Recuperar QR Code de pagamento existente) ---
    if (action === 'retrieve') {
        const { paymentId } = body; // ID do Asaas (pay_xxxxxxxx)
        
        if (!paymentId) throw new Error("ID de pagamento necessário.");

        // Busca dados do QR Code no Asaas
        const qrRes = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, { headers: asaasHeaders });
        const qrData = await qrRes.json();

        // Busca status atual do pagamento
        const payRes = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, { headers: asaasHeaders });
        const payData = await payRes.json();

        if (!qrRes.ok || !payRes.ok) {
            console.error("Erro Asaas Retrieve:", qrData, payData);
            throw new Error("Erro ao recuperar dados do Asaas.");
        }

        return new Response(JSON.stringify({
            id: paymentId,
            status: payData.status === 'RECEIVED' || payData.status === 'CONFIRMED' ? 'approved' : 'pending',
            qr_code: qrData.payload, // Copia e Cola
            qr_code_base64: qrData.encodedImage, // Imagem Base64
            ticket_url: payData.invoiceUrl // Link da fatura
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- ACTION: CREATE (Criar novo Pix) ---
    const { amount, description, professionalId, appointmentId, payerEmail, name, phone, payerCpf } = body;

    if (!amount || !appointmentId) {
      throw new Error("Campos obrigatórios ausentes.");
    }

    // 1. Obter ou Criar Cliente no Asaas
    let customerId = "";
    
    // Busca pelo email
    const searchCustomerRes = await fetch(`${ASAAS_API_URL}/customers?email=${encodeURIComponent(payerEmail || '')}`, { headers: asaasHeaders });
    const searchData = await searchCustomerRes.json();

    if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
        
        // CORREÇÃO CRÍTICA: Se o cliente já existe, mas o formulário passou um CPF novo, 
        // tentamos atualizar o cadastro no Asaas para garantir que a cobrança Pix não falhe por falta de CPF.
        if (payerCpf) {
            try {
                await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
                    method: "POST", // Asaas usa POST para update em alguns endpoints ou PUT, a doc V3 usa POST para update parcial as vezes, mas vamos testar
                    headers: asaasHeaders,
                    body: JSON.stringify({ cpfCnpj: payerCpf, mobilePhone: phone, name: name })
                });
            } catch (ignore) {
                console.warn("Falha ao atualizar cliente existente no Asaas (ignorado)", ignore);
            }
        }

    } else {
        // Cria novo cliente
        const newCustomerRes = await fetch(`${ASAAS_API_URL}/customers`, {
            method: "POST",
            headers: asaasHeaders,
            body: JSON.stringify({
                name: name || "Cliente Oubook",
                email: payerEmail || "cliente@oubook.com",
                cpfCnpj: payerCpf || undefined, 
                mobilePhone: phone || undefined
            })
        });
        const newCustomerData = await newCustomerRes.json();
        
        if (!newCustomerRes.ok) {
            console.error("Erro ao criar cliente Asaas:", newCustomerData);
            // Retorna erro amigável se for CPF inválido
            if (newCustomerData.errors && newCustomerData.errors[0]?.code === 'invalid_cpfCnpj') {
                 throw new Error("CPF inválido informado.");
            }
            throw new Error(`Erro Asaas Customer: ${JSON.stringify(newCustomerData.errors)}`);
        }
        customerId = newCustomerData.id;
    }

    // 2. Criar Cobrança (Payment)
    const paymentPayload = {
        customer: customerId,
        billingType: "PIX",
        value: Number(amount),
        dueDate: new Date().toISOString().split('T')[0], // Vence hoje
        description: description || `Agendamento #${appointmentId}`,
        externalReference: appointmentId // Útil para conciliação
    };

    const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
        method: "POST",
        headers: asaasHeaders,
        body: JSON.stringify(paymentPayload)
    });
    
    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
        console.error("Erro ao criar pagamento Asaas:", paymentData);
        if (paymentData.errors && paymentData.errors[0]?.code === 'invalid_customer.cpfCnpj') {
             throw new Error("O cliente no Asaas não possui CPF cadastrado. Tente novamente informando o CPF.");
        }
        throw new Error(`Erro Asaas Payment: ${JSON.stringify(paymentData.errors)}`);
    }

    const asaasId = paymentData.id;

    // 3. Obter QR Code Pix
    const pixRes = await fetch(`${ASAAS_API_URL}/payments/${asaasId}/pixQrCode`, { headers: asaasHeaders });
    const pixData = await pixRes.json();

    // 4. Salvar no Supabase
    const { error: dbError } = await supabase.from("payments").insert({
        appointment_id: appointmentId,
        mp_payment_id: asaasId, // Reutilizando a coluna mp_payment_id para guardar o ID do Asaas
        status: 'pending', 
        amount: Number(amount)
    });

    if (dbError) console.error("Erro DB:", dbError);

    // 5. Retorno
    return new Response(JSON.stringify({
        id: asaasId,
        status: 'pending',
        qr_code: pixData.payload, // Copia e Cola
        qr_code_base64: pixData.encodedImage, // Imagem Base64
        ticket_url: paymentData.invoiceUrl
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("Edge Function Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});