import jwt from 'jsonwebtoken';

const SECRET = process.env.SECRET_KEY || 'fallback-secret';
const ALGORITHM = process.env.ALGORITHM || 'HS256';
const EXPIRE_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '10', 10);

export interface TokenPayload {
  sub: number;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export function signAccessToken(userId: number): string {
  return jwt.sign({ sub: userId, type: 'access' }, SECRET, {
    algorithm: ALGORITHM as jwt.Algorithm,
    expiresIn: `${EXPIRE_MINUTES}m`,
  });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, SECRET, {
    algorithm: ALGORITHM as jwt.Algorithm,
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET, { algorithms: [ALGORITHM as jwt.Algorithm] }) as unknown as TokenPayload;
  } catch {
    return null;
  }
}
