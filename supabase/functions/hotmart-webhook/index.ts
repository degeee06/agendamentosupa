import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuração de CORS para permitir requisições externas
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

// Declaração de tipo para Deno (ambiente Supabase Edge Functions)
declare const Deno: any;

// Usa Deno.serve (mais moderno e estável que a biblioteca std/http)
Deno.serve(async (req: Request) => {
  // 1. LOG DE ENTRADA IMEDIATO - Versão 2.0 (com Fallback URL)
  // Se este log não aparecer no painel, o problema é 100% o comando de deploy (faltou --no-verify-jwt)
  console.log(`[ENTRY v2.0] Recebendo requisição: ${req.method} na URL: ${req.url}`);

  // Responde ao preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. CORREÇÃO DE CONFIGURAÇÃO
    // Você enviou logs mostrando que sua SUPABASE_URL estava configurada com um hash incorreto.
    // Aqui forçamos o uso da URL correta baseada no seu projeto se a variável estiver estranha.
    let envUrl = Deno.env.get('SUPABASE_URL');
    if (!envUrl || !envUrl.startsWith('http')) {
        console.warn(`[CONFIG] SUPABASE_URL parecia inválida (${envUrl}). Usando fallback hardcoded.`);
        envUrl = "https://ehosmvbealefukkbqggp.supabase.co";
    }

    const SUPABASE_URL = envUrl;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const HOTMART_HOTTOK_SECRET = Deno.env.get('HOTMART_HOTTOK_SECRET');

    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY não está configurada.");
    }

    // 3. LOG DO PAYLOAD
    let payload;
    try {
        payload = await req.json();
        console.log("[PAYLOAD] Dados recebidos:", JSON.stringify(payload));
    } catch (e) {
        console.error("[ERROR] Body vazio ou JSON inválido");
        return new Response("Body inválido", { status: 400, headers: corsHeaders });
    }

    // 4. VERIFICAÇÃO DE EVENTO (Hotmart envia 'PURCHASE_APPROVED' ou status 'APPROVED')
    const event = payload.event;
    const statusHotmart = payload.data?.purchase?.status || payload.data?.status;
    
    // Lista de status considerados "Sucesso"
    const successStatus = ['APPROVED', 'COMPLETED', 'approved', 'completed', 'PURCHASE_APPROVED'];
    const isApproved = successStatus.includes(event) || successStatus.includes(statusHotmart);

    if (!isApproved) {
        console.log(`[INFO] Ignorando evento não aprovado. Evento: ${event}, Status: ${statusHotmart}`);
        return new Response(JSON.stringify({ ignored: true, reason: "Not approved" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    // 5. INICIALIZAÇÃO SUPABASE
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 6. IDENTIFICAÇÃO DO USUÁRIO
    // Primeiro tenta pegar o ID direto (SCK)
    let userId = payload.data?.purchase?.sck || 
                 payload.data?.purchase?.xcod || 
                 payload.data?.subscription?.subscriber?.code;
    
    let method = 'sck_param';

    // Se não tiver ID, busca por EMAIL
    if (!userId) {
        const email = payload.data?.buyer?.email || payload.data?.email;
        if (!email) {
            console.error("[ERROR] Não foi possível encontrar ID (sck) nem Email no payload.");
            return new Response(JSON.stringify({ error: "No user identifier found" }), { status: 400, headers: corsHeaders });
        }

        console.log(`[LOOKUP] Buscando usuário pelo email: ${email}`);
        
        // Busca na lista de usuários do Supabase Auth
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        
        if (listError) console.error("[ERROR] Falha ao listar usuários:", listError);

        const user = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

        if (user) {
            userId = user.id;
            method = 'email_lookup';
            console.log(`[SUCCESS] Usuário encontrado: ${userId}`);
        } else {
            console.error(`[FAIL] Nenhum usuário encontrado com o email ${email}`);
            // Retorna 200 para a Hotmart parar de tentar reenviar, pois o usuário não existe no seu app
            return new Response(JSON.stringify({ error: "User email not found in app" }), { 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // 7. ATUALIZAÇÃO DO PLANO
    console.log(`[UPDATE] Atualizando usuário ${userId} para Premium...`);
    
    // Tenta atualizar
    const { error: updateError, data: updateData } = await supabaseAdmin
        .from('profiles')
        .update({ plan: 'premium' })
        .eq('id', userId)
        .select();

    if (updateError) {
        console.error("[ERROR] Falha no update:", updateError);
        throw updateError;
    }

    // Se não atualizou nada (registro não existia), faz um insert (failsafe)
    if (!updateData || updateData.length === 0) {
        console.log("[INFO] Profile não existia. Criando novo...");
        const { error: insertError } = await supabaseAdmin
            .from('profiles')
            .insert({ id: userId, plan: 'premium', daily_usage: 0 });
            
        if (insertError) console.error("[ERROR] Falha ao criar profile:", insertError);
    }

    return new Response(JSON.stringify({ success: true, userId, method }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("[EXCEPTION] Erro crítico:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});