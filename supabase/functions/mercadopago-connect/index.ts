import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const MP_CLIENT_ID = Deno.env.get("MP_CLIENT_ID")!;
const MP_CLIENT_SECRET = Deno.env.get("MP_CLIENT_SECRET")!;
const REDIRECT_URL = Deno.env.get("MP_REDIRECT_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // user_id do profissional

    if (!code || !state) {
      return new Response(JSON.stringify({ error: "Parâmetros 'code' ou 'state' ausentes." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = state;

    // 1. Troca o code pelo token de acesso
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URL,
      }),
    });

    const tokenData = await tokenRes.json();
    
    if (!tokenRes.ok) {
      console.error("Erro OAuth MP:", tokenData);
      return new Response(JSON.stringify({ error: "Falha na autenticação com Mercado Pago", details: tokenData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Salva as credenciais no Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase.from("mp_connections").upsert({
      user_id: userId,
      mp_user_id: tokenData.user_id.toString(),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      token_type: tokenData.token_type,
      connected_at: new Date().toISOString(),
    });

    if (error) {
        throw error;
    }

    // Redireciona o usuário de volta para o app ou mostra mensagem de sucesso
    return new Response("Conta Mercado Pago conectada com sucesso! Você pode fechar esta janela.", {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});