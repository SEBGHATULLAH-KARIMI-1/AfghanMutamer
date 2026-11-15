import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requirePerm } from '../auth.js'
import { aiStatus, callClaude } from '../aiProxy.js'

const router = Router()

// فقط کسانی که به گزارش‌ها دسترسی دارند (همان شرطِ صفحه‌ی تحلیل هوشمند)
const guard = requirePerm('reports', 'view')
// محدودیت سخت‌گیرانه‌تر برای جلوگیری از مصرف بی‌رویه‌ی اعتبار API
const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false })

router.get('/status', guard, (_req, res) => res.json(aiStatus()))

router.post('/chat', guard, limiter, async (req, res) => {
  const { status, json } = await callClaude(req.body)
  res.status(status).json(json)
})

export default router
