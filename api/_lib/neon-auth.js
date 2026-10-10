import { createRemoteJWKSet, jwtVerify } from 'jose';

let remoteJwks;

function getJwks() {
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
  if (!jwksUrl) throw new Error('NEON_AUTH_JWKS_URL não está configurada.');
  if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(jwksUrl));
  return remoteJwks;
}

export async function requireUser(req) {
  const match = (req.headers.authorization || '').match(/^Bearer\\s+(.+)$/i);
  if (!match) return { error: 'Faça login para continuar.', status: 401 };

  const issuer = process.env.NEON_AUTH_BASE_URL;
  if (!issuer || !process.env.NEON_AUTH_JWKS_URL) {
    return { error: 'Neon Auth não está configurado no servidor.', status: 503 };
  }

  try {
    const { payload } = await jwtVerify(match[1], getJwks(), {
      issuer,
      algorithms: ['EdDSA'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub) {
      return { error: 'Sessão inválida ou expirada.', status: 401 };
    }
    return { user: { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : null } };
  } catch {
    return { error: 'Sessão inválida ou expirada.', status: 401 };
  }
}

export function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}
