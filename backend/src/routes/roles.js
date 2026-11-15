import { Router } from 'express'
import { query, tx } from '../db.js'
import { requirePerm } from '../auth.js'
import { normalizePermissions } from '../permissions.js'
import { HttpError, logActivity } from '../util.js'

const router = Router()
router.use(requirePerm('settings', 'view'))

function parse(b) {
  const name = String(b?.name ?? '').trim()
  const label = String(b?.label ?? '').trim()
  if (!name || !label) throw new HttpError(400, 'نام و عنوان نقش را وارد کنید')
  return { name, label, permissions: normalizePermissions(b.permissions) }
}

router.get('/', async (_req, res) => {
  const { rows } = await query('select id, name, label, permissions from roles order by seq')
  res.json(rows)
})

router.post('/', async (req, res) => {
  const d = parse(req.body)
  const row = await tx(async (c) => {
    const { rows } = await c.query(
      'insert into roles (name, label, permissions) values ($1,$2,$3) returning id, name, label, permissions',
      [d.name, d.label, d.permissions])
    await logActivity(c, req.user.username, 'افزودن نقش', `نقش "${d.label}" ایجاد شد`)
    return rows[0]
  })
  res.status(201).json(row)
})

router.put('/:id', async (req, res) => {
  const d = parse(req.body)
  const row = await tx(async (c) => {
    const cur = await c.query('select name from roles where id = $1 for update', [req.params.id])
    if (!cur.rows[0]) throw new HttpError(404, 'نقش یافت نشد')
    // قفل‌شدن خود کاربر جلوگیری می‌شود
    if (cur.rows[0].name === req.user.role) {
      if (d.name !== cur.rows[0].name) throw new HttpError(400, 'نقش خودتان را نمی‌توانید بازنامی کنید')
      if (!d.permissions.settings.view) throw new HttpError(400, 'نقش شما باید دسترسی «مشاهده» تنظیمات را حفظ کند')
    }
    // تغییر نام نقش به‌صورت خودکار در کاربران هم اعمال می‌شود (on update cascade)
    const { rows } = await c.query(
      'update roles set name=$1, label=$2, permissions=$3 where id=$4 returning id, name, label, permissions',
      [d.name, d.label, d.permissions, req.params.id])
    await logActivity(c, req.user.username, 'ویرایش نقش', `نقش "${d.label}" ویرایش شد`)
    return rows[0]
  })
  res.json(row)
})

router.delete('/:id', async (req, res) => {
  await tx(async (c) => {
    const cur = await c.query('select name, label from roles where id = $1', [req.params.id])
    if (!cur.rows[0]) throw new HttpError(404, 'نقش یافت نشد')
    const n = await c.query('select count(*)::int as n from users where role = $1', [cur.rows[0].name])
    if (n.rows[0].n > 0) throw new HttpError(409, `امکان حذف نقش وجود ندارد. ${n.rows[0].n} کاربر با این نقش ثبت شده است.`)
    await c.query('delete from roles where id = $1', [req.params.id])
    await logActivity(c, req.user.username, 'حذف نقش', `نقش "${cur.rows[0].label}" حذف شد`)
  })
  res.status(204).end()
})

export default router
