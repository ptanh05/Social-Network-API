import pg from 'pg';
import bcrypt from 'bcryptjs';

const DATABASE_URL = 'postgresql://neondb_owner:npg_baklFepSvu91@ep-crimson-block-a14tt9fb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();

  try {
    // Check existing users
    const users = await client.query('SELECT id, username, email FROM users LIMIT 10');
    console.log('Existing users:');
    if (users.rows.length === 0) {
      console.log('  (none)');
    } else {
      users.rows.forEach(u => console.log(`  [${u.id}] ${u.username} <${u.email}>`));
    }

    // Create or reset test user
    const testUsername = process.argv[2] || 'testuser';
    const testPassword = process.argv[3] || 'password123';
    const testEmail = process.argv[4] || 'testuser@example.com';

    const hashed = await bcrypt.hash(testPassword, 10);

    // Upsert user
    await client.query(`
      INSERT INTO users (username, email, hashed_password, is_admin)
      VALUES ($1, $2, $3, false)
      ON CONFLICT (username) DO UPDATE SET hashed_password = $3
    `, [testUsername, testEmail, hashed]);

    const created = await client.query('SELECT id, username, email FROM users WHERE username = $1', [testUsername]);
    console.log(`\nUser "${testUsername}":`);
    console.log(`  Email:    ${created.rows[0].email}`);
    console.log(`  Password: ${testPassword}`);
    console.log(`  (hashed and stored in DB)`);

    // Also upsert by email
    await client.query(`
      INSERT INTO users (username, email, hashed_password, is_admin)
      VALUES ($1, $2, $3, false)
      ON CONFLICT (email) DO UPDATE SET username = $1, hashed_password = $3
    `, [testUsername, testEmail, hashed]);

    console.log('\nDone!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
