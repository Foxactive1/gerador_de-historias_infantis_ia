import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { user_id, email } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: email,
    line_items: [{
      price: process.env.STRIPE_PRICE_ID,
      quantity: 1,
    }],
    success_url: `${process.env.BASE_URL}/dashboard?success=true`,
    cancel_url: `${process.env.BASE_URL}/dashboard?cancel=true`,
  });

  res.json({ url: session.url });
}