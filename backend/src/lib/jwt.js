import jwt from 'jsonwebtoken'

const SECRET = process.env.SECRET_KEY
if (!SECRET) throw new Error('SECRET_KEY env variable is required')

const ALGORITHM = process.env.ALGORITHM || 'HS256'

export const signAccessToken = (userId) =>
  jwt.sign({ sub: userId, type: 'access' }, SECRET, { algorithm: ALGORITHM, expiresIn: '15m' })

export const signRefreshToken = (userId) =>
  jwt.sign({ sub: userId, type: 'refresh' }, SECRET, { algorithm: ALGORITHM, expiresIn: '7d' })

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] })
  } catch {
    return null
  }
}
