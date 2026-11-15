// ارتباط با پراکسی هوش مصنوعی.
// حالت عادی: بک‌اند (/api/ai/*) با توکن ورود. حالت نمایشی (VITE_DEMO=1): پراکسی داخل Vite (/__demo_ai/*).
// کلید API هیچ‌وقت به مرورگر نمی‌رسد؛ فقط سرور آن را می‌خواند.

import { api } from '../api'

const DEMO = import.meta.env.VITE_DEMO === '1'

async function demoCall(path, body) {
  let res
  try {
    res = await fetch(`/__demo_ai${path}`, body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : undefined)
  } catch {
    throw new Error('ارتباط با سرور برقرار نشد.')
  }
  let data = null
  try { data = await res.json() } catch { /* ignore */ }
  if (!res.ok) throw new Error(data?.error || `خطای سرور (${res.status})`)
  return data
}

export async function fetchAiStatus() {
  try {
    return DEMO ? await demoCall('/status') : await api('/ai/status')
  } catch {
    return { enabled: false, model: null }
  }
}

export async function sendAiChat(payload) {
  return DEMO ? demoCall('/chat', payload) : api('/ai/chat', { method: 'POST', body: payload })
}
