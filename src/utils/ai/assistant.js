// دستیار هوشمند: سؤال فارسی را می‌فهمد و فقط از داده‌های واقعی سیستم جواب می‌دهد (عددی ساخته نمی‌شود).
// خروجی هر پاسخ: { text, tables?: [{ title, columns, rows }] } و حافظه‌ی کوتاه برای سؤال‌های دنباله‌دار مثل «ماه قبلش چی؟»

import { formatJalali, toPersianDigits } from '../dateUtils'
import {
  MONTH_NAMES, addDays, daysBetween, jalaliParts, jalaliToISO, monthKeyOf, monthLabel, monthRange,
  shiftMonths, weekStart,
} from './dates'
import {
  CONFIDENCE_LABEL, CURRENCIES, METHOD_LABEL, analyzeCustomers, buildForecast, buildInsights,
  categoryBreakdown, changeText, curLabel, findAnomalies, money, pct, pilgrimName, sumByCurrency, topPayers,
} from './analytics'

// ───────── نرمال‌سازی متن ─────────
export function normalizeText(s) {
  return String(s || '')
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ه').replace(/ة/g, 'ه')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[؟?!.,،؛:()«»"'\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const has = (t, ...ks) => ks.some((k) => t.includes(normalizeText(k)))
const fa = toPersianDigits

const WORDS = 'یازده|دوازده|پانزده|چهارده|سیزده|بیست|یک|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده|سی'
const WORD_NUM = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, بیست: 20, سی: 30,
}
const toNum = (s) => (/^\d+$/.test(s) ? Number(s) : WORD_NUM[s])
const UNIT_FA = { ماه: 'ماه', هفته: 'هفته', روز: 'روز', سال: 'سال' }

const RE_ROLL_A = new RegExp(`(?:^|\\s)(\\d+|${WORDS})\\s*(ماه|هفته|روز|سال)\\s*(?:اخیر|گذشته|پیش|قبل|آخر|اخیرا)`)
const RE_ROLL_B = new RegExp(`(?:اخیر|آخرین|آخر)\\s*(\\d+|${WORDS})\\s*(ماه|هفته|روز|سال)`)
const RE_FUTURE = new RegExp(`(?:^|\\s)(\\d+|${WORDS})\\s*(ماه|هفته)\\s*(?:آینده|بعد|آتی|بعدی)`)
const RE_MONTH_NAME = new RegExp(`(?:^|\\s)ماه\\s+(${MONTH_NAMES.map(normalizeText).join('|')})`)

// ───────── بازه‌ی زمانی ─────────
export function parsePeriod(t, today) {
  const j = jalaliParts(today)
  const jy = j[0]
  const jm = j[1]
  const key = jy * 12 + jm - 1
  const R = (from, to, label, prev) => ({ type: 'range', from, to, label, prev })

  const roll = t.match(RE_ROLL_A) || t.match(RE_ROLL_B)
  if (roll) {
    const n = toNum(roll[1])
    const unit = roll[2]
    if (n >= 1 && n <= 60) {
      const label = `${fa(n)} ${UNIT_FA[unit]} اخیر`
      if (unit === 'ماه' || unit === 'سال') {
        const months = unit === 'سال' ? n * 12 : n
        const from = addDays(shiftMonths(today, -months), 1)
        return R(from, today, label, { from: shiftMonths(from, -months), to: addDays(from, -1) })
      }
      const days = unit === 'هفته' ? n * 7 : n
      const from = addDays(today, -(days - 1))
      return R(from, today, label, { from: addDays(from, -days), to: addDays(from, -1) })
    }
  }

  const mn = t.match(RE_MONTH_NAME)
  if (mn) {
    const idx = MONTH_NAMES.map(normalizeText).indexOf(mn[1])
    const year = idx + 1 <= jm ? jy : jy - 1
    const k = year * 12 + idx
    const r = monthRange(k)
    return R(r.from, k === key ? today : r.to, `ماه ${MONTH_NAMES[idx]} ${fa(year)}`, monthRange(k - 1))
  }

  if (has(t, 'دیروز')) { const d = addDays(today, -1); return R(d, d, 'دیروز', { from: addDays(d, -1), to: addDays(d, -1) }) }
  if (has(t, 'امروز')) return R(today, today, 'امروز', { from: addDays(today, -1), to: addDays(today, -1) })

  if (has(t, 'هفته گذشته', 'هفته قبل', 'هفته پیش')) {
    const s = addDays(weekStart(today), -7)
    return R(s, addDays(s, 6), 'هفته‌ی گذشته', { from: addDays(s, -7), to: addDays(s, -1) })
  }
  if (has(t, 'این هفته', 'همین هفته', 'هفته جاری')) {
    const s = weekStart(today)
    return R(s, today, 'این هفته', { from: addDays(s, -7), to: addDays(today, -7) })
  }

  if (has(t, 'ماه گذشته', 'ماه قبل', 'ماه پیش')) {
    return R(monthRange(key - 1).from, monthRange(key - 1).to, `ماه گذشته (${monthLabel(key - 1)})`, monthRange(key - 2))
  }
  if (has(t, 'این ماه', 'همین ماه', 'ماه جاری')) {
    return R(monthRange(key).from, today, `این ماه (${monthLabel(key)})`, { from: monthRange(key - 1).from, to: shiftMonths(today, -1) })
  }

  if (has(t, 'سال گذشته', 'پارسال', 'سال قبل')) {
    return R(jalaliToISO(jy - 1, 1, 1), jalaliToISO(jy - 1, 12, 30), `سال گذشته (${fa(jy - 1)})`, { from: jalaliToISO(jy - 2, 1, 1), to: jalaliToISO(jy - 2, 12, 30) })
  }
  if (has(t, 'امسال', 'این سال', 'سال جاری')) {
    return R(jalaliToISO(jy, 1, 1), today, `امسال (${fa(jy)})`, { from: jalaliToISO(jy - 1, 1, 1), to: shiftMonths(today, -12) })
  }

  return { type: 'all', label: 'کل دوران', from: null, to: null, prev: null }
}

const describePeriod = (p) => (p.type === 'all' ? 'کل دوران' : `${p.label}، از ${formatJalali(p.from)} تا ${formatJalali(p.to)}`)

function parseCurrency(t) {
  if (has(t, 'دالر', 'دلار', 'usd', '$')) return 'usd'
  if (has(t, 'افغانی', 'afn')) return 'afn'
  return null
}

// کتگوری مصارف از روی نام‌های موجود در داده‌ها
const GENERIC = ['سایر', 'مصارف', 'لوازم', 'مصرف']
function parseCategory(t, costs) {
  const names = [...new Set(costs.map((e) => e.category).filter(Boolean))]
  let best = null
  names.forEach((name) => {
    const n = normalizeText(name)
    if (t.includes(n)) { best = best || name; return }
    const tokens = n.split(' ').filter((w) => w.length >= 3 && !GENERIC.includes(w))
    if (tokens.some((w) => t.includes(w))) best = best || name
  })
  return best
}

// ───────── ساخت جواب ─────────
const noAccess = (what) => ({ text: `دسترسی شما به ${what} محدود است، بنابراین نمی‌توانم درباره‌ی آن جواب بدهم.` })
const noData = (what) => ({ text: `هنوز ${what} در سیستم ثبت نشده است.` })

function sumsLines(sums, cur) {
  const lines = []
  CURRENCIES.forEach((k) => {
    if (cur && cur !== k) return
    if (sums[k].count > 0 || cur) lines.push(`• ${money(sums[k].sum, k)} در ${fa(sums[k].count)} مورد`)
  })
  return lines
}

function comparisonLines(list, period, cur, sums) {
  if (!period.prev) return []
  const prev = sumByCurrency(list, { type: 'range', ...period.prev })
  const lines = []
  CURRENCIES.forEach((k) => {
    if (cur && cur !== k) return
    const c = changeText(sums[k].sum, prev[k].sum)
    if (c && (sums[k].count > 0 || prev[k].count > 0)) lines.push(`• ${curLabel(k)}: ${c} (دوره‌ی قبل: ${money(prev[k].sum, k)})`)
  })
  return lines
}

function answerExpenses(q, c) {
  if (!c.canExpense) return noAccess('مصارف')
  if (!c.ds.costs.length) return noData('مصرفی')
  const { period, currency, category } = q
  const list = category ? c.ds.costs.filter((e) => e.category === category) : c.ds.costs
  const sums = sumByCurrency(list, period)
  const lines = sumsLines(sums, currency)
  const title = `مصارف${category ? ` «${category}»` : ''} — ${describePeriod(period)}`
  if (!lines.length) return { text: `${title}\nدر این بازه مصرفی ثبت نشده است.` }

  const out = [title, ...lines]
  const cmp = comparisonLines(list, period, currency, sums)
  if (cmp.length) out.push('', 'مقایسه با دوره‌ی قبل:', ...cmp)

  const tables = []
  if (!category) {
    CURRENCIES.forEach((k) => {
      if ((currency && currency !== k) || !sums[k].count) return
      const rows = categoryBreakdown(list, period, k).slice(0, 6)
      tables.push({
        title: `بیشترین کتگوری‌ها (${curLabel(k)})`,
        columns: ['کتگوری', 'مبلغ', 'سهم'],
        rows: rows.map((r) => [r.name, money(r.sum, k), pct((r.sum / sums[k].sum) * 100)]),
      })
    })
  }
  return { text: out.join('\n'), tables }
}

function answerIncome(q, c) {
  if (!c.canIncome) return noAccess('پرداخت‌ها و درآمد')
  if (!c.ds.incomes.length) return noData('پرداختی')
  const { period, currency } = q
  const sums = sumByCurrency(c.ds.incomes, period)
  const lines = sumsLines(sums, currency)
  const title = `درآمد (پرداخت‌های دریافتی) — ${describePeriod(period)}`
  if (!lines.length) return { text: `${title}\nدر این بازه پرداختی ثبت نشده است.` }
  const out = [title, ...lines]
  const cmp = comparisonLines(c.ds.incomes, period, currency, sums)
  if (cmp.length) out.push('', 'مقایسه با دوره‌ی قبل:', ...cmp)
  return { text: out.join('\n') }
}

function answerProfit(q, c) {
  if (!c.canIncome || !c.canExpense) return noAccess('درآمد و مصارف (هر دو)')
  const { period, currency } = q
  const inc = sumByCurrency(c.ds.incomes, period)
  const exp = sumByCurrency(c.ds.costs, period)
  const out = [`درآمد منهای مصارف — ${describePeriod(period)}`]
  let any = false
  CURRENCIES.forEach((k) => {
    if (currency && currency !== k) return
    if (!inc[k].count && !exp[k].count) return
    any = true
    const net = inc[k].sum - exp[k].sum
    out.push(`• ${curLabel(k)}: درآمد ${money(inc[k].sum, k)} − مصارف ${money(exp[k].sum, k)} = ${net >= 0 ? 'سود' : 'کسری'} ${money(Math.abs(net), k)}`)
  })
  if (!any) return { text: `${out[0]}\nدر این بازه درآمد یا مصرفی ثبت نشده است.` }
  out.push('', 'توجه: این فقط تفاوت پول دریافتی و مصارف ثبت‌شده است؛ قیمت بسته‌های وصول‌نشده و هزینه‌های ثبت‌نشده در آن حساب نمی‌شود.')
  return { text: out.join('\n') }
}

function answerForecast(q, c, t, o = {}) {
  const wantExp = o.target ? o.target !== 'income' : has(t, 'مصرف', 'مصارف', 'هزینه', 'خرج')
  const wantInc = o.target ? o.target !== 'expenses' : (has(t, 'درآمد', 'فروش', 'پرداخت', 'عایدات', 'دریافت') || !wantExp)
  const targets = []
  if (wantInc) targets.push({ name: 'درآمد', list: c.ds.incomes, ok: c.canIncome, label: 'پرداخت‌ها' })
  if (wantExp) targets.push({ name: 'مصارف', list: c.ds.costs, ok: c.canExpense, label: 'مصارف' })

  const thisMonth = o.months != null ? o.months === 0 : has(t, 'این ماه', 'همین ماه', 'ماه جاری')
  const fut = o.months != null ? null : t.match(RE_FUTURE)
  const n = o.months > 0 ? Math.min(6, o.months) : fut ? Math.min(6, Math.max(1, toNum(fut[1]))) : 3
  const H = (thisMonth ? 1 : n + 1)

  const out = []
  const tables = []
  targets.forEach((tg) => {
    if (!tg.ok) { out.push(`دسترسی شما به ${tg.label} محدود است.`); return }
    CURRENCIES.forEach((k) => {
      if (q.currency && q.currency !== k) return
      const { series, forecast } = buildForecast(tg.list, k, c.todayKey, H)
      if (!series.length) return
      if (!forecast) {
        out.push(`برای پیش‌بینی ${tg.name} (${curLabel(k)}) حداقل سه ماه کامل داده لازم است؛ فعلاً داده کافی نیست.`)
        return
      }
      const pts = thisMonth ? forecast.points.filter((p) => p.key === c.todayKey) : forecast.points.filter((p) => p.key > c.todayKey)
      if (!pts.length) return
      tables.push({
        title: `پیش‌بینی ${tg.name} (${curLabel(k)})`,
        columns: ['ماه', 'برآورد', 'بازه‌ی محتمل'],
        rows: pts.map((p) => [p.label, money(p.value, k), `${money(p.low, k)} تا ${money(p.high, k)}`]),
      })
      const so = series.find((s) => s.partial)
      const extra = thisMonth && so ? ` تا امروز ${money(so.value, k)} ثبت شده است.` : ''
      out.push(`• ${tg.name} (${curLabel(k)}): ${METHOD_LABEL[forecast.method]}، بر پایه‌ی ${fa(forecast.n)} ماه؛ اطمینان ${CONFIDENCE_LABEL[forecast.confidence]}.${extra}`)
    })
  })
  if (!tables.length && !out.length) return noData('داده‌ی کافی برای پیش‌بینی')
  out.push('', 'این‌ها برآورد آماری است، نه تضمین؛ موسم حج و عمره و پرداخت‌های بزرگ می‌تواند نتیجه را تغییر دهد.')
  return { text: out.join('\n'), tables }
}

function answerDebtors(q, c) {
  if (!c.canCustomers) return noAccess('اطلاعات زائران و پرداخت‌ها')
  const cust = c.customers()
  const out = ['وضعیت باقی‌مانده‌ی حساب زائران (فقط زائران دارای قیمت بسته و غیرلغو):']
  const tables = []
  CURRENCIES.forEach((k) => {
    if (q.currency && q.currency !== k) return
    const s = cust.perCur[k]
    if (!s.count) return
    out.push(`• ${curLabel(k)}: ${fa(s.debtors)} زائر بدهکار، مجموع باقی‌مانده ${money(s.remaining, k)}، نرخ وصول ${s.rate != null ? pct(s.rate) : '—'}`)
    const rows = cust.riskList.filter((b) => b.key === k).slice(0, 6)
    if (rows.length) {
      tables.push({
        title: `بیشترین ریسک عدم‌پرداخت (${curLabel(k)})`,
        columns: ['زائر', 'باقی‌مانده', 'ریسک', 'دلیل'],
        rows: rows.map((b) => [b.name, money(b.remaining, k), `${fa(b.risk.score)} از ۱۰۰`, b.risk.reasons.join('، ')]),
      })
    }
  })
  if (out.length === 1) return { text: 'زائری با قیمت بسته و باقی‌مانده‌ی حساب پیدا نشد.' }
  return { text: out.join('\n'), tables }
}

function answerTopCustomers(q, c) {
  if (!c.canIncome) return noAccess('پرداخت‌ها')
  const tables = []
  CURRENCIES.forEach((k) => {
    if (q.currency && q.currency !== k) return
    const rows = topPayers(c.ds.incomes, q.period, k, 5)
    if (rows.length) tables.push({ title: `بیشترین پرداخت‌کنندگان (${curLabel(k)})`, columns: ['زائر', 'مجموع پرداخت', 'تعداد فیش'], rows: rows.map((r) => [r.name, money(r.sum, k), fa(r.count)]) })
  })
  if (!tables.length) return { text: 'در این بازه پرداختی ثبت نشده است.' }
  return { text: `بهترین مشتریان از نظر مبلغ پرداخت‌شده — ${describePeriod(q.period)}`, tables }
}

function answerPilgrims(q, c) {
  const list = c.ds.pilgrims
  if (!list.length) return noData('زائری')
  const { period } = q
  const inP = period.type === 'all' ? list : list.filter((p) => {
    const d = (p.createdAt || '').slice(0, 10)
    return d && d >= period.from && d <= period.to
  })
  const by = (field) => Object.entries(inP.reduce((m, p) => { const v = p[field] || 'نامشخص'; m[v] = (m[v] || 0) + 1; return m }, {}))
    .map(([k, v]) => `${k}: ${fa(v)}`).join('، ')
  const out = [`زائران ثبت‌شده — ${describePeriod(period)}`, `• تعداد: ${fa(inP.length)} نفر`]
  if (inP.length) {
    out.push(`• بر اساس وضعیت: ${by('status')}`, `• بر اساس نوع سفر: ${by('travelType')}`)
  }
  if (period.prev && period.type !== 'all') {
    const prevCount = list.filter((p) => { const d = (p.createdAt || '').slice(0, 10); return d >= period.prev.from && d <= period.prev.to }).length
    out.push(`• دوره‌ی قبل: ${fa(prevCount)} نفر`)
  }
  return { text: out.join('\n') }
}

function answerPassports(q, c) {
  if (!c.canCustomers) return noAccess('اطلاعات زائران')
  const { expired, soon } = c.customers().passports
  if (!expired.length && !soon.length) return { text: 'گذرنامه‌ی هیچ زائر فعالی منقضی نشده و تا ۶ ماه آینده هم منقضی نمی‌شود.' }
  const rows = [
    ...expired.slice(0, 5).map((x) => [x.name, 'منقضی‌شده', `${fa(Math.abs(x.days))} روز پیش`]),
    ...soon.slice(0, 5).map((x) => [x.name, 'در آستانه‌ی انقضا', `${fa(x.days)} روز دیگر`]),
  ]
  return {
    text: `گذرنامه‌ی ${fa(expired.length)} زائر منقضی شده و ${fa(soon.length)} زائر دیگر تا ۶ ماه آینده منقضی می‌شود.`,
    tables: [{ title: 'نزدیک‌ترین موارد', columns: ['زائر', 'وضعیت', 'زمان'], rows }],
  }
}

function answerTopCategory(q, c) {
  if (!c.canExpense) return noAccess('مصارف')
  const tables = []
  CURRENCIES.forEach((k) => {
    if (q.currency && q.currency !== k) return
    const rows = categoryBreakdown(c.ds.costs, q.period, k).slice(0, 5)
    if (rows.length) tables.push({ title: `پرمصرف‌ترین کتگوری‌ها (${curLabel(k)})`, columns: ['کتگوری', 'مبلغ', 'تعداد'], rows: rows.map((r) => [r.name, money(r.sum, k), fa(r.count)]) })
  })
  if (!tables.length) return { text: 'در این بازه مصرفی ثبت نشده است.' }
  return { text: `پرمصرف‌ترین کتگوری‌ها — ${describePeriod(q.period)}`, tables }
}

function answerAnomalies(q, c) {
  if (!c.canExpense) return noAccess('مصارف')
  const an = findAnomalies(c.ds.costs).slice(0, 6)
  if (!an.length) return { text: 'مصرف غیرعادی پیدا نشد. (برای بررسی، هر کتگوری باید حداقل ۶ مورد ثبت‌شده داشته باشد.)' }
  return {
    text: 'این مصارف نسبت به مصرف‌های معمول همان کتگوری خیلی بزرگ‌تر هستند؛ بهتر است بررسی شوند:',
    tables: [{
      title: 'مصارف غیرعادی',
      columns: ['تاریخ', 'کتگوری', 'مبلغ', 'نسبت به معمول'],
      rows: an.map((a) => [formatJalali(a.expense._d), a.expense.category, money(a.expense._a, a.expense._k), `${fa(a.ratio.toFixed(1))} برابر`]),
    }],
  }
}

function answerCompanies(q, c) {
  if (!c.canCustomers) return noAccess('اطلاعات زائران')
  const rows = c.customers().companies.slice(0, 8)
  return {
    text: 'تعداد زائران و باقی‌مانده‌ی حساب به تفکیک شرکت:',
    tables: [{
      title: 'شرکت‌ها',
      columns: ['شرکت', 'زائران', 'باقی‌مانده (افغانی)', 'باقی‌مانده (دالر)'],
      rows: rows.map((r) => [r.name, fa(r.count), money(r.remaining.afn, 'afn'), money(r.remaining.usd, 'usd')]),
    }],
  }
}

function answerSummary(q, c) {
  const ins = buildInsights(c.ds, { todayKey: c.todayKey, today: c.today, canIncome: c.canIncome, canExpense: c.canExpense, canCustomers: c.canCustomers })
  if (!ins.length) return { text: 'هنوز داده‌ی کافی برای تحلیل ندارم. با ثبت پرداخت‌ها و مصارف بیشتر، خلاصه‌ی هوشمند ساخته می‌شود.' }
  const icon = { danger: '🔴', warn: '🟠', good: '🟢', info: '🔵' }
  return { text: ['مهم‌ترین نکته‌های وضعیت فعلی:', ...ins.slice(0, 6).map((i) => `${icon[i.type]} ${i.title}: ${i.text}`)].join('\n') }
}

export const HELP_TEXT = [
  'من دستیار هوشمند سیستم هستم و از روی داده‌های واقعی شما جواب می‌دهم. می‌توانید بپرسید:',
  '• مصارف سه ماه اخیر چقدر است؟ / مصارف ترانسپورت ماه گذشته',
  '• درآمد این ماه به دالر / مقایسه‌ی درآمد امسال',
  '• پیش‌بینی درآمد سه ماه آینده',
  '• بدهکاران بزرگ کیست؟ / نرخ وصول',
  '• بهترین مشتریان / بیشترین پرداخت',
  '• پرمصرف‌ترین کتگوری / مصرف غیرعادی',
  '• گذرنامه‌های منقضی / تعداد زائران ماه گذشته',
  '• خلاصه‌ی وضعیت',
].join('\n')

export const SUGGESTIONS = [
  'مصارف سه ماه اخیر چقدر است؟',
  'درآمد ماه گذشته',
  'پیش‌بینی درآمد سه ماه آینده',
  'بدهکاران بزرگ کیست؟',
  'پرمصرف‌ترین کتگوری',
  'خلاصه‌ی وضعیت',
]

// ───────── تشخیص نیت و پاسخ ─────────
export function answerQuestion(question, ctx, memory = {}) {
  const t = normalizeText(question)
  if (!t) return { text: HELP_TEXT, memory }

  const period = parsePeriod(t, ctx.today)
  const hasPeriod = period.type !== 'all'
  const currency = parseCurrency(t) || null
  const category = ctx.canExpense ? parseCategory(t, ctx.ds.costs) : null
  const q = { period, currency, category }

  const wantsExp = has(t, 'مصرف', 'مصارف', 'هزینه', 'خرج', 'خرچ', 'مصرفی')
  const wantsInc = has(t, 'درآمد', 'فروش', 'دریافتی', 'عایدات', 'عاید', 'پرداخت')

  let intent = null
  if (/^(سلام|درود|hi|hello|کمک|راهنما)/.test(t) || has(t, 'چه کاری', 'چی میتونی', 'چه کارهایی', 'کمکم کن')) intent = 'help'
  else if (has(t, 'پیش بینی', 'پیشبینی', 'ماه آینده', 'ماه بعد', 'خواهد بود', 'خواهد شد', 'تخمین', 'آینده')) intent = 'forecast'
  else if (has(t, 'غیرعادی', 'مشکوک', 'ناهنجار', 'عجیب', 'تکراری')) intent = 'anomaly'
  else if (has(t, 'گذرنامه', 'پاسپورت', 'پاسپورت')) intent = 'passport'
  else if (has(t, 'بدهکار', 'بدهی', 'باقی مانده', 'باقیمانده', 'نپرداخته', 'پرداخت نکرده', 'نپرداخت', 'نرخ وصول', 'وصول', 'ریسک')) intent = 'debtors'
  else if (has(t, 'بهترین مشتری', 'مشتریان برتر', 'بیشترین پرداخت', 'زائر برتر', 'بهترین زائر', 'مشتری')) intent = 'top'
  else if (has(t, 'شرکت')) intent = 'companies'
  else if (has(t, 'سود', 'زیان', 'منفعت', 'خالص', 'کسری')) intent = 'profit'
  else if (wantsExp && has(t, 'بیشترین', 'پرمصرف', 'کدام کتگوری', 'کتگوری ها', 'بزرگترین', 'بیشتر')) intent = 'topcat'
  else if (has(t, 'پرمصرف', 'کتگوری')) intent = 'topcat'
  else if (wantsExp) intent = 'expenses'
  else if (wantsInc) intent = 'income'
  else if (has(t, 'زائر', 'ثبت نام', 'ثبتنام', 'حاجی', 'مسافر')) intent = 'pilgrims'
  else if (has(t, 'خلاصه', 'وضعیت', 'گزارش کلی', 'تحلیل', 'نکته')) intent = 'summary'

  // سؤال دنباله‌دار: «ماه قبلش چی؟» → همان نیت قبلی با بازه‌ی جدید
  if (!intent && (hasPeriod || currency || category) && memory.intent) intent = memory.intent

  let res
  switch (intent) {
    case 'help': res = { text: HELP_TEXT }; break
    case 'forecast': res = answerForecast(q, ctx, t); break
    case 'anomaly': res = answerAnomalies(q, ctx); break
    case 'passport': res = answerPassports(q, ctx); break
    case 'debtors': res = answerDebtors(q, ctx); break
    case 'top': res = answerTopCustomers(q, ctx); break
    case 'companies': res = answerCompanies(q, ctx); break
    case 'profit': res = answerProfit(q, ctx); break
    case 'topcat': res = answerTopCategory(q, ctx); break
    case 'expenses': res = answerExpenses(q, ctx); break
    case 'income': res = answerIncome(q, ctx); break
    case 'pilgrims': res = answerPilgrims(q, ctx); break
    case 'summary': res = answerSummary(q, ctx); break
    default:
      return {
        text: `متوجه سؤال شما نشدم. لطفاً کمی دقیق‌تر بپرسید، مثلاً: «مصارف سه ماه اخیر»، «درآمد ماه گذشته به دالر» یا «پیش‌بینی درآمد ماه آینده».\n\nبرای دیدن همه‌ی امکانات بنویسید: «راهنما».`,
        memory,
      }
  }
  return { ...res, memory: { intent: intent === 'help' ? memory.intent : intent } }
}

// کمک برای صفحه: کلید ماه امروز و ساخت contexts
export const todayMonthKey = (today) => monthKeyOf(today)
export { pilgrimName, daysBetween, analyzeCustomers }
export {
  answerExpenses, answerIncome, answerProfit, answerForecast, answerDebtors, answerTopCustomers,
  answerPilgrims, answerPassports, answerTopCategory, answerAnomalies, answerCompanies, answerSummary,
}
