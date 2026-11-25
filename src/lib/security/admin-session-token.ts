import { SignJWT, jwtVerify } from 'jose';

export const ADMIN_COOKIE_NAME = '__Host-amk_admin';
export const ADMIN_CSRF_HEADER = 'x-amk-admin-csrf';
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export interface AdminSessionPayload {
  sub: 'admin';
  iat: number;
  exp: number;
}

function getSecretKeyBytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAdminSessionToken(
  secret: string,
  ttlSeconds = ADMIN_SESSION_TTL_SECONDS,
): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecretKeyBytes(secret));
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  secret: string | undefined,
): Promise<AdminSessionPayload | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKeyBytes(secret), {
      algorithms: ['HS256'],
      subject: 'admin',
    });
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
      return null;
    }
    return {
      sub: 'admin',
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
