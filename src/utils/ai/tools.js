// ابزارهایی که مدل هوش مصنوعی می‌تواند صدا بزند.
// مدل خودش هیچ عددی نمی‌سازد؛ هر ابزار روی داده‌های واقعی همین مرورگر اجرا می‌شود و فقط نتیجه‌ی آن به مدل برمی‌گردد.
// نام ابزارها باید با /^[a-z_]{1,40}$/ بخواند (شرط اعتبارسنجی بک‌اند).

import { formatJalali } from '../dateUtils'
import { addDays, daysBetween, normalizeISO } from './dates'
import { money, pilgrimName } from './analytics'
import {
  answerAnomalies, answerCompanies, answerDebtors, answerExpenses, answerForecast, answerIncome,
  answerPassports, answerPilgrims, answerProfit, answerSummary, answerTopCategory, answerTopCustomers,
  normalizeText, parsePeriod,
} from './assistant'

const PERIOD = {
  type: 'string',
  description: 'بازه‌ی زمانی به فارسی، مثلاً «این ماه»، «ماه گذشته»، «سه ماه اخیر»، «امسال»، «سال گذشته»، «این هفته»، «دیروز»، «ماه حمل». اگر ننویسی یعنی کل دوران.',
}
const FROM = { type: 'string', description: 'اختیاری: شروع بازه‌ی دقیق به میلادی YYYY-MM-DD (همراه با to). اگر داده شود از period مهم‌تر است.' }
const TO = { type: 'string', description: 'اختیاری: پایان بازه‌ی دقیق به میلادی YYYY-MM-DD.' }
const CURRENCY = { type: 'string', enum: ['afn', 'usd'], description: 'ارز: afn = افغانی، usd = دالر. اگر ننویسی هر دو ارز جداگانه گزارش می‌شود.' }

export const TOOLS = [
  {
    name: 'get_expenses',
    description: 'جمع مصارف (هزینه‌ها) در یک بازه، به تفکیک ارز، با مقایسه با دوره‌ی قبل. می‌توان به یک دسته (کتگوری) محدودش کرد.',
    input_schema: {
      type: 'object',
      properties: {
        period: PERIOD, from: FROM, to: TO, currency: CURRENCY,
        category: { type: 'string', description: 'نام دقیق کتگوری مصرف. نام‌های موجود را با list_expense_categories بگیر.' },
      },
    },
  },
  {
    name: 'get_income',
    description: 'جمع درآمد (پرداخت‌های دریافتی از زائران) در یک بازه، به تفکیک ارز، با مقایسه با دوره‌ی قبل.',
    input_schema: { type: 'object', properties: { period: PERIOD, from: FROM, to: TO, currency: CURRENCY } },
  },
  {
    name: 'get_profit',
    description: 'درآمد منهای مصارف (سود یا کسری ساده‌ی نقدی) در یک بازه، به تفکیک ارز.',
    input_schema: { type: 'object', properties: { period: PERIOD, from: FROM, to: TO, currency: CURRENCY } },
  },
  {
    name: 'get_forecast',
    description: 'پیش‌بینی آماری درآمد یا مصارف ماه‌های آینده (رگرسیون خطی یا میانگین) با بازه‌ی محتمل و سطح اطمینان. حداقل سه ماه کامل داده لازم است.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['income', 'expenses', 'both'], description: 'چه چیزی پیش‌بینی شود' },
        months: { type: 'integer', minimum: 0, maximum: 6, description: 'تعداد ماه‌های آینده؛ ۰ یعنی فقط همین ماه جاری' },
        currency: CURRENCY,
      },
      required: ['target'],
    },
  },
  {
    name: 'get_debtors',
    description: 'وضعیت باقی‌مانده‌ی حساب زائران: تعداد بدهکاران، مجموع باقی‌مانده، نرخ وصول و زائران با بیشترین ریسک عدم‌پرداخت.',
    input_schema: { type: 'object', properties: { currency: CURRENCY } },
  },
  {
    name: 'get_top_payers',
    description: 'زائرانی که بیشترین مبلغ را پرداخته‌اند (بهترین مشتریان) در یک بازه.',
    input_schema: { type: 'object', properties: { period: PERIOD, from: FROM, to: TO, currency: CURRENCY } },
  },
  {
    name: 'get_top_expense_categories',
    description: 'پرمصرف‌ترین کتگوری‌های مصارف در یک بازه.',
    input_schema: { type: 'object', properties: { period: PERIOD, from: FROM, to: TO, currency: CURRENCY } },
  },
  {
    name: 'list_expense_categories',
    description: 'فهرست کتگوری‌های مصارف که در سیستم ثبت شده‌اند (برای پیدا کردن نام دقیق کتگوری).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_expense_anomalies',
    description: 'مصارف غیرعادی (خیلی بزرگ‌تر از معمول همان کتگوری).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_pilgrims',
    description: 'تعداد زائران ثبت‌شده در یک بازه، به تفکیک وضعیت و نوع سفر، با مقایسه با دوره‌ی قبل.',
    input_schema: { type: 'object', properties: { period: PERIOD, from: FROM, to: TO } },
  },
  {
    name: 'get_passport_status',
    description: 'زائران فعالی که گذرنامه‌شان منقضی شده یا تا ۶ ماه آینده منقضی می‌شود.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_companies',
    description: 'تعداد زائران و باقی‌مانده‌ی حساب به تفکیک شرکت.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_exchange_rate',
    description: 'آخرین نرخ برابری دالر به افغانی که در فیش‌های پرداخت همین سیستم ثبت شده است (نرخ زنده‌ی امروز بازار نیست).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'find_pilgrim',
    description: 'جستجوی زائر با نام (نام، تخلص یا نام پدر) و گرفتن اطلاعات او: شماره تماس، نوع سفر، وضعیت، شرکت، قیمت بسته، پرداخت‌شده و باقی‌مانده و تاریخ انقضای گذرنامه. برای سؤال‌هایی مثل «شماره تماس فلانی» یا «فلانی چقدر باقی دارد» حتماً این ابزار را صدا بزن.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'نام یا بخشی از نام زائر، مثلاً «جاوید نظری»' } },
      required: ['name'],
    },
  },
  {
    name: 'get_overview',
    description: 'خلاصه‌ی وضعیت: مهم‌ترین هشدارها و نکته‌های خودکار سیستم (افت درآمد، جهش مصرف، گذرنامه، نرخ وصول و…).',
    input_schema: { type: 'object', properties: {} },
  },
]

const ISO = /^\d{4}-\d{2}-\d{2}$/

function rangePeriod(from, to) {
  const len = daysBetween(from, to) + 1
  return {
    type: 'range',
    from,
    to,
    label: `از ${formatJalali(from)} تا ${formatJalali(to)}`,
    prev: { from: addDays(from, -len), to: addDays(from, -1) },
  }
}

function buildQuery(inp, ctx, notes) {
  let period
  if (ISO.test(inp.from || '') && ISO.test(inp.to || '') && inp.from <= inp.to) {
    period = rangePeriod(inp.from, inp.to)
  } else {
    period = parsePeriod(normalizeText(inp.period || ''), ctx.today)
  }
  const currency = inp.currency === 'usd' || inp.currency === 'afn' ? inp.currency : null

  let category = null
  if (inp.category && ctx.canExpense) {
    const names = [...new Set(ctx.ds.costs.map((e) => e.category).filter(Boolean))]
    const want = normalizeText(inp.category)
    category = names.find((n) => n === inp.category) || names.find((n) => normalizeText(n) === want) || null
    if (!category) notes.push(`کتگوری «${inp.category}» در سیستم پیدا نشد؛ نتیجه‌ی زیر برای همه‌ی کتگوری‌هاست.`)
  }
  return { period, currency, category }
}

function lastExchangeRate(ctx) {
  const list = ctx.ds.payments.filter((p) => Number(p.exchangeRate) > 0)
  if (!list.length) return { text: 'در پرداخت‌های ثبت‌شده هیچ نرخ برابری دالر ثبت نشده است. نرخ امروز بازار را ندارم.' }
  list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const p = list[0]
  const d = normalizeISO(p.date)
  return { text: `آخرین نرخ ثبت‌شده در سیستم: هر ۱ دالر = ${Number(p.exchangeRate)} افغانی (در فیش تاریخ ${d ? formatJalali(d) : '—'}). این نرخ ثبت‌شده است، نه نرخ زنده‌ی امروز بازار.` }
}

// جستجوی زائر با نام؛ فقط اطلاعات لازم برگردانده می‌شود (بدون شماره گذرنامه، آدرس، تاریخ تولد و عکس)
function findPilgrim(inp, ctx) {
  if (!ctx.canCustomers) return { text: 'دسترسی شما به اطلاعات زائران محدود است.' }
  const tokens = normalizeText(inp.name || '').split(' ').filter(Boolean)
  if (!tokens.length) return { text: 'نام زائر مشخص نشد.' }

  const hits = ctx.ds.pilgrims.filter((p) => {
    const hay = normalizeText(`${p.fullName || ''} ${p.lastName || ''} ${p.fatherName || ''}`)
    return tokens.every((t) => hay.includes(t))
  })
  if (!hits.length) return { text: `زائری با نام «${inp.name}» پیدا نشد.` }

  const balances = new Map(ctx.customers().balances.map((b) => [b.pilgrim.id, b]))
  const companyName = new Map(ctx.ds.companies.map((c) => [c.id, c.name]))
  const shown = hits.slice(0, 8)
  const rows = shown.map((p) => {
    const b = balances.get(p.id)
    const exp = normalizeISO(p.passportExpiryDate)
    return [
      pilgrimName(p),
      p.fatherName || '—',
      p.phone || 'ثبت نشده',
      p.travelType || '—',
      p.status || '—',
      p.companyId ? companyName.get(p.companyId) || '—' : 'بدون شرکت',
      b ? money(b.price, b.key) : 'قیمت بسته ثبت نشده',
      b ? money(Math.min(b.paid, b.price), b.key) : '—',
      b ? money(b.remaining, b.key) : '—',
      exp ? formatJalali(exp) : '—',
    ]
  })
  const note = hits.length > shown.length ? ` (${hits.length} مورد پیدا شد؛ ${shown.length} مورد اول نشان داده شد)` : ''
  return {
    text: `${hits.length} زائر با این نام پیدا شد${note}.`,
    tables: [{
      title: 'اطلاعات زائر',
      columns: ['نام', 'نام پدر', 'شماره تماس', 'نوع سفر', 'وضعیت', 'شرکت', 'قیمت بسته', 'پرداخت‌شده', 'باقی‌مانده', 'انقضای گذرنامه'],
      rows,
    }],
  }
}

// خروجی: { content: رشته‌ی JSON برای مدل, tables: جدول‌های قابل نمایش به کاربر }
export function runTool(name, input, ctx) {
  const inp = input && typeof input === 'object' ? input : {}
  const notes = []
  let res
  try {
    const q = buildQuery(inp, ctx, notes)
    switch (name) {
      case 'get_expenses': res = answerExpenses(q, ctx); break
      case 'get_income': res = answerIncome(q, ctx); break
      case 'get_profit': res = answerProfit(q, ctx); break
      case 'get_forecast': {
        const months = Number.isInteger(inp.months) ? Math.min(6, Math.max(0, inp.months)) : 3
        res = answerForecast(q, ctx, '', { target: ['income', 'expenses', 'both'].includes(inp.target) ? inp.target : 'income', months })
        break
      }
      case 'get_debtors': res = answerDebtors(q, ctx); break
      case 'get_top_payers': res = answerTopCustomers(q, ctx); break
      case 'get_top_expense_categories': res = answerTopCategory(q, ctx); break
      case 'list_expense_categories': {
        if (!ctx.canExpense) { res = { text: 'دسترسی شما به مصارف محدود است.' }; break }
        const map = new Map()
        ctx.ds.costs.forEach((e) => { const n = e.category || 'سایر مصارف'; map.set(n, (map.get(n) || 0) + 1) })
        res = { text: map.size ? `کتگوری‌های ثبت‌شده: ${[...map.entries()].map(([n, c]) => `${n} (${c} مورد)`).join('، ')}` : 'هنوز مصرفی ثبت نشده است.' }
        break
      }
      case 'get_expense_anomalies': res = answerAnomalies(q, ctx); break
      case 'get_pilgrims': res = answerPilgrims(q, ctx); break
      case 'get_passport_status': res = answerPassports(q, ctx); break
      case 'get_companies': res = answerCompanies(q, ctx); break
      case 'get_exchange_rate': res = lastExchangeRate(ctx); break
      case 'find_pilgrim': res = findPilgrim(inp, ctx); break
      case 'get_overview': res = answerSummary(q, ctx); break
      default:
        return { content: JSON.stringify({ error: `ابزار «${name}» وجود ندارد` }), tables: [], isError: true }
    }
  } catch {
    return { content: JSON.stringify({ error: 'محاسبه با خطا روبه‌رو شد' }), tables: [], isError: true }
  }

  const tables = res.tables || []
  const payload = {
    text: [...notes, res.text].filter(Boolean).join('\n'),
    tables: tables.map((t) => ({ title: t.title, columns: t.columns, rows: t.rows.slice(0, 15) })),
  }
  return { content: JSON.stringify(payload), tables, isError: false }
}
