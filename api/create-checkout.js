import Stripe from 'stripe';
import { jsonError, requireUser } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return jsonError(res, 405, 'Método não permitido.');
  try {
    const auth = await requireUser(req);
    if (auth.error) return jsonError(res, auth.status, auth.error);

    const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID, BASE_URL } = process.env;
    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID || !BASE_URL) {
      return jsonError(res, 503, 'A assinatura ainda não está configurada.');
    }
    if (!auth.user.email) return jsonError(res, 400, 'Sua conta não possui um e-mail para o checkout.');

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: auth.user.email,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { user_id: auth.user.id },
      subscription_data: { metadata: { user_id: auth.user.id } },
      success_url: `${BASE_URL}/?checkout=success`,
      cancel_url: `${BASE_URL}/?checkout=cancelled`,
    });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar checkout:', error.message);
    return jsonError(res, 502, 'Não foi possível iniciar o pagamento. Tente novamente.');
  }
}
