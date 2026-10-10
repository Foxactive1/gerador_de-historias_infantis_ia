import Stripe from 'stripe';
import { getAdminClient } from './_lib/supabase.js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Webhook de pagamentos não configurado.' });
  }

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(
      await readRawBody(req),
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.warn('Assinatura Stripe inválida:', error.message);
    return res.status(400).json({ error: 'Assinatura do webhook inválida.' });
  }

  try {
    const supabase = getAdminClient();
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      if (userId && session.mode === 'subscription') {
        const { error } = await supabase.from('profiles').update({
          plan: 'pro', stripe_customer_id: session.customer, stripe_subscription_id: session.subscription,
        }).eq('id', userId);
        if (error) throw error;
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;
      if (userId) {
        const active = event.type !== 'customer.subscription.deleted' && ['active', 'trialing'].includes(subscription.status);
        const { error } = await supabase.from('profiles').update({
          plan: active ? 'pro' : 'free',
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: active ? subscription.id : null,
        }).eq('id', userId);
        if (error) throw error;
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook Stripe:', error.message);
    return res.status(500).json({ error: 'Não foi possível processar o evento.' });
  }
}
