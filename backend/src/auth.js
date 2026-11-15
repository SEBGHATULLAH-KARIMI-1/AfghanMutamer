import jwt from 'jsonwebtoken'
import { query } from './db.js'
import { HttpError } from './util.js'

const secret = () => process.env.JWT_SECRET

export function assertAuthConfig() {
  const s = secret()
  if (!s || s.length < 32) {
    console.error('JWT_SECRET باید حداقل ۳۲ کاراکتر باشد.')
    process.exit(1)
  }
}

export const signToken = (userId) => jwt.sign({ sub: userId }, secret(), { expiresIn: '12h' })

// کاربر و دسترسی‌ها در هر درخواست از دیتابیس خوانده می‌شود؛ حذف کاربر یا تغییر نقش فوراً اثر می‌کند
export async function authenticate(req, _res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) throw new HttpError(401, 'ابتدا وارد سیستم شوید')
  let payload
  try {
    payload = jwt.verify(token, secret())
  } catch {
    throw new HttpError(401, 'نشست شما منقضی شده است؛ دوباره وارد شوید')
  }
  const { rows } = await query(
    `select u.id, u.username, u.name, u.role, r.label as role_label, r.permissions
       from users u join roles r on r.name = u.role where u.id = $1`,
    [payload.sub],
  )
  if (!rows[0]) throw new HttpError(401, 'کاربر یافت نشد')
  req.user = rows[0]
  next()
}

export const can = (user, page, action = 'view') => user.permissions?.[page]?.[action] === true

export const requirePerm = (page, action = 'view') => [
  authenticate,
  (req, _res, next) => {
    if (!can(req.user, page, action)) throw new HttpError(403, 'شما اجازه‌ی این عملیات را ندارید')
    next()
  },
]

// حداقل یکی از صفحه‌ها (برای خواندن داده‌ای که چند صفحه به آن نیاز دارند)
export const requireAny = (pages, action = 'view') => [
  authenticate,
  (req, _res, next) => {
    if (!pages.some((p) => can(req.user, p, action))) throw new HttpError(403, 'شما اجازه‌ی این عملیات را ندارید')
    next()
  },
]
