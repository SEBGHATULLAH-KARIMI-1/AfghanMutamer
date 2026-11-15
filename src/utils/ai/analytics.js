// موتور تحلیل هوشمند: پیش‌بینی، تحلیل مشتریان، تحلیل مصارف و تولید هشدار
// همه‌ی محاسبات محلی و قطعی است (بدون ارسال داده به بیرون). دالر و افغانی هیچ‌وقت با هم جمع نمی‌شوند.

import { pilgrimBalances, currencyKey, isReceived } from '../finance'
import { formatCurrency, formatNumber, toPersianDigits } from '../dateUtils'
import {
  normalizeISO, monthKeyOf, monthLabel, daysBetween, inRange,
} from './dates'

export const EPS = 0.005
export const CURRENCIES = ['afn', 'usd']
export const curLabel = (k) => (k === 'usd' ? 'دالر' : 'افغانی')
export const money = (n, k) => formatCurrency(Math.round((Number(n) || 0) * 100) / 100, curLabel(k))
export const pct = (n) => `${toPersianDigits(Math.round(n))}٪`

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const median = (a) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export const pilgrimName = (p) => `${p.fullName || ''} ${p.lastName || ''}`.trim() || '—'

// ───────── آماده‌سازی داده‌ها (نرمال‌سازی تاریخ و ارز، فقط یک‌بار) ─────────
export function buildDataset({ payments = [], expenses = [], pilgrims = [], companies = [] }) {
  const incomes = payments
    .map((p) => ({ ...p, _d: normalizeISO(p.date), _k: currencyKey(p.currency), _a: Number(p.amount) || 0 }))
    .filter((p) => p._d && p._a > 0 && isReceived(p)) // «در انتظار» درآمد نیست
  // فقط «مصرف»؛ همان قاعده‌ی صفحه‌ی مصارف
  const costs = expenses
    .filter((e) => e.type === 'مصرف')
    .map((e) => ({ ...e, _d: normalizeISO(e.date), _k: currencyKey(e.currency), _a: Number(e.amount) || 0 }))
    .filter((e) => e._d && e._a > 0)
  return { incomes, costs, payments, expenses, pilgrims, companies }
}

// ───────── جمع‌ها ─────────
export function sumByCurrency(list, range) {
  const out = { usd: { sum: 0, count: 0 }, afn: { sum: 0, count: 0 } }
  list.forEach((x) => {
    if (!inRange(x._d, range)) return
    out[x._k].sum += x._a
    out[x._k].count += 1
  })
  return out
}

export function categoryBreakdown(costs, range, key) {
  const map = new Map()
  costs.forEach((e) => {
    if (e._k !== key || !inRange(e._d, range)) return
    const name = e.category || 'سایر مصارف'
    const c = map.get(name) || { name, sum: 0, count: 0 }
    c.sum += e._a
    c.count += 1
    map.set(name, c)
  })
  return [...map.values()].sort((a, b) => b.sum - a.sum)
}

export function topPayers(incomes, range, key, n = 5) {
  const map = new Map()
  incomes.forEach((p) => {
    if (p._k !== key || !inRange(p._d, range)) return
    const id = p.pilgrimId || p.pilgrimName
    const c = map.get(id) || { name: p.pilgrimName || '—', sum: 0, count: 0 }
    c.sum += p._a
    c.count += 1
    map.set(id, c)
  })
  return [...map.values()].sort((a, b) => b.sum - a.sum).slice(0, n)
}

export function changeText(cur, prev) {
  if (!(prev > 0)) return cur > 0 ? 'دوره‌ی قبل موردی ثبت نشده بود' : ''
  const p = ((cur - prev) / prev) * 100
  if (Math.abs(p) < 1) return 'تقریباً بدون تغییر نسبت به دوره‌ی قبل'
  return `${pct(Math.abs(p))} ${p > 0 ? 'افزایش' : 'کاهش'} نسبت به دوره‌ی قبل`
}

// ───────── سری ماهانه ─────────
export function monthlyMap(list) {
  const map = new Map()
  list.forEach((x) => {
    const k = monthKeyOf(x._d)
    if (k == null) return
    const e = map.get(k) || { usd: 0, afn: 0 }
    e[x._k] += x._a
    map.set(k, e)
  })
  return map
}

// از اولین ماهِ دارای داده تا ماه جاری (حداکثر maxMonths ماه)، ماه‌های خالی صفر
export function monthSeries(list, key, todayKey, maxMonths = 12) {
  const map = monthlyMap(list)
  const keys = [...map.keys()].filter((k) => k <= todayKey && map.get(k)[key] > 0)
  if (!keys.length) return []
  const first = Math.max(Math.min(...keys), todayKey - (maxMonths - 1))
  const out = []
  for (let k = first; k <= todayKey; k += 1) {
    out.push({ key: k, label: monthLabel(k), value: map.get(k)?.[key] || 0, partial: k === todayKey })
  }
  return out
}

export const completeValues = (series) => series.filter((s) => !s.partial).map((s) => s.value)

// ───────── پیش‌بینی ─────────
/**
 * روش: رگرسیون خطی روی حداکثر ۱۲ ماه کامل؛ اگر روند معنی‌دار نباشد (R² پایین)، میانگین ۳ ماه اخیر.
 * بازه‌ی اطمینان ≈ ۸۰٪ از پراکندگی خطاها. فصل‌بندی (مثلاً موسم حج) با داده‌ی کمتر از دو سال قابل تخمین نیست.
 * h=1 یعنی ماهِ بعد از آخرین ماه کامل (معمولاً همین ماه جاری).
 */
export function forecastSeries(values, H = 3) {
  const win = values.slice(-12)
  const m = win.length
  if (m < 3) return null
  const my = mean(win)
  const mx = (m - 1) / 2
  let sxx = 0; let sxy = 0; let syy = 0
  win.forEach((v, i) => { sxx += (i - mx) ** 2; sxy += (i - mx) * (v - my); syy += (v - my) ** 2 })
  const slope = sxx ? sxy / sxx : 0
  const intercept = my - slope * mx
  const r2 = syy && sxx ? (sxy * sxy) / (sxx * syy) : 0
  const useTrend = m >= 4 && r2 >= 0.25

  const resid = useTrend
    ? win.map((v, i) => v - (intercept + slope * i))
    : win.map((v) => v - my)
  const sd = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / Math.max(1, m - (useTrend ? 2 : 1)))
  const level = mean(win.slice(-3))
  const cap = Math.max(...win) * 1.5

  const points = []
  for (let h = 1; h <= H; h += 1) {
    let v = useTrend ? intercept + slope * (m - 1 + h) : level
    v = Math.min(Math.max(v, 0), cap)
    const band = 1.28 * sd * Math.sqrt(1 + h / m)
    points.push({ h, value: v, low: Math.max(0, v - band), high: v + band })
  }

  const cv = my > 0 ? sd / my : 1
  let confidence = 'low'
  if (m >= 9 && cv < 0.35) confidence = 'high'
  else if (m >= 5 && cv < 0.7) confidence = 'medium'

  const trendPct = m >= 6 && mean(win.slice(-6, -3)) > 0
    ? ((mean(win.slice(-3)) - mean(win.slice(-6, -3))) / mean(win.slice(-6, -3))) * 100
    : null

  return { points, method: useTrend ? 'trend' : 'average', slope, r2, confidence, trendPct, n: m }
}

export const CONFIDENCE_LABEL = { high: 'بالا', medium: 'متوسط', low: 'پایین' }
export const METHOD_LABEL = {
  trend: 'روند خطی بر پایه‌ی ماه‌های گذشته',
  average: 'میانگین سه ماه اخیر (روند مشخصی دیده نشد)',
}

// پیش‌بینی کامل یک سری برای یک ارز: تاریخچه + نقطه‌های پیش‌بینی با برچسب ماه
export function buildForecast(list, key, todayKey, H = 4) {
  const series = monthSeries(list, key, todayKey, 12)
  const fc = forecastSeries(completeValues(series), H)
  if (!fc) return { series, forecast: null }
  const lastComplete = todayKey - 1
  return {
    series,
    forecast: { ...fc, points: fc.points.map((p) => ({ ...p, key: lastComplete + p.h, label: monthLabel(lastComplete + p.h) })) },
  }
}

// ───────── تحلیل مصارف ─────────
export function findAnomalies(costs) {
  const groups = new Map()
  costs.forEach((e) => {
    const g = `${e._k}|${e.category || ''}`
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(e)
  })
  const out = []
  groups.forEach((items) => {
    if (items.length < 6) return
    const amounts = items.map((e) => e._a)
    const med = median(amounts)
    if (!(med > 0)) return
    const mad = median(amounts.map((a) => Math.abs(a - med)))
    items.forEach((e) => {
      const odd = mad > 0
        ? (0.6745 * (e._a - med)) / mad > 3.5 && e._a > 1.5 * med
        : e._a > 3 * med
      if (odd) out.push({ expense: e, median: med, ratio: e._a / med })
    })
  })
  return out.sort((a, b) => b.ratio - a.ratio)
}

// مصرف‌های تکراری مشکوک: همان روز، مبلغ، کتگوری و شخص
export function findDuplicates(costs) {
  const map = new Map()
  costs.forEach((e) => {
    const k = [e._d, e._k, e._a, e.category, e.person || '', e.description || ''].join('|')
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(e)
  })
  return [...map.values()].filter((g) => g.length > 1)
}

// کتگوری‌هایی که ماه کامل اخیر آن‌ها بیش از ۱.۵ برابر میانگین سه ماه قبل‌تر بوده است
export function categorySpikes(costs, key, todayKey) {
  const last = todayKey - 1
  const byCat = new Map()
  costs.forEach((e) => {
    if (e._k !== key) return
    const k = monthKeyOf(e._d)
    if (k == null || k > last || k < last - 3) return
    const c = byCat.get(e.category || 'سایر مصارف') || { last: 0, prev: 0 }
    if (k === last) c.last += e._a
    else c.prev += e._a
    byCat.set(e.category || 'سایر مصارف', c)
  })
  const out = []
  byCat.forEach((c, name) => {
    const avg = c.prev / 3
    if (avg > 0 && c.last > avg * 1.5 && c.last - avg > 0) out.push({ name, last: c.last, avg, ratio: c.last / avg })
  })
  return out.sort((a, b) => b.ratio - a.ratio)
}

// ───────── تحلیل مشتریان (زائران) ─────────
const SEGMENTS = {
  settled: 'تسویه‌شده',
  active: 'در حال پرداخت منظم',
  stalled: 'پرداخت متوقف‌شده',
  nopay: 'بدون هیچ پرداخت',
}
export const SEGMENT_LABEL = SEGMENTS
export const SEGMENT_COLOR = { settled: '#1d8a4e', active: '#2b6cc0', stalled: '#b8860b', nopay: '#c0392b' }

export function analyzeCustomers({ pilgrims, incomes, payments, companies, today }) {
  const lastPay = new Map()
  incomes.forEach((p) => {
    if (!p.pilgrimId) return
    if (!lastPay.get(p.pilgrimId) || p._d > lastPay.get(p.pilgrimId)) lastPay.set(p.pilgrimId, p._d)
  })

  const balances = pilgrimBalances(pilgrims, payments).map((b) => {
    const p = b.pilgrim
    const last = lastPay.get(p.id) || null
    const ref = last || normalizeISO(p.createdAt)
    const idle = ref ? Math.max(0, daysBetween(ref, today)) : null
    const remaining = Math.max(0, b.remaining)
    const settled = remaining <= EPS
    let segment = 'active'
    if (settled) segment = 'settled'
    else if (b.paid <= EPS) segment = 'nopay'
    else if (idle != null && idle > 45) segment = 'stalled'

    let risk = null
    if (!settled) {
      const ratio = Math.min(1, remaining / b.price)
      let score = ratio * 45 + Math.min((idle ?? 60) / 90, 1) * 35
      if (b.paymentCount === 0) score += 15
      if (p.status === 'در انتظار') score += 5
      score = Math.min(100, Math.round(score))
      const reasons = [`${pct(ratio * 100)} از قیمت بسته باقی مانده`]
      if (b.paymentCount === 0) reasons.push('تا حال پرداختی ثبت نکرده')
      else if (idle != null && idle > 45) reasons.push(`${toPersianDigits(idle)} روز از آخرین پرداخت گذشته`)
      risk = { score, level: score >= 60 ? 'high' : score >= 35 ? 'mid' : 'low', reasons }
    }
    return { ...b, name: pilgrimName(p), last, idle, remaining, settled, segment, risk }
  })

  const perCur = {}
  CURRENCIES.forEach((k) => {
    const list = balances.filter((b) => b.key === k)
    const price = list.reduce((s, b) => s + b.price, 0)
    const paid = list.reduce((s, b) => s + Math.min(b.paid, b.price), 0)
    perCur[k] = {
      count: list.length,
      price,
      paid,
      remaining: list.reduce((s, b) => s + b.remaining, 0),
      rate: price > 0 ? (paid / price) * 100 : null,
      debtors: list.filter((b) => !b.settled).length,
    }
  })

  const segments = { settled: 0, active: 0, stalled: 0, nopay: 0 }
  balances.forEach((b) => { segments[b.segment] += 1 })

  const riskList = balances.filter((b) => b.risk).sort((a, b) => b.risk.score - a.risk.score)

  const countBy = (field) => pilgrims.reduce((m, p) => { const v = p[field] || 'نامشخص'; m[v] = (m[v] || 0) + 1; return m }, {})
  const cancelled = pilgrims.filter((p) => p.status === 'لغو شده').length

  // شرکت‌ها
  const nameOf = new Map(companies.map((c) => [c.id, c.name]))
  const balById = new Map(balances.map((b) => [b.pilgrim.id, b]))
  const compMap = new Map()
  pilgrims.forEach((p) => {
    const id = p.companyId || ''
    const c = compMap.get(id) || { name: id ? nameOf.get(id) || 'نامشخص' : 'بدون شرکت', count: 0, remaining: { usd: 0, afn: 0 } }
    c.count += 1
    const b = balById.get(p.id)
    if (b) c.remaining[b.key] += b.remaining
    compMap.set(id, c)
  })

  // گذرنامه
  const expired = []
  const soon = []
  pilgrims.forEach((p) => {
    if (p.status === 'لغو شده') return
    const d = normalizeISO(p.passportExpiryDate)
    if (!d) return
    const days = daysBetween(today, d)
    if (days < 0) expired.push({ pilgrim: p, name: pilgrimName(p), days })
    else if (days <= 180) soon.push({ pilgrim: p, name: pilgrimName(p), days })
  })
  expired.sort((a, b) => a.days - b.days)
  soon.sort((a, b) => a.days - b.days)

  return {
    balances,
    perCur,
    segments,
    riskList,
    total: pilgrims.length,
    cancelled,
    cancelRate: pilgrims.length ? (cancelled / pilgrims.length) * 100 : 0,
    byStatus: countBy('status'),
    byTravel: countBy('travelType'),
    noPackage: pilgrims.filter((p) => p.status !== 'لغو شده' && !(Number(p.packagePrice) > 0)).length,
    companies: [...compMap.values()].sort((a, b) => b.count - a.count),
    passports: { expired, soon },
  }
}

// ───────── هشدارها و بینش‌های خودکار ─────────
const ORDER = { danger: 0, warn: 1, good: 2, info: 3 }

export function buildInsights(ds, { todayKey, today, canIncome, canExpense, canCustomers }) {
  const list = []
  const add = (type, title, text) => list.push({ type, title, text })

  CURRENCIES.forEach((k) => {
    const cl = curLabel(k)

    if (canIncome) {
      const { series, forecast } = buildForecast(ds.incomes, k, todayKey, 2)
      const done = series.filter((s) => !s.partial)
      if (done.length >= 2) {
        const last = done[done.length - 1]
        const prev = done[done.length - 2]
        if (prev.value > 0) {
          const ch = ((last.value - prev.value) / prev.value) * 100
          if (ch <= -20) add('warn', `افت درآمد (${cl})`, `درآمد ${last.label} ${pct(Math.abs(ch))} کمتر از ماه قبل بود (${money(last.value, k)} در برابر ${money(prev.value, k)}).`)
          else if (ch >= 20) add('good', `رشد درآمد (${cl})`, `درآمد ${last.label} ${pct(ch)} بیشتر از ماه قبل بود (${money(last.value, k)}).`)
        }
      }
      if (forecast) {
        const nxt = forecast.points[1] || forecast.points[0]
        add('info', `پیش‌بینی درآمد (${cl})`, `درآمد ${nxt.label} حدود ${money(nxt.value, k)} برآورد می‌شود (بازه‌ی محتمل ${money(nxt.low, k)} تا ${money(nxt.high, k)}؛ اطمینان ${CONFIDENCE_LABEL[forecast.confidence]}).`)
      }
    }

    if (canExpense) {
      const spikes = categorySpikes(ds.costs, k, todayKey).slice(0, 2)
      spikes.forEach((s) => add('warn', `جهش مصرف: ${s.name} (${cl})`, `مصرف این کتگوری در ماه گذشته ${money(s.last, k)} بود؛ ${toPersianDigits(s.ratio.toFixed(1))} برابر میانگین سه ماه قبل‌تر (${money(s.avg, k)}).`))

      if (canIncome) {
        const inc = monthSeries(ds.incomes, k, todayKey, 12)
        const exp = monthSeries(ds.costs, k, todayKey, 12)
        const lastKey = todayKey - 1
        const i = inc.find((s) => s.key === lastKey)?.value || 0
        const e = exp.find((s) => s.key === lastKey)?.value || 0
        if (e > 0 && e > i) add('danger', `مصارف بیشتر از درآمد (${cl})`, `در ${monthLabel(lastKey)} مصارف (${money(e, k)}) از درآمد (${money(i, k)}) بیشتر بود؛ کسری ${money(e - i, k)}.`)
      }
    }
  })

  if (canExpense) {
    const an = findAnomalies(ds.costs)
    if (an.length) {
      const a = an[0]
      add('warn', 'مصرف غیرعادی', `${toPersianDigits(an.length)} مصرف نسبت به معمول همان کتگوری خیلی بزرگ است؛ بزرگ‌ترین: «${a.expense.description || a.expense.category}» به مبلغ ${money(a.expense._a, a.expense._k)} (${toPersianDigits(a.ratio.toFixed(1))} برابر حد معمول).`)
    }
    const dup = findDuplicates(ds.costs)
    if (dup.length) add('warn', 'مصرف تکراری مشکوک', `${toPersianDigits(dup.length)} گروه مصرف با تاریخ، مبلغ و توضیح کاملاً یکسان ثبت شده؛ احتمال ثبت دوباره.`)
  }

  if (canCustomers) {
    const c = analyzeCustomers({ pilgrims: ds.pilgrims, incomes: ds.incomes, payments: ds.payments, companies: ds.companies, today })
    if (c.segments.stalled + c.segments.nopay > 0) {
      add('warn', 'حساب‌های نیازمند پیگیری', `${toPersianDigits(c.segments.stalled)} زائر پرداخت‌شان بیش از ۴۵ روز متوقف مانده و ${toPersianDigits(c.segments.nopay)} زائر هنوز هیچ پرداختی نداشته‌اند.`)
    }
    CURRENCIES.forEach((k) => {
      const s = c.perCur[k]
      if (s.count > 0 && s.rate != null) {
        add(s.rate < 50 ? 'warn' : 'info', `نرخ وصول (${curLabel(k)})`, `${pct(s.rate)} از مجموع قیمت بسته‌ها وصول شده؛ باقی‌مانده ${money(s.remaining, k)} از ${toPersianDigits(s.debtors)} زائر.`)
      }
    })
    if (c.total >= 10 && c.cancelRate >= 15) add('warn', 'نرخ لغو بالا', `${pct(c.cancelRate)} از زائران ثبت‌شده لغو شده‌اند (${toPersianDigits(c.cancelled)} نفر).`)
    if (c.passports.expired.length) add('danger', 'گذرنامه‌ی منقضی', `گذرنامه‌ی ${toPersianDigits(c.passports.expired.length)} زائر فعال منقضی شده است.`)
    if (c.passports.soon.length) add('warn', 'گذرنامه‌ی در آستانه‌ی انقضا', `گذرنامه‌ی ${toPersianDigits(c.passports.soon.length)} زائر تا ۶ ماه آینده منقضی می‌شود.`)
  }

  return list.sort((a, b) => ORDER[a.type] - ORDER[b.type])
}

export { formatNumber }
