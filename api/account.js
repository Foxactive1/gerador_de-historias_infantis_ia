import { getDatabase } from './_lib/database.js';
import { jsonError, requireUser } from './_lib/neon-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return jsonError(res, 405, 'Método não permitido.');
  try {
    const auth = await requireUser(req);
    if (auth.error) return jsonError(res, auth.status, auth.error);

    const sql = getDatabase();
    const userId = auth.user.id;
    await sql`INSERT INTO profiles (id) VALUES (${userId}) ON CONFLICT (id) DO NOTHING`;
    const profiles = await sql`SELECT plan FROM public.profiles WHERE id = ${userId}`;
    const [usage, stories] = await Promise.all([
      sql`SELECT count FROM public.usage WHERE user_id = ${userId} AND usage_date = (now() AT TIME ZONE 'utc')::date`,
      sql`SELECT id, story, created_at FROM public.stories WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20`,
    ]);
    return res.status(200).json({
      profile: profiles[0] || { plan: 'free' },
      usage: usage[0] || { count: 0 },
      stories,
    });
  } catch (error) {
    console.error('Erro ao carregar a conta:', error.message);
    return jsonError(res, 500, 'Não foi possível carregar seus dados. Verifique a conexão com o Neon.');
  }
}
