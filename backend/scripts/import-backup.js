// انتقال داده‌های فعلی برنامه (LocalStorage) به Postgres.
// ۱) در برنامه‌ی فعلی: تنظیمات → «دانلود نسخه پشتیبان»  ۲) اجرا:  npm run import -- backup.json
// رمز کاربران (که در فایل پشتیبان متن ساده است) هش می‌شود. ردیف‌های ناسازگار رد و گزارش می‌شوند.
import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { pool, tx } from '../src/db.js'
import { RESOURCES } from '../src/resources.js'
import { normalizePermissions } from '../src/permissions.js'
import { coerce, snake } from '../src/util.js'

const file = process.argv[2]
if (!file) { console.error('usage: npm run import -- backup.json'); process.exit(1) }
const bk = JSON.parse(readFileSync(file, 'utf8'))
const list = (k) => (Array.isArray(bk[k]) ? bk[k] : [])
const skipped = []

async function importResource(c, def, key, fix = (x) => x) {
  let ok = 0
  for (const raw of [...list(key)].reverse()) { // فایل «جدیدترین اول» است؛ قدیمی‌ترین اول وارد می‌شود
    await c.query('savepoint s')
    try {
      if (!raw?.id) throw new Error('بدون id')
      const item = fix(raw)
      const patch = {}
      for (const [k, t] of Object.entries(def.columns)) if (item[k] !== undefined) patch[k] = coerce(t, item[k], k)
      def.validate?.(patch, {}) // «{}» یعنی حالت ویرایش: پرداخت زائرِ حذف‌شده هم وارد می‌شود
      if (def.table === 'payments') {
        const rate = Number(patch.exchangeRate)
        patch.usdAmount = patch.currency === 'دالر' ? patch.amount : rate > 0 ? patch.amount / rate : null
      }
      const keys = Object.keys(patch)
      const r = await c.query(
        `insert into "${def.table}" ("id", ${keys.map((k) => `"${snake(k)}"`).join(', ')})
         values ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')}) on conflict do nothing`,
        [String(raw.id), ...keys.map((k) => patch[k])])
      await c.query('release savepoint s')
      if (r.rowCount) ok++
      else skipped.push(`${def.table}: ${raw.id} (تکراری)`)
    } catch (e) {
      await c.query('rollback to savepoint s')
      skipped.push(`${def.table}: ${raw?.id ?? '?'} (${e.message})`)
    }
  }
  console.log(`  ${def.table}: ${ok}/${list(key).length}`)
}

await tx(async (c) => {
  for (const r of list('hums_roles')) {
    await c.query(
      `insert into roles (name, label, permissions) values ($1,$2,$3)
       on conflict (name) do update set label = excluded.label, permissions = excluded.permissions`,
      [r.name, r.label, normalizePermissions(r.permissions)])
  }
  for (const u of list('hums_users')) {
    if (!u.username || !u.password) { skipped.push(`users: ${u.username ?? '?'} (بدون رمز)`); continue }
    await c.query(
      `insert into users (username, password_hash, name, role) values ($1,$2,$3,$4) on conflict do nothing`,
      [u.username, await bcrypt.hash(String(u.password), 10), u.name || u.username, u.role])
  }
  await importResource(c, RESOURCES.companies, 'hums_companies')
  const companyIds = new Set((await c.query('select id from companies')).rows.map((r) => r.id))
  await importResource(c, RESOURCES.pilgrims, 'hums_pilgrims', (p) => ({ ...p, companyId: companyIds.has(p.companyId) ? p.companyId : '' }))
  const pilgrimIds = new Set((await c.query('select id from pilgrims')).rows.map((r) => r.id))
  await importResource(c, RESOURCES.payments, 'hums_payments', (p) => ({ ...p, pilgrimId: pilgrimIds.has(p.pilgrimId) ? p.pilgrimId : '' }))
  await importResource(c, RESOURCES.employees, 'hums_employees')
  await importResource(c, RESOURCES.expenses, 'hums_expenses')

  for (const l of [...list('hums_logs')].reverse()) {
    await c.query('insert into activity_logs (username, action, details, created_at) values ($1,$2,$3,$4)',
      [l.user || 'system', l.action || '', l.details || '', l.date || new Date().toISOString()])
  }
  const s = bk.hums_settings && typeof bk.hums_settings === 'object' ? bk.hums_settings : {}
  for (const k of ['companyName', 'logo', 'address', 'phone', 'email', 'displayCurrency', 'language']) {
    if (typeof s[k] === 'string') {
      await c.query(`insert into settings (key, value) values ($1, to_jsonb($2::text))
                     on conflict (key) do update set value = excluded.value`, [k, s[k]])
    }
  }
  // شماره فیش بعدی از بیشترین شماره‌ی واردشده ادامه پیدا کند
  await c.query(`
    select setval('receipt_seq', m) from (
      select greatest(9999, coalesce(max(nullif(regexp_replace(receipt_number, '\\D', '', 'g'), '')::bigint), 0)) m from payments
    ) x where m >= (select case when is_called then last_value else last_value - 1 end from receipt_seq)`)
})

if (skipped.length) {
  console.log(`\n${skipped.length} مورد وارد نشد:`)
  skipped.slice(0, 50).forEach((s) => console.log(' -', s))
}
console.log('✔ import finished')
await pool.end()
