import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from 'https://esm.sh/stripe@14.21.0'

declare const Deno: any;

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature || !endpointSecret) {
      return new Response('Webhook secret not configured', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)
    
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- EVENTO 1: Assinatura/Compra Premium (Checkout) ---
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.client_reference_id

      if (userId) {
        console.log(`Upgrade Premium recebido para usuário: ${userId}`)

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ 
            plan: 'premium',
          })
          .eq('id', userId)

        if (error) {
            console.error('Erro ao atualizar perfil:', error)
            return new Response('Database error', { status: 500 })
        }
      }
    }

    // --- EVENTO 2: Pagamento de Agendamento (Pix/PaymentIntent) ---
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const appointmentId = paymentIntent.metadata.appointmentId;
        const professionalId = paymentIntent.metadata.professionalId; // ID do admin/profissional

        if (appointmentId) {
            console.log(`Pagamento de agendamento confirmado: ${appointmentId}`);

            // 1. Atualiza status do pagamento na tabela payments
            await supabaseAdmin
                .from('payments')
                .update({ status: 'approved', updated_at: new Date().toISOString() })
                .eq('mp_payment_id', paymentIntent.id); // Usamos essa coluna para guardar o Stripe ID

            // 2. Atualiza status do agendamento para Confirmado
            const { data: updatedRows, error } = await supabaseAdmin
                .from('appointments')
                .update({ status: 'Confirmado' })
                .eq('id', appointmentId)
                .select(); // Retorna os dados para podermos notificar

            if (error) {
                console.error('Erro ao confirmar agendamento:', error);
            }

            // 3. Tenta notificar o profissional (Push)
            // Requer que a notification logic esteja disponível ou duplicada aqui.
            // Para simplificar, assumimos que o realtime no frontend já atualizará a UI do admin.
            // Se necessário, poderiamos invocar a edge function de push aqui via fetch.
        }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})