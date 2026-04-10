import { sql } from '../db/index.js'
import { verifyToken } from '../lib/jwt.js'
import { json, error, notFound, forbidden } from '../lib/errors.js'

async function getUser(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyToken(auth.slice(7))
  if (!payload || payload.type !== 'access') return null
  const { rows } = await sql`SELECT id, username, email, avatar_url, is_admin, created_at FROM users WHERE id = ${payload.sub}`
  return rows[0] || null
}

async function requireAdmin(request) {
  const user = await getUser(request)
  if (!user) return { error: error(401, 'Unauthorized'), user: null }
  if (!user.is_admin) return { error: forbidden('Admin access required'), user: null }
  return { error: null, user }
}

// GET /api/v1/admin/stats
export async function GET_admin_stats(request) {
  const { error: err, user } = await requireAdmin(request)
  if (err) return err

  const [{ count: total_users }] = await sql`SELECT COUNT(*) as count FROM users`
  const [{ count: total_posts }] = await sql`SELECT COUNT(*) as count FROM posts`
  const [{ count: total_comments }] = await sql`SELECT COUNT(*) as count FROM comments`
  const [{ count: pending_reports }] = await sql`SELECT COUNT(*) as count FROM reports WHERE status = 'pending'`
  const [{ count: active_today }] = await sql`
    SELECT COUNT(DISTINCT user_id) as count FROM notifications
    WHERE created_at > NOW() - INTERVAL '24 hours'`

  return json({
    total_users: parseInt(total_users),
    total_posts: parseInt(total_posts),
    total_comments: parseInt(total_comments),
    pending_reports: parseInt(pending_reports),
    active_users_today: parseInt(active_today),
  })
}

// GET /api/v1/admin/stats/daily?days=30
export async function GET_admin_stats_daily(request) {
  const { error: err, user } = await requireAdmin(request)
  if (err) return err

  const url = new URL(request.url)
  const days = parseInt(url.searchParams.get('days') || '30', 10)

  const { rows } = await sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*) FILTER (WHERE 'user' = (SELECT 'user' FROM users LIMIT 1)) as new_users,
      (SELECT COUNT(*) FROM posts p WHERE DATE(p.created_at) = DATE(notifications.created_at)) as new_posts
    FROM notifications
    WHERE created_at > NOW() - (${days} || ' days')::INTERVAL
    GROUP BY DATE(created_at)
    ORDER BY date ASC`

  return json({ daily: rows })
}

// PUT /api/v1/admin/reports/{id}/resolve
export async function PUT_admin_resolve_report(request, id) {
  const { error: err } = await requireAdmin(request)
  if (err) return err

  const body = await request.json()
  const { status } = body // 'resolved' | 'dismissed'
  if (!['resolved', 'dismissed'].includes(status)) {
    return error(400, 'Status must be resolved or dismissed')
  }

  const result = await sql`UPDATE reports SET status = ${status} WHERE id = ${id} RETURNING id`
  if (!result.rowCount) return notFound('Report not found')
  return json({ success: true })
}

// DELETE /api/v1/admin/users/{id}
export async function DELETE_admin_ban_user(request, id) {
  const { error: err, user } = await requireAdmin(request)
  if (err) return err
  if (user.id === Number(id)) return forbidden('Cannot ban yourself')

  const result = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`
  if (!result.rowCount) return notFound('User not found')
  return json({ success: true })
}

// DELETE /api/v1/admin/posts/{id}
export async function DELETE_admin_delete_post(request, id) {
  const { error: err } = await requireAdmin(request)
  if (err) return err

  const result = await sql`DELETE FROM posts WHERE id = ${id} RETURNING id`
  if (!result.rowCount) return notFound('Post not found')
  return json({ success: true })
}
