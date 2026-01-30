import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from 'https://esm.sh/stripe@14.21.0'

declare const Deno: any;

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticar usuário
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    const { lookup_key, return_url } = await req.json()
    
    // 2. Encontrar o Preço no Stripe baseado na lookup_key ou ID fornecido
    // O usuário forneceu "Oubook_Premium-7be1909" como lookup_key.
    // Se isso for um ID de Preço direto (price_...), usamos direto. 
    // Se for lookup_key real, buscamos.
    
    let priceId = lookup_key;
    
    // Se não começar com 'price_', tenta buscar pelo lookup_key
    if (!lookup_key.startsWith('price_')) {
        const prices = await stripe.prices.list({
            lookup_keys: [lookup_key],
            expand: ['data.product'],
        });
        if (prices.data.length > 0) {
            priceId = prices.data[0].id;
        } else {
             // Fallback: Se não achar, cria um preço on-the-fly ou usa um hardcoded se preferir.
             // Aqui vamos assumir que o usuário talvez não tenha configurado a lookup_key no painel ainda.
             // Se for o caso, lança erro para ele configurar.
             console.log("Price not found by lookup_key, assuming it might be a direct ID or needs creation.");
             // throw new Error("Preço não encontrado no Stripe. Verifique a lookup_key.");
        }
    }

    // 3. Criar Sessão de Checkout
    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [
        {
          price: priceId, 
          // Se o priceId for inválido (ex: lookup_key não achada), isso falhará aqui.
          // Para facilitar o teste rápido sem configurar produtos, você pode usar price_data:
          // price_data: { currency: 'brl', product_data: { name: 'Oubook Premium' }, unit_amount: 100, recurring: { interval: 'month' } },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${return_url}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${return_url}/?canceled=true`,
      client_reference_id: user.id, // IMPORTANTE: Identifica quem pagou no webhook
      customer_email: user.email,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})