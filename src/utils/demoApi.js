// حالت نمایشی (Demo): سرور ساختگی داخل مرورگر با داده‌های نمونه
// فقط وقتی VITE_DEMO=1 باشد فعال می‌شود و با بک‌اند واقعی هیچ ارتباطی ندارد.
// داده‌ها فقط در حافظه‌اند و با رفرش صفحه به حالت اول برمی‌گردند.

import { todayISO } from './dateUtils'
import { addDays, daysBetween, monthKeyOf, monthRange } from './ai/dates'

class DemoError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

function rng(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['احمد', 'محمد', 'علی', 'حسین', 'عبدالله', 'یوسف', 'ابراهیم', 'رحمان', 'سمیع', 'حمید', 'زهرا', 'فاطمه', 'مریم', 'خدیجه', 'نورالله', 'جاوید']
const LAST = ['احمدی', 'نظری', 'رحیمی', 'صدیقی', 'کریمی', 'حیدری', 'رسولی', 'فرهادی', 'امیری', 'سلطانی', 'شاهی', 'نیازی']
const FATHER = ['عبدالرحمن', 'غلام‌نبی', 'محمدکریم', 'عبدالغفور', 'نصرالله', 'فیض‌محمد']

function build() {
  const today = todayISO()
  const R = rng(20261114)
  const pick = (a) => a[Math.floor(R() * a.length)]

  const companies = [
    { id: 'demo-co-1', name: 'شرکت نور هدایت', phone: '0700111222', address: 'کابل، شهرنو', email: 'noor@example.com', contactPerson: 'احمد ظاهر' },
    { id: 'demo-co-2', name: 'شرکت سفر مبارک', phone: '0700333444', address: 'هرات', email: 'safar@example.com', contactPerson: 'رحیم‌الله' },
    { id: 'demo-co-3', name: 'شرکت حرمین', phone: '0700555666', address: 'مزار شریف', email: 'haramain@example.com', contactPerson: 'سید جمال' },
  ]

  const pilgrims = []
  const payments = []
  let receipt = 10000

  for (let i = 0; i < 40; i += 1) {
    const usd = R() < 0.7
    const price = usd ? Math.round((2500 + R() * 4000) / 50) * 50 : Math.round((150000 + R() * 250000) / 5000) * 5000
    const status = i % 11 === 3 ? 'لغو شده' : i % 7 === 2 ? 'در انتظار' : 'تایید شده'
    const createdAt = addDays(today, -Math.floor(R() * 240 + 5))
    let passportExpiryDate
    if (i === 1 || i === 9) passportExpiryDate = addDays(today, -(30 + i))
    else if (i === 4 || i === 12 || i === 20) passportExpiryDate = addDays(today, 40 + i * 5)
    else passportExpiryDate = addDays(today, 400 + Math.floor(R() * 1500))

    const female = i % 3 === 0
    const p = {
      id: `demo-pl-${i + 1}`,
      fullName: pick(FIRST),
      fatherName: pick(FATHER),
      lastName: pick(LAST),
      gender: female ? 'زن' : 'مرد',
      dob: addDays(today, -Math.floor(365 * (30 + R() * 40))),
      phone: `07${Math.floor(10000000 + R() * 89999999)}`,
      address: pick(['کابل', 'هرات', 'مزار شریف', 'قندهار', 'جلال‌آباد']),
      passportNumber: `P${1000000 + i * 137}`,
      passportIssueDate: addDays(today, -Math.floor(365 * (1 + R() * 3))),
      passportExpiryDate,
      travelType: R() < 0.55 ? 'عمره' : 'حج',
      caravanNumber: `C-${1 + (i % 4)}`,
      status,
      photo: '',
      familyGroup: '',
      packagePrice: price,
      currency: usd ? 'دالر' : 'افغانی',
      finalPrice: '',
      stayDuration: pick([14, 21, 30]),
      companyId: i % 5 === 0 ? '' : companies[i % 3].id,
      createdAt,
    }
    pilgrims.push(p)

    // الگوهای مختلف پرداخت تا تحلیل مشتریان چیز جالبی نشان دهد
    const profile = i % 6
    if (profile === 3 && status !== 'لغو شده') continue // بدون هیچ پرداخت
    const fraction = [1, 0.7, 0.4, 0, 0.85, 1][profile]
    const stalled = profile === 1 || (profile === 2 && i % 2 === 0)
    const n = [3, 2, 1, 0, 3, 1][profile]
    if (!n || !fraction) continue

    const end = stalled ? addDays(today, -(55 + Math.floor(R() * 30))) : addDays(today, -Math.floor(R() * 20))
    const start = createdAt < end ? createdAt : addDays(end, -30)
    const span = Math.max(1, daysBetween(start, end))
    const total = Math.round(price * fraction)
    let left = total
    for (let j = 0; j < n; j += 1) {
      const amount = j === n - 1 ? left : Math.round((total / n) / (usd ? 10 : 500)) * (usd ? 10 : 500)
      left -= amount
      if (amount <= 0) continue
      receipt += 1
      payments.push({
        id: `demo-pay-${receipt}`,
        receiptNumber: `RC-${receipt}`,
        pilgrimId: p.id,
        pilgrimName: `${p.fullName} ${p.lastName}`,
        amount,
        paymentType: pick(['نقدی', 'حواله', 'بانکی']),
        date: addDays(start, Math.round((span * j) / Math.max(1, n - 1))),
        description: j === 0 ? 'پیش‌پرداخت' : `قسط ${j + 1}`,
        status: 'پرداخت شده',
        currency: p.currency,
        exchangeRate: '',
        usdAmount: usd ? amount : '',
      })
    }
  }

  // ───────── مصارف ─────────
  const CATS = [
    ['نان و خوراکه', 25, 800, ['نان صبحانه کارمندان', 'چای و میوه دفتر', 'ناهار مهمانان']],
    ['ترانسپورت', 20, 1500, ['کرایه موتر', 'تکسی فرودگاه', 'تیل موتر']],
    ['قرطاسیه و لوازم', 10, 1200, ['کاغذ و قلم', 'تونر پرنتر', 'فایل و پوشه']],
    ['تلیفون و انترنت', 8, 2500, ['شارژ انترنت دفتر', 'کارت تلیفون']],
    ['تبلیغات', 6, 6000, ['پوستر و بنر', 'تبلیغ رادیویی']],
    ['تعمیرات', 6, 5000, ['تعمیر کمپیوتر', 'تعمیر کولر']],
    ['خریداری تجهیزات', 4, 9000, ['خرید چوکی', 'خرید پرنتر']],
    ['سایر مصارف', 11, 1500, ['مصارف متفرقه', 'کمک و هدیه']],
  ]
  const totalW = CATS.reduce((s, c) => s + c[1], 0)
  const expenses = []
  const addExp = (date, category, person, amount, description, currency = 'افغانی') => {
    expenses.push({ id: `demo-ex-${expenses.length + 1}`, date, type: 'مصرف', category, person, amount, description, currency })
  }

  for (let i = 0; i < 110; i += 1) {
    let w = R() * totalW
    const c = CATS.find((x) => (w -= x[1]) <= 0) || CATS[0]
    const usd = R() < 0.1
    const base = usd ? Math.max(5, Math.round(c[2] / 80)) : c[2]
    const amount = Math.round(base * (0.7 + R() * 0.6) / 10) * 10 || base
    addExp(addDays(today, -Math.floor(R() * 240)), c[0], pick(['احمد', 'رحیم', 'دکان نان', 'شرکت برشنا', '']), amount, pick(c[3]), usd ? 'دالر' : 'افغانی')
  }
  // مصارف ثابت ماهانه
  for (let m = 0; m < 8; m += 1) {
    const d = addDays(today, -(2 + 30 * m))
    addExp(d, 'معاش کارمندان', 'کارمندان', 60000, 'معاش ماهانه کارمندان')
    addExp(d, 'کرایه دفتر', 'مالک دفتر', 30000, 'کرایه ماهانه دفتر')
    addExp(d, 'برق و آب', 'شرکت برشنا', 3500 + Math.round(R() * 1500), 'قبض برق و آب')
  }
  // نمونه‌ی مصرف غیرعادی، مصرف تکراری و جهش مصرف (برای دیدن هشدارهای هوشمند)
  addExp(addDays(today, -10), 'ترانسپورت', 'کرایه‌کار', 45000, 'کرایه موتر برای سفر ویژه')
  addExp(addDays(today, -3), 'قرطاسیه و لوازم', 'احمد', 1500, 'خرید قرطاسیه دفتر')
  addExp(addDays(today, -3), 'قرطاسیه و لوازم', 'احمد', 1500, 'خرید قرطاسیه دفتر')
  const lastMonth = monthRange(monthKeyOf(today) - 1)
  addExp(addDays(lastMonth.from, 10), 'تبلیغات', 'چاپخانه', 30000, 'کمپاین تبلیغاتی موسم عمره')
  expenses.sort((a, b) => b.date.localeCompare(a.date))

  const employees = [
    ['EMP-001', 'احمد ظاهر', 'مدیر دفتر', 30000],
    ['EMP-002', 'رحیم‌الله نوری', 'حسابدار', 25000],
    ['EMP-003', 'سمیه احمدی', 'اپراتور', 18000],
    ['EMP-004', 'جمشید صدیقی', 'رهنما', 20000],
  ].map(([employeeCode, name, position, salary], i) => ({
    id: `demo-emp-${i + 1}`, employeeCode, name, position, phone: `0799${100000 + i}`, email: '', salary, currency: 'افغانی',
    joinDate: addDays(today, -400 - i * 30), status: 'فعال', photo: '',
  }))

  pilgrims.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  payments.sort((a, b) => b.date.localeCompare(a.date))

  return {
    pilgrims, payments, expenses, employees, companies,
    settings: { companyName: 'حالت نمایشی — داده‌ی نمونه', displayCurrency: 'دالر' },
    logs: [
      { id: 'demo-log-1', action: 'ورود به سیستم', user: 'admin', date: new Date().toISOString(), details: 'حالت نمایشی' },
    ],
  }
}

let db = null
const PAGES = {
  dashboard: ['view'],
  pilgrims: ['view', 'create', 'edit', 'delete'],
  payments: ['view', 'create', 'edit', 'delete'],
  reports: ['view', 'export'],
  employees: ['view', 'create', 'edit', 'delete'],
  expenses: ['view', 'create', 'edit', 'delete'],
  companies: ['view', 'create', 'edit', 'delete'],
  settings: ['view'],
}
const PERMISSIONS = Object.fromEntries(Object.entries(PAGES).map(([p, a]) => [p, Object.fromEntries(a.map((x) => [x, true]))]))
const USER = { id: 'demo-user', username: 'admin', name: 'مدیر نمایشی', role: 'Admin', roleLabel: 'مدیر سیستم' }
const RESOURCES = ['pilgrims', 'payments', 'employees', 'companies', 'expenses']
const copy = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)))

export async function demoApi(path, { method = 'GET', body } = {}) {
  await delay(120)
  if (!db) db = build()
  const [, root, id] = path.split('?')[0].split('/')

  if (root === 'auth') {
    if (id === 'login') return { token: 'demo-token', user: USER, permissions: PERMISSIONS }
    if (id === 'me') return { user: USER, permissions: PERMISSIONS }
    return null
  }
  if (root === 'settings') {
    if (method === 'PUT') db.settings = { ...db.settings, ...body }
    return copy(db.settings)
  }
  if (root === 'logs') return copy(db.logs)

  // دستیار هوش مصنوعی: از میان‌افزار Vite (vite.config.js) رد می‌شود؛ کلید فقط همان‌جاست
  if (root === 'ai') {
    let r
    try {
      r = id === 'chat'
        ? await fetch('/__demo_ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/__demo_ai/status')
    } catch {
      throw new DemoError(0, 'ارتباط با دستیار هوش مصنوعی برقرار نشد.')
    }
    let data = null
    try { data = await r.json() } catch { /* ignore */ }
    if (!r.ok) throw new DemoError(r.status, data?.error || `خطا (${r.status})`)
    return data
  }

  if (RESOURCES.includes(root)) {
    const list = db[root]
    if (method === 'GET') return copy(id ? list.find((x) => String(x.id) === id) : list)

    if (method === 'POST') {
      const item = { ...body, id: body?.id || genId() }
      if (root === 'payments') {
        const p = db.pilgrims.find((x) => x.id === item.pilgrimId)
        if (!p) throw new DemoError(400, 'زائر انتخاب‌شده یافت نشد')
        item.pilgrimName = `${p.fullName} ${p.lastName}`.trim()
        if (!item.receiptNumber) {
          const nums = db.payments.map((x) => parseInt(String(x.receiptNumber).replace(/\D/g, ''), 10) || 0)
          item.receiptNumber = `RC-${Math.max(10000, ...nums) + 1}`
        }
        item.usdAmount = item.currency === 'دالر' ? Number(item.amount) : Number(item.exchangeRate) > 0 ? Number(item.amount) / Number(item.exchangeRate) : ''
      }
      list.unshift(item)
      return copy(item)
    }

    const idx = list.findIndex((x) => String(x.id) === id)
    if (idx < 0) throw new DemoError(404, 'یافت نشد')
    if (method === 'PUT' || method === 'PATCH') {
      list[idx] = { ...list[idx], ...body }
      if (root === 'pilgrims') {
        const p = list[idx]
        db.payments.forEach((x) => { if (x.pilgrimId === p.id) x.pilgrimName = `${p.fullName} ${p.lastName}`.trim() })
      }
      return copy(list[idx])
    }
    if (method === 'DELETE') {
      list.splice(idx, 1)
      if (root === 'pilgrims') db.payments = db.payments.filter((x) => x.pilgrimId !== id)
      if (root === 'companies') db.pilgrims.forEach((x) => { if (x.companyId === id) x.companyId = '' })
      return null
    }
  }

  // بخش‌هایی که در حالت نمایشی پشتیبانی نمی‌شوند (کاربران، نقش‌ها، بک‌آپ...)
  return method === 'GET' ? [] : null
}
