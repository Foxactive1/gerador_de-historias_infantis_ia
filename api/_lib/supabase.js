import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;

export async function requireUser(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: 'Faça login para continuar.', status: 401 };

  if (!supabaseUrl || !process.env.SUPABASE_ANON_KEY) {
    return { error: 'Autenticação não configurada no servidor.', status: 503 };
  }

  const client = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data.user) return { error: 'Sessão inválida ou expirada.', status: 401 };
  return { user: data.user };
}

export function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}
