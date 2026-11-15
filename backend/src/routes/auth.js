import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { query, tx } from '../db.js'
import { authenticate, signToken } from '../auth.js'
import { HttpError, logActivity } from '../util.js'

const router = Router()
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10) // برای یکسان‌ماندن زمان پاسخ وقتی کاربر وجود ندارد

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'تلاش‌های ناموفق زیاد بود؛ ۱۵ دقیقه بعد دوباره امتحان کنید' },
})

const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, roleLabel: u.role_label })

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || password.length > 200) {
    throw new HttpError(400, 'نام کاربری و رمز عبور را وارد کنید')
  }
  const { rows } = await query(
    `select u.*, r.label as role_label, r.permissions from users u
       join roles r on r.name = u.role where lower(u.username) = lower($1)`,
    [username.trim()],
  )
  const u = rows[0]
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH)
  if (!u || !ok) throw new HttpError(401, 'نام کاربری یا رمز عبور اشتباه است.')
  await tx((c) => logActivity(c, u.username, 'ورود به سیستم', 'کاربر با موفقیت وارد سیستم شد'))
  res.json({ token: signToken(u.id), user: publicUser(u), permissions: u.permissions })
})

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user), permissions: req.user.permissions })
})

router.post('/logout', authenticate, async (req, res) => {
  await tx((c) => logActivity(c, req.user.username, 'خروج از سیستم', 'کاربر از سیستم خارج شد'))
  res.status(204).end()
})

router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {}
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') throw new HttpError(400, 'اطلاعات ناقص است')
  if (newPassword.length < 6 || newPassword.length > 200) throw new HttpError(400, 'رمز عبور باید حداقل ۶ کاراکتر باشد')
  const { rows } = await query('select password_hash from users where id = $1', [req.user.id])
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) throw new HttpError(400, 'رمز فعلی اشتباه است')
  await query('update users set password_hash = $1 where id = $2', [await bcrypt.hash(newPassword, 10), req.user.id])
  res.status(204).end()
})

export default router
