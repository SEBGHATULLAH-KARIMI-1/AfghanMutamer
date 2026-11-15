export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const CURRENCIES = ['افغانی', 'دالر']
export const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
export const snake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())

export function camelize(row) {
  const o = {}
  for (const k of Object.keys(row)) o[camel(k)] = row[k]
  return o
}

// تبدیل مقدار ورودی به نوع ستون؛ رشته‌ی خالی برای تاریخ/عدد/ارجاع = null
export function coerce(type, v, field) {
  if (type === 'text') return v == null ? '' : String(v).trim()
  if (type === 'currency') {
    const s = v == null ? '' : String(v).trim()
    if (!s) return CURRENCIES[0]
    if (!CURRENCIES.includes(s)) throw new HttpError(400, `ارز نامعتبر است (${field})`)
    return s
  }
  if (v === '' || v == null) return null
  if (type === 'ref') return String(v)
  if (type === 'date') {
    const s = String(v)
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) throw new HttpError(400, `تاریخ نامعتبر است (${field})`)
    return s.slice(0, 10)
  }
  const n = Number(v)
  if (!Number.isFinite(n)) throw new HttpError(400, `مقدار عددی نامعتبر است (${field})`)
  return type === 'int' ? Math.trunc(n) : n
}

export async function logActivity(client, username, action, details) {
  await client.query(
    'insert into activity_logs (username, action, details) values ($1, $2, $3)',
    [username, action, details],
  )
}
