import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare Deno type for TS
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HOTMART_HOTTOK_SECRET = Deno.env.get('HOTMART_HOTTOK_SECRET');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verificação de Segurança do Token Hotmart (Se configurado)
  const hottok = req.headers.get('x-hotmart-hottok');
  if (HOTMART_HOTTOK_SECRET && hottok !== HOTMART_HOTTOK_SECRET) {
      console.warn(`Tentativa de acesso não autorizado. Hottok recebido: ${hottok}`);
      return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    console.log("Hotmart Webhook Payload:", JSON.stringify(payload));

    const event = payload.event;
    
    // Verificamos se é um evento de compra aprovada (Hotmart 2.0.0 usa PURCHASE_APPROVED)
    // Também aceitamos o formato legado se o status for 'approved'
    const isApproved = event === 'PURCHASE_APPROVED' || payload.data?.purchase?.status === 'APPROVED' || payload.data?.purchase?.status === 'approved';

    if (!isApproved) {
        console.log(`Evento ignorado (não é aprovação): ${event}`);
        return new Response(JSON.stringify({ message: "Ignored event" }), { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Estratégia 1: Recuperar ID via parâmetro 'sck' (Source Key) ou 'xcod'
    // A URL modificada no index.tsx envia &sck={user.id}
    const userIdFromSck = payload.data?.purchase?.sck || payload.data?.purchase?.xcod || payload.data?.subscription?.subscriber?.code;
    
    let userId = userIdFromSck;
    let method = 'sck';

    // Estratégia 2: Fallback por email (Caso o sck falhe)
    if (!userId) {
        console.warn("ID do usuário não encontrado no parâmetro 'sck'. Tentando fallback por email...");
        const email = payload.data?.buyer?.email;
        
        if (!email) {
            throw new Error("Email e UserID não encontrados no payload.");
        }

        // Tenta encontrar o usuário na tabela profiles se existir campo email, ou tenta via admin list
        // Como RPC falha, usamos listUsers com filtro (Pode ser lento se houver muitos usuários, mas é funcional)
        // OBS: A API admin.listUsers não filtra por email diretamente de forma eficiente sem RPC,
        // mas podemos tentar buscar na tabela 'appointments' que TEM o email e o user_id linkado.
        
        const { data: appointmentData } = await supabaseAdmin
            .from('appointments')
            .select('user_id')
            .eq('email', email)
            .limit(1)
            .maybeSingle();

        if (appointmentData?.user_id) {
            userId = appointmentData.user_id;
            method = 'email_via_appointments';
        } else {
            // Último recurso: Listar usuários (lento, mas funciona para bases pequenas < 50)
            const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
            const foundUser = users?.find((u: any) => u.email === email);
            
            if (foundUser) {
                userId = foundUser.id;
                method = 'email_via_auth_list';
            }
        }
    }

    if (!userId) {
        console.error("Falha crítica: Usuário não identificado para o pagamento.");
        return new Response(JSON.stringify({ error: "User not identified" }), { 
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    console.log(`Usuário identificado: ${userId} (Método: ${method}). Atualizando plano...`);

    // Atualiza o perfil para Premium
    const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
            plan: 'premium',
            // Opcional: Salvar data de expiração se for assinatura recorrente
            // premium_expires_at: ... 
        })
        .eq('id', userId);

    if (updateError) {
        console.error("Erro ao atualizar perfil:", updateError);
        throw updateError;
    }

    return new Response(JSON.stringify({ success: true, userId }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("Erro no processamento:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});