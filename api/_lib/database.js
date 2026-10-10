import { neon } from '@neondatabase/serverless';

export function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL do Neon não está configurada.');
  return neon(process.env.DATABASE_URL);
}
