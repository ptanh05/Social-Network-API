import { sql } from '../db/index.js'
import { verifyToken } from '../lib/jwt.js'
import { json, created, error, badRequest, notFound } from '../lib/errors.js'

async function getUser(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyToken(auth.slice(7))
  if (!payload || payload.type !== 'access') return null
  const { rows } = await sql`SELECT id, username, email, avatar_url, is_admin, created_at FROM users WHERE id = ${payload.sub}`
  return rows[0] || null
}

// POST /api/v1/reports/
export async function POST_report(request) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const body = await request.json()
  const { target_type, target_id, reason } = body

  if (!['post', 'comment', 'user'].includes(target_type)) {
    return badRequest('target_type must be: post, comment, or user')
  }
  if (!target_id) return badRequest('target_id is required')
  if (!reason || reason.trim().length < 5) {
    return badRequest('Reason must be at least 5 characters')
  }

  const { rows } = await sql`
    INSERT INTO reports (reporter_id, target_type, target_id, reason)
    VALUES (${user.id}, ${target_type}, ${target_id}, ${reason.trim()})
    RETURNING id, reporter_id, target_type, target_id, reason, status, created_at`

  return created(rows[0])
}

// GET /api/v1/reports/ — admin only
export async function GET_reports(request) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')
  if (!user.is_admin) return error(403, 'Admin access required')

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'pending'

  const { rows } = await sql`
    SELECT r.*, u.username as reporter_username
    FROM reports r
    JOIN users u ON u.id = r.reporter_id
    WHERE r.status = ${status}
    ORDER BY r.created_at DESC LIMIT 50`

  return json({ reports: rows })
}
