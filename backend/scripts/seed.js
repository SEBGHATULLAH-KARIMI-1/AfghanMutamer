import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'
import { DEFAULT_ROLES } from '../src/permissions.js'

try {
  for (const r of DEFAULT_ROLES) {
    await pool.query(
      'insert into roles (name, label, permissions) values ($1,$2,$3) on conflict (name) do nothing',
      [r.name, r.label, r.permissions])
  }
  await pool.query(
    `insert into settings (key, value) values ('companyName', to_jsonb($1::text)) on conflict (key) do nothing`,
    ['شرکت خدمات حج و عمره'])

  const { rows } = await pool.query('select count(*)::int as n from users')
  if (rows[0].n === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin'
    let password = process.env.ADMIN_PASSWORD
    const generated = !password
    if (generated) password = randomBytes(9).toString('base64url')
    await pool.query(
      'insert into users (username, password_hash, name, role) values ($1,$2,$3,$4)',
      [username, await bcrypt.hash(password, 10), 'مدیر سیستم', 'Admin'])
    console.log(`✔ admin user created: ${username}`)
    if (generated) console.log(`  رمز تصادفی (فقط همین یک بار نمایش داده می‌شود): ${password}`)
  }
  console.log('✔ seed done')
} catch (e) {
  console.error('seed failed:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
