import { sql } from '../db/index.js'
import { signAccessToken, signRefreshToken, verifyToken } from '../lib/jwt.js'
import { hashPassword, verifyPassword } from '../lib/bcrypt.js'
import { json, created, error, unauthorized, badRequest } from '../lib/errors.js'

// POST /api/v1/auth/register
export async function POST_auth_register(request) {
  const body = await request.json()
  const { username, email, password, date_of_birth } = body

  if (!username || username.length < 3) return badRequest('Username must be at least 3 characters')
  if (!email || !email.includes('@')) return badRequest('Invalid email')
  if (!password || password.length < 6) return badRequest('Password must be at least 6 characters')

  try {
    const hashed = await hashPassword(password)
    const { rows } = await sql`
      INSERT INTO users (username, email, hashed_password, date_of_birth)
      VALUES (${username}, ${email}, ${hashed}, ${date_of_birth || null})
      RETURNING id, username, email, date_of_birth, is_admin, created_at`
    return created(rows[0])
  } catch (e) {
    if (e.code === '23505') {
      const field = e.constraint?.includes('username') ? 'Username' : 'Email'
      return badRequest(`${field} already registered`)
    }
    console.error('Register error:', e)
    return error(500, 'Registration failed')
  }
}

// POST /api/v1/auth/login
export async function POST_auth_login(request) {
  const body = await request.json()
  const { username, password } = body

  if (!username || !password) return badRequest('Username and password are required')

  const { rows } = await sql`SELECT * FROM users WHERE username = ${username} OR email = ${username}`
  const user = rows[0]
  if (!user) return unauthorized('Incorrect username or password')

  const valid = await verifyPassword(password, user.hashed_password)
  if (!valid) return unauthorized('Incorrect username or password')

  const access_token = signAccessToken(user.id)
  const refresh_token = signRefreshToken(user.id)

  // Store refresh token hash in DB
  const { hashPassword: hashRT } = await import('../lib/bcrypt.js')
  const tokenHash = await hashRT(refresh_token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await sql`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (${user.id}, ${tokenHash}, ${expiresAt})`

  return json({ access_token, refresh_token, token_type: 'bearer', expires_in: 900 })
}

// POST /api/v1/auth/refresh
export async function POST_auth_refresh(request) {
  const body = await request.json()
  const { refresh_token } = body

  if (!refresh_token) return badRequest('refresh_token is required')

  const payload = verifyToken(refresh_token)
  if (!payload || payload.type !== 'refresh') {
    return unauthorized('Invalid refresh token')
  }

  // Verify refresh token exists in DB
  const { rows: tokenRows } = await sql`
    SELECT rt.id, rt.token_hash, rt.user_id FROM refresh_tokens rt
    WHERE rt.user_id = ${payload.sub} AND rt.expires_at > NOW()
    ORDER BY rt.created_at DESC LIMIT 1`
  if (!tokenRows[0]) return unauthorized('Refresh token not found or expired')

  // Delete old refresh token
  await sql`DELETE FROM refresh_tokens WHERE id = ${tokenRows[0].id}`

  // Issue new tokens
  const newAccessToken = signAccessToken(payload.sub)
  const newRefreshToken = signRefreshToken(payload.sub)

  const { hashPassword: hashRT } = await import('../lib/bcrypt.js')
  const newHash = await hashRT(newRefreshToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await sql`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (${payload.sub}, ${newHash}, ${expiresAt})`

  return json({ access_token: newAccessToken, refresh_token: newRefreshToken, token_type: 'bearer', expires_in: 900 })
}

// POST /api/v1/auth/logout
export async function POST_auth_logout(request) {
  const body = await request.json()
  const { refresh_token } = body

  if (refresh_token) {
    const payload = verifyToken(refresh_token)
    if (payload) {
      await sql`DELETE FROM refresh_tokens WHERE user_id = ${payload.sub}`
    }
  }
  return json({ success: true })
}
