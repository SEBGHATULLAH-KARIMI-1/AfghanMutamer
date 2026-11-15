// کلاینت API بک‌اند (Render). آدرس سرور از متغیر محیطی VITE_API_URL خوانده می‌شود.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')
const TOKEN_KEY = 'hums_token'
const TIMEOUT_MS = 60_000 // سرور رایگان Render بعد از بیکاری تا ~۶۰ ثانیه برای بیدار شدن زمان می‌خواهد
// حالت نمایشی: بدون سرور و با داده‌ی نمونه (فقط وقتی VITE_DEMO=1 باشد)
const DEMO = import.meta.env.VITE_DEMO === '1'

export const token = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set(v) {
    try { localStorage.setItem(TOKEN_KEY, v) } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
  },
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const apiErrorMessage = (e) => (e && e.message) || 'خطای نامشخص'

let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export async function api(path, { method = 'GET', body } = {}) {
  if (DEMO) {
    const { demoApi } = await import('./demoApi')
    return demoApi(path, { method, body })
  }
  const t = token.get()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
  } catch {
    throw new ApiError(0, 'ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.')
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 204) return null
  let data = null
  try { data = await res.json() } catch { /* بدنه‌ی خالی یا غیر JSON */ }

  if (!res.ok) {
    if (res.status === 401 && t && !path.startsWith('/auth/login')) onUnauthorized?.()
    throw new ApiError(res.status, data?.error || `خطای سرور (${res.status})`)
  }
  return data
}
