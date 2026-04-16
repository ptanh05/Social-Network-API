import jwt from 'jsonwebtoken';
const SECRET = process.env.SECRET_KEY || 'fallback-secret';
const ALGORITHM = process.env.ALGORITHM || 'HS256';
const EXPIRE_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '10', 10);
export function signAccessToken(userId) {
    return jwt.sign({ sub: userId, type: 'access' }, SECRET, {
        algorithm: ALGORITHM,
        expiresIn: `${EXPIRE_MINUTES}m`,
    });
}
export function signRefreshToken(userId) {
    return jwt.sign({ sub: userId, type: 'refresh' }, SECRET, {
        algorithm: ALGORITHM,
        expiresIn: '7d',
    });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
    }
    catch {
        return null;
    }
}
