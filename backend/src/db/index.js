import { sql } from '@vercel/postgres'

// Initialize database with schema
export async function initDb() {
  try {
    await sql`SELECT 1`
  } catch (e) {
    console.error('Database connection failed:', e)
  }
}

// Helper: get single row
export async function one(sqlStr, ...params) {
  const result = await sql`${sqlStr}`
  return result.rows[0] || null
}

// Helper: get all rows
export async function all(sqlStr, ...params) {
  const result = await sql`${sqlStr}`
  return result.rows
}

export { sql }
export default { sql, initDb, one, all }
