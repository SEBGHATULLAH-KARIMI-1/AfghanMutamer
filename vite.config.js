import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { aiStatus, callClaude } from './backend/src/aiProxy.js'

// فقط در حالت نمایشی (VITE_DEMO=1): دستیار هوش مصنوعی بدون بک‌اند و دیتابیس کار می‌کند.
// کلید ANTHROPIC_API_KEY از .env.local خوانده می‌شود و چون پیشوند VITE_ ندارد، هرگز به مرورگر نمی‌رسد.
function demoAiProxy(env) {
  return {
    name: 'demo-ai-proxy',
    configureServer(server) {
      if (env.VITE_DEMO !== '1') return
      server.middlewares.use('/__demo_ai', (req, res) => {
        const send = (status, json) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(json))
        }
        if (req.method === 'GET' && req.url === '/status') return send(200, aiStatus(env))
        if (req.method === 'POST' && req.url === '/chat') {
          let raw = ''
          req.on('data', (c) => { raw += c; if (raw.length > 500_000) req.destroy() })
          req.on('end', async () => {
            let body
            try { body = JSON.parse(raw) } catch { return send(400, { error: 'JSON نامعتبر است' }) }
            const { status, json } = await callClaude(body, env)
            send(status, json)
          })
          return undefined
        }
        return send(404, { error: 'یافت نشد' })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './',
    plugins: [react(), demoAiProxy(env)],
    server: {
      port: 5173,
      open: true,
    },
  }
})
