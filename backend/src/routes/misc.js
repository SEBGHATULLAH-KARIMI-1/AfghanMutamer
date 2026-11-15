import { Router } from 'express'
import { query, tx } from '../db.js'
import { authenticate, requireAny, requirePerm } from '../auth.js'
import { HttpError, camelize, logActivity } from '../util.js'

const router = Router()

// ── تنظیمات شرکت: همه‌ی کاربران وارد‌شده می‌خوانند (برای رسید و هدر)، فقط مدیر تنظیمات تغییر می‌دهد
const SETTING_KEYS = ['companyName', 'logo', 'address', 'phone', 'email', 'displayCurrency', 'language']
const readSettings = async () => {
  const { rows } = await query('select key, value from settings')
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

router.get('/settings', authenticate, async (_req, res) => res.json(await readSettings()))

router.put('/settings', requirePerm('settings', 'view'), async (req, res) => {
  const b = req.body ?? {}
  const entries = SETTING_KEYS.filter((k) => b[k] !== undefined)
  for (const k of entries) if (typeof b[k] !== 'string') throw new HttpError(400, `مقدار ${k} نامعتبر است`)
  if (b.phone && b.phone.replace(/\D/g, '').length < 7) throw new HttpError(400, 'شماره تماس معتبر نیست')
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email.trim())) throw new HttpError(400, 'ایمیل معتبر نیست')
  await tx(async (c) => {
    for (const k of entries) {
      await c.query(
        `insert into settings (key, value) values ($1, $2::jsonb)
         on conflict (key) do update set value = excluded.value`,
        [k, JSON.stringify(b[k])])
    }
    await logActivity(c, req.user.username, 'بروزرسانی تنظیمات', 'تنظیمات سیستم بروزرسانی شد')
  })
  res.json(await readSettings())
})

// ── گزارش فعالیت‌ها
router.get('/logs', requireAny(['dashboard', 'settings']), async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 1000)
  const { rows } = await query(
    'select id, created_at as date, username as "user", action, details from activity_logs order by seq desc limit $1',
    [limit])
  res.json(rows)
})

// ── پشتیبان‌گیری (بدون هش رمزها)
router.get('/backup', requirePerm('settings', 'view'), async (_req, res) => {
  const tables = ['roles', 'companies', 'pilgrims', 'payments', 'employees', 'expenses', 'activity_logs', 'settings']
  const data = {}
  for (const t of tables) data[t] = (await query(`select * from "${t}"${t === 'settings' ? '' : ' order by seq'}`)).rows.map(({ seq, ...r }) => camelize(r))
  data.users = (await query('select id, username, name, role from users order by seq')).rows
  res.setHeader('Content-Disposition', `attachment; filename="hums-backup-${new Date().toISOString().slice(0, 10)}.json"`)
  res.json({ version: 1, exportedAt: new Date().toISOString(), data })
})

export default router
