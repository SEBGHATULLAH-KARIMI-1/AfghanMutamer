// ابزارهای تاریخ شمسی برای موتور تحلیل هوشمند
// همه‌ی تاریخ‌ها به‌صورت رشته‌ی میلادی YYYY-MM-DD نگه داشته می‌شوند (مثل دیتابیس) تا مقایسه‌ی رشته‌ای درست کار کند.

import { gregorianToJalali, toPersianDigits, todayISO } from '../dateUtils'

export const MONTH_NAMES = ['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت']

const DAY_MS = 86400000
const pad = (n) => String(n).padStart(2, '0')

export const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

// هر مقدار تاریخ (رشته‌ی ISO یا Date) را به [سال، ماه، روز] میلادی تبدیل می‌کند
export function dateParts(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number)
    return [y, m, d]
  }
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
}

export function normalizeISO(value) {
  const p = dateParts(value)
  return p ? toISO(...p) : null
}

export function jalaliParts(iso) {
  const p = dateParts(iso)
  return p ? gregorianToJalali(...p) : null
}

export { todayISO }

/**
 * تاریخ شمسی را به میلادی (ISO) تبدیل می‌کند.
 * برای اطمینان از هماهنگی کامل با gregorianToJalali پروژه، تاریخ تقریبی را حدس می‌زند و با همان تابع تصحیح می‌کند.
 * اگر روز از طول ماه بیشتر باشد (مثلاً ۳۱ میزان) به آخرین روز همان ماه کوتاه می‌شود.
 */
export function jalaliToISO(jy, jm, jd) {
  const offset = jm <= 7 ? (jm - 1) * 31 : 186 + (jm - 7) * 30
  for (let dd = jd; dd >= 1; dd -= 1) {
    const base = Date.UTC(jy + 621, 2, 21) + (offset + dd - 1) * DAY_MS
    for (let adj = -3; adj <= 3; adj += 1) {
      const t = new Date(base + adj * DAY_MS)
      const g = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]
      const j = gregorianToJalali(...g)
      if (j[0] === jy && j[1] === jm && j[2] === dd) return toISO(...g)
    }
  }
  return null
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

// b - a به روز
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS)
}

// ───────── کلید ماه: یک عدد صحیح برای هر ماه شمسی (محاسبه‌ی ساده‌ی ماه‌های قبل و بعد) ─────────
export const monthKeyOf = (iso) => {
  const j = jalaliParts(iso)
  return j ? j[0] * 12 + j[1] - 1 : null
}
export const keyParts = (k) => [Math.floor(k / 12), (k % 12) + 1]
export const monthLabel = (k) => {
  const [y, m] = keyParts(k)
  return `${MONTH_NAMES[m - 1]} ${toPersianDigits(y)}`
}
export function monthRange(k) {
  const [y, m] = keyParts(k)
  return { from: jalaliToISO(y, m, 1), to: jalaliToISO(y, m, 31) }
}
export function shiftMonths(iso, n) {
  const j = jalaliParts(iso)
  const k = j[0] * 12 + j[1] - 1 + n
  const [y, m] = keyParts(k)
  return jalaliToISO(y, m, j[2])
}

// شروع هفته در افغانستان شنبه است
export function weekStart(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // یکشنبه=۰ ... شنبه=۶
  return addDays(iso, -((dow + 1) % 7))
}

export function inRange(iso, range) {
  if (!range || range.type === 'all') return true
  return !!iso && iso >= range.from && iso <= range.to
}
