import 'dotenv/config'
import pg from 'pg'

// تاریخ‌ها همان رشته‌ی YYYY-MM-DD بمانند (نه Date با اختلاف منطقه‌ی زمانی)، عددها عدد شوند
pg.types.setTypeParser(1082, (v) => v)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)))
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)))

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL تنظیم نشده است.')
  process.exit(1)
}
const local = /@(localhost|127\.0\.0\.1)/.test(url) && !/sslmode=require/.test(url)

export const pool = new pg.Pool({
  connectionString: url,
  ssl: local ? false : { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000, // Neon بعد از بیکاری چند ثانیه طول می‌کشد بیدار شود
})
pool.on('error', (e) => console.error('pg pool error:', e.message))

export const query = (text, params) => pool.query(text, params)

export async function tx(fn) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const out = await fn(client)
    await client.query('commit')
    return out
  } catch (e) {
    try { await client.query('rollback') } catch { /* ignore */ }
    throw e
  } finally {
    client.release()
  }
}
