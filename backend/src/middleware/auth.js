import { verifyToken } from '../lib/jwt.js'
import { sql } from '../db/index.js'
import { err } from '../lib/errors.js'

export function withAuth(handler) {
  return async (request, ...args) => {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return err(401, 'Missing authorization header')
    }
    const payload = verifyToken(auth.slice(7))
    if (!payload || payload.type !== 'access') {
      return err(401, 'Invalid or expired token')
    }
    const result = await sql`SELECT id, username, email, date_of_birth, avatar_url, is_admin, created_at FROM users WHERE id = ${payload.sub}`
    if (!result.rows[0]) return err(401, 'User not found')
    request.user = result.rows[0]
    return handler(request, ...args)
  }
}
