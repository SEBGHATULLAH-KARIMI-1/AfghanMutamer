import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { pool } from './db.js'
import { assertAuthConfig } from './auth.js'
import { crudRouter } from './crud.js'
import { RESOURCES } from './resources.js'
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import rolesRouter from './routes/roles.js'
import miscRouter from './routes/misc.js'
import aiRouter from './routes/ai.js'
import { HttpError } from './util.js'

assertAuthConfig()
const isProd = process.env.NODE_ENV === 'production'
const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)

const app = express()
app.set('trust proxy', 1) // Render پشت پروکسی است
app.use(helmet())
app.use(cors({
  origin(origin, cb) {
    const ok = !origin || origins.includes(origin) || (!isProd && /^http:\/\/localhost:\d+$/.test(origin))
    cb(null, ok)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '6mb' })) // عکس زائر/لوگو به‌صورت base64 ذخیره می‌شود
app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
for (const [name, def] of Object.entries(RESOURCES)) app.use(`/api/${name}`, crudRouter(def))
app.use('/api/users', usersRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/ai', aiRouter)
app.use('/api', miscRouter)
app.use('/api', (_req, res) => res.status(404).json({ error: 'مسیر پیدا نشد' }))

const CONSTRAINTS = {
  pilgrims_passport_uniq: 'این شماره گذرنامه قبلاً ثبت شده است',
  companies_name_uniq: 'شرکتی با این نام قبلاً ثبت شده است',
  users_username_uniq: 'این نام کاربری قبلاً ثبت شده است',
  payments_receipt_uniq: 'این شماره فیش قبلاً ثبت شده است',
  roles_name_key: 'این نام نقش قبلاً ثبت شده است',
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'حجم درخواست زیاد است (عکس را کوچک‌تر کنید)' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON نامعتبر است' })
  if (err.code === '23505') return res.status(409).json({ error: CONSTRAINTS[err.constraint] || 'مقدار تکراری است' })
  if (err.code === '23503') return res.status(409).json({ error: 'این مورد به داده‌ی دیگری وابسته است یا مرجع آن یافت نشد' })
  if (['22P02', '22003', '22007', '22008', '23514', '23502'].includes(err.code)) return res.status(400).json({ error: 'مقدار ورودی نامعتبر است' })
  console.error(err)
  res.status(500).json({ error: 'خطای داخلی سرور' })
})

const port = Number(process.env.PORT) || 4000
const server = app.listen(port, () => console.log(`API listening on :${port}`))
const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)))
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
