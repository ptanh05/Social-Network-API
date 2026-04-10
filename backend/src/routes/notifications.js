import { sql } from '../db/index.js'
import { verifyToken } from '../lib/jwt.js'
import { json, error, notFound } from '../lib/errors.js'

// Attach user from Bearer token
async function getUser(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyToken(auth.slice(7))
  if (!payload || payload.type !== 'access') return null
  const { rows } = await sql`SELECT id, username, email, avatar_url, is_admin, created_at FROM users WHERE id = ${payload.sub}`
  return rows[0] || null
}

// GET /api/v1/notifications/?cursor=&limit=20
export async function GET_notifications(request) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)

  let query
  if (cursor) {
    query = sql`
      SELECT id, user_id, type, data, is_read, created_at
      FROM notifications
      WHERE user_id = ${user.id} AND id < ${parseInt(cursor, 10)}
      ORDER BY id DESC LIMIT ${limit + 1}`
  } else {
    query = sql`
      SELECT id, user_id, type, data, is_read, created_at
      FROM notifications
      WHERE user_id = ${user.id}
      ORDER BY id DESC LIMIT ${limit + 1}`
  }

  const { rows } = await query
  const hasMore = rows.length > limit
  const items = rows.slice(0, limit)
  const next_cursor = hasMore && items.length > 0 ? items[items.length - 1].id : null

  return json({ notifications: items, next_cursor })
}

// GET /api/v1/notifications/unread-count
export async function GET_notifications_count(request) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const { rows } = await sql`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${user.id} AND is_read = FALSE`
  return json({ count: parseInt(rows[0].count) })
}

// PUT /api/v1/notifications/{id}/read
export async function PUT_notification_read(request, id) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const result = await sql`UPDATE notifications SET is_read = TRUE WHERE id = ${id} AND user_id = ${user.id} RETURNING id`
  if (!result.rowCount) return notFound('Notification not found')
  return json({ success: true })
}

// PUT /api/v1/notifications/read-all
export async function PUT_notifications_read_all(request) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  await sql`UPDATE notifications SET is_read = TRUE WHERE user_id = ${user.id} AND is_read = FALSE`
  return json({ success: true })
}

// POST /api/v1/notifications/ — internal helper to create a notification
export async function createNotification(userId, type, data) {
  await sql`
    INSERT INTO notifications (user_id, type, data)
    VALUES (${userId}, ${type}, ${JSON.stringify(data)})`
}

// GET /api/v1/notifications/stream — SSE endpoint
export async function GET_notifications_stream(request) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  // Return SSE headers — client uses EventSource
  return new Response(
    new ReadableStream({
      start(controller) {
        // Send heartbeat every 30s
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(`: heartbeat\n\n`)
          } catch {
            clearInterval(heartbeat)
          }
        }, 30000)

        // Store encoder for cleanup
        request._sseController = controller
        request._sseHeartbeat = heartbeat
        request._sseUserId = user.id
      },
      cancel() {
        if (request._sseHeartbeat) clearInterval(request._sseHeartbeat)
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }
  )
}
