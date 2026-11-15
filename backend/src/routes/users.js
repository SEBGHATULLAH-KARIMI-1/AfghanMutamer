import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query, tx } from '../db.js'
import { requirePerm } from '../auth.js'
import { HttpError, logActivity } from '../util.js'

const router = Router()
router.use(requirePerm('settings', 'view'))

const COLS = 'id, username, name, role, created_at as "createdAt"'

async function checkInput(b, { requirePassword }) {
  const username = String(b.username ?? '').trim()
  const name = String(b.name ?? '').trim()
  const role = String(b.role ?? '').trim()
  const password = b.password == null ? '' : String(b.password)
  if (!username || !name || !role) throw new HttpError(400, 'لطفا تمامی فیلدها را تکمیل کنید')
  if (requirePassword && !password) throw new HttpError(400, 'رمز عبور الزامی است')
  if (password && (password.length < 6 || password.length > 200)) throw new HttpError(400, 'رمز عبور باید حداقل ۶ کاراکتر باشد')
  const r = await query('select 1 from roles where name = $1', [role])
  if (!r.rowCount) throw new HttpError(400, 'نقش انتخاب‌شده وجود ندارد')
  return { username, name, role, password }
}

router.get('/', async (_req, res) => {
  const { rows } = await query(`select ${COLS} from users order by seq`)
  res.json(rows)
})

router.post('/', async (req, res) => {
  const d = await checkInput(req.body ?? {}, { requirePassword: true })
  const hash = await bcrypt.hash(d.password, 10)
  const row = await tx(async (c) => {
    const { rows } = await c.query(
      `insert into users (username, password_hash, name, role) values ($1,$2,$3,$4) returning ${COLS}`,
      [d.username, hash, d.name, d.role])
    await logActivity(c, req.user.username, 'افزودن کاربر', `کاربر "${d.username}" ایجاد شد`)
    return rows[0]
  })
  res.status(201).json(row)
})

router.put('/:id', async (req, res) => {
  const d = await checkInput(req.body ?? {}, { requirePassword: false })
  if (req.params.id === req.user.id && d.role !== req.user.role) {
    throw new HttpError(400, 'نقش حساب خودتان را نمی‌توانید تغییر دهید')
  }
  const hash = d.password ? await bcrypt.hash(d.password, 10) : null
  const row = await tx(async (c) => {
    const { rows } = await c.query(
      `update users set username=$1, name=$2, role=$3, password_hash = coalesce($4, password_hash)
        where id=$5 returning ${COLS}`,
      [d.username, d.name, d.role, hash, req.params.id])
    if (!rows[0]) throw new HttpError(404, 'کاربر یافت نشد')
    await logActivity(c, req.user.username, 'ویرایش کاربر', `کاربر "${d.username}" ویرایش شد`)
    return rows[0]
  })
  res.json(row)
})

router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'نمی‌توانید حساب خودتان را حذف کنید')
  await tx(async (c) => {
    const { rows } = await c.query('delete from users where id = $1 returning username', [req.params.id])
    if (!rows[0]) throw new HttpError(404, 'کاربر یافت نشد')
    await logActivity(c, req.user.username, 'حذف کاربر', `کاربر "${rows[0].username}" حذف شد`)
  })
  res.status(204).end()
})

export default router
