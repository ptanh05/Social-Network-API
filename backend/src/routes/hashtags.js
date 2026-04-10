import { sql } from '../db/index.js'
import { verifyToken } from '../lib/jwt.js'
import { json, error } from '../lib/errors.js'

async function getUser(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyToken(auth.slice(7))
  if (!payload || payload.type !== 'access') return null
  const { rows } = await sql`SELECT id, username, email, avatar_url, is_admin, created_at FROM users WHERE id = ${payload.sub}`
  return rows[0] || null
}

// GET /api/v1/hashtags/trending?limit=10
export async function GET_trending_hashtags(request) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '10', 10)

  const { rows } = await sql`
    SELECT id, name, post_count FROM hashtags
    ORDER BY post_count DESC, created_at DESC
    LIMIT ${limit}`

  return json({ hashtags: rows })
}

// GET /api/v1/hashtags/{name}/posts?cursor=&limit=20
export async function GET_hashtag_posts(request, name) {
  const user = await getUser(request)
  if (!user) return error(401, 'Unauthorized')

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)

  let query
  if (cursor) {
    query = sql`
      SELECT p.id, p.content, p.author_id, p.created_at, p.updated_at, p.likes_count, p.comments_count,
        u.id as "author.id", u.username as "author.username", u.email as "author.email",
        u.date_of_birth as "author.date_of_birth", u.is_admin as "author.is_admin", u.created_at as "author.created_at"
      FROM posts p
      JOIN users u ON u.id = p.author_id
      JOIN hashtags h ON h.name = ${name.toLowerCase()}
      WHERE p.content ILIKE ${'%#' + name + '%'} AND p.created_at < ${cursor}
      ORDER BY p.created_at DESC LIMIT ${limit + 1}`
  } else {
    query = sql`
      SELECT p.id, p.content, p.author_id, p.created_at, p.updated_at, p.likes_count, p.comments_count,
        u.id as "author.id", u.username as "author.username", u.email as "author.email",
        u.date_of_birth as "author.date_of_birth", u.is_admin as "author.is_admin", u.created_at as "author.created_at"
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.content ILIKE ${'%#' + name + '%'}
      ORDER BY p.created_at DESC LIMIT ${limit + 1}`
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

// Extract and save hashtags from post content
export async function extractAndSaveHashtags(postId, content) {
  const hashtagRegex = /#(\w+)/g
  const matches = [...content.matchAll(hashtagRegex)]
  for (const match of matches) {
    const name = match[1].toLowerCase()
    try {
      await sql`
        INSERT INTO hashtags (name, post_count)
        VALUES (${name}, 1)
        ON CONFLICT (name) DO UPDATE SET post_count = hashtags.post_count + 1`
    } catch {
      // ignore
    }
  }
}
