import { sql } from '../db/index.js'
import { verifyToken } from '../lib/jwt.js'
import { json, created, error, notFound, forbidden } from '../lib/errors.js'

async function getUser(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyToken(auth.slice(7))
  if (!payload || payload.type !== 'access') return null
  const { rows } = await sql`SELECT id, username, email, avatar_url, is_admin, created_at FROM users WHERE id = ${payload.sub}`
  return rows[0] || null
}

function attachTopics(posts) {
  return posts.map(p => ({ ...p, topics: [] }))
}

// GET /api/v1/bookmarks/?cursor=&limit=20
export async function GET_bookmarks(request) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)

  let query
  if (cursor) {
    query = sql`
      SELECT p.id, p.content, p.author_id, p.created_at, p.updated_at, p.likes_count, p.comments_count,
        b.created_at as bookmarked_at,
        u.id as "author.id", u.username as "author.username", u.email as "author.email",
        u.date_of_birth as "author.date_of_birth", u.is_admin as "author.is_admin", u.created_at as "author.created_at"
      FROM bookmarks b
      JOIN posts p ON p.id = b.post_id
      JOIN users u ON u.id = p.author_id
      WHERE b.user_id = ${user.id} AND b.created_at < ${cursor}
      ORDER BY b.created_at DESC LIMIT ${limit + 1}`
  } else {
    query = sql`
      SELECT p.id, p.content, p.author_id, p.created_at, p.updated_at, p.likes_count, p.comments_count,
        b.created_at as bookmarked_at,
        u.id as "author.id", u.username as "author.username", u.email as "author.email",
        u.date_of_birth as "author.date_of_birth", u.is_admin as "author.is_admin", u.created_at as "author.created_at"
      FROM bookmarks b
      JOIN posts p ON p.id = b.post_id
      JOIN users u ON u.id = p.author_id
      WHERE b.user_id = ${user.id}
      ORDER BY b.created_at DESC LIMIT ${limit + 1}`
  }

  const { rows } = await query
  const hasMore = rows.length > limit
  const items = rows.slice(0, limit).map(p => ({
    id: p.id, content: p.content, author_id: p.author_id,
    created_at: p.created_at, updated_at: p.updated_at,
    likes_count: p.likes_count, comments_count: p.comments_count, topics: [],
    author: {
      id: p['author.id'], username: p['author.username'], email: p['author.email'],
      date_of_birth: p['author.date_of_birth'], is_admin: p['author.is_admin'], created_at: p['author.created_at'],
    },
  }))
  const next_cursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null

  return json({ posts: items, next_cursor })
}

// POST /api/v1/bookmarks/posts/{id}/
export async function POST_bookmark(request, postId) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const { rows: post } = await sql`SELECT id FROM posts WHERE id = ${postId}`
  if (!post[0]) return notFound('Post not found')

  try {
    await sql`INSERT INTO bookmarks (user_id, post_id) VALUES (${user.id}, ${postId})`
    return created({ bookmarked: true })
  } catch (e) {
    if (e.code === '23505') return json({ bookmarked: true }) // already bookmarked
    throw e
  }
}

// DELETE /api/v1/bookmarks/posts/{id}/
export async function DELETE_bookmark(request, postId) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const result = await sql`DELETE FROM bookmarks WHERE user_id = ${user.id} AND post_id = ${postId} RETURNING *`
  if (!result.rowCount) return notFound('Bookmark not found')
  return json({ bookmarked: false })
}

// GET /api/v1/bookmarks/posts/{id}/status
export async function GET_bookmark_status(request, postId) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const { rows } = await sql`SELECT 1 FROM bookmarks WHERE user_id = ${user.id} AND post_id = ${postId} LIMIT 1`
  return json({ bookmarked: rows.length > 0 })
}
