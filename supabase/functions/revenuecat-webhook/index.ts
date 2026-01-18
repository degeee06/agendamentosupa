
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const event = body.event;
    const userId = event.app_user_id; // O UUID do usuário no Supabase
    const type = event.type;

    console.log(`Recebido evento ${type} para o usuário ${userId}`);

    let newPlan = 'trial';
    
    // Lista de eventos que garantem status Premium
    const premiumEvents = [
        'INITIAL_PURCHASE',
        'RENEWAL',
        'RESTORE',
        'UNCANCELLATION'
    ];

    // Lista de eventos que removem status Premium
    const expirationEvents = [
        'EXPIRATION',
        'CANCELLATION',
        'BILLING_ISSUE',
        'REFUND'
    ];

    if (premiumEvents.includes(type)) {
        newPlan = 'premium';
    } else if (expirationEvents.includes(type)) {
        newPlan = 'trial';
    } else {
        // Para outros eventos, não alteramos nada
        return new Response(JSON.stringify({ message: 'Evento ignorado' }), { status: 200 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
          plan: newPlan,
          // Se for premium, podemos definir uma data de expiração baseada no evento se desejar
      })
      .eq('id', userId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro no Webhook:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
