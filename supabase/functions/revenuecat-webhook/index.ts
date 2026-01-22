import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// FIX: Declare Deno to satisfy TypeScript type checker in non-Deno environments.
declare const Deno: any;

const DenoEnv = (Deno as any).env;

// Headers CORS para permitir chamadas externas (RevenueCat)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Lida com requisições de preflight do navegador
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    
    // O RevenueCat envia os dados dentro do objeto 'event'
    const event = body.event;
    if (!event) throw new Error("Evento inválido do RevenueCat");

    const appUserId = event.app_user_id; // Este é o ID do usuário no Supabase
    const eventType = event.type;
    const expirationMs = event.expiration_at_ms;

    // Inicializa o cliente Admin do Supabase para ignorar RLS e atualizar perfis
    const supabase = createClient(
      DenoEnv.get("SUPABASE_URL")!,
      DenoEnv.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`Processando evento ${eventType} para o usuário ${appUserId}`);

    // Lógica principal: Compras iniciais e renovações
    if (
      eventType === 'INITIAL_PURCHASE' || 
      eventType === 'RENEWAL' || 
      eventType === 'UNCANCELLATION' ||
      eventType === 'NON_RENEWING_PURCHASE'
    ) {
      if (expirationMs) {
        const expiresAt = new Date(expirationMs).toISOString();
        
        const { error } = await supabase
          .from('profiles')
          .update({
            plan: 'premium',
            premium_expires_at: expiresAt
          })
          .eq('id', appUserId);

        if (error) throw error;
        console.log(`Usuário ${appUserId} atualizado para Premium até ${expiresAt}`);
      }
    } 
    
    // Lógica para quando a assinatura expira de fato
    else if (eventType === 'EXPIRATION' || eventType === 'BILLING_ISSUE') {
      const { error } = await supabase
        .from('profiles')
        .update({
          plan: 'trial',
          premium_expires_at: null
        })
        .eq('id', appUserId);

      if (error) throw error;
      console.log(`Usuário ${appUserId} revertido para Trial por expiração.`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("Erro no Webhook RevenueCat:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});