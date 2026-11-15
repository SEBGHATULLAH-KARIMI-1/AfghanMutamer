// بررسی یکپارچگی ارتباط‌های داده‌ها (فقط گزارش می‌دهد، چیزی را تغییر نمی‌دهد)
import { latestRate } from './finance'

function dupes(list, keyFn) {
  const seen = new Map()
  list.forEach((item) => {
    const k = keyFn(item)
    if (!k) return
    seen.set(k, (seen.get(k) || 0) + 1)
  })
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} (${n} بار)`)
}

const fullName = (p) => `${p.fullName || ''} ${p.lastName || ''}`.trim()

export function checkIntegrity({ pilgrims = [], payments = [], companies = [], employees = [], users = [], roles = [] } = {}) {
  const issues = []
  const add = (level, title, items) => {
    if (items.length) issues.push({ level, title, count: items.length, samples: items.slice(0, 5) })
  }

  const pilgrimMap = new Map(pilgrims.map((p) => [p.id, p]))
  const companyIds = new Set(companies.map((c) => c.id))
  const roleNames = new Set(roles.map((r) => r.name))
  const rate = latestRate(payments)

  // پرداخت ← زائر
  add('warning', 'پرداخت‌هایی که زائرشان حذف شده است (در درآمد حساب می‌شوند ولی به هیچ زائری وصل نیستند)',
    payments.filter((p) => !pilgrimMap.has(p.pilgrimId)).map((p) => `${p.receiptNumber} — ${p.pilgrimName || '؟'}`))
  add('info', 'پرداخت‌هایی که نام زائر در آن‌ها با نام فعلی زائر فرق دارد',
    payments.filter((p) => { const z = pilgrimMap.get(p.pilgrimId); return z && p.pilgrimName !== fullName(z) })
      .map((p) => `${p.receiptNumber} — ${p.pilgrimName}`))
  add('error', 'پرداخت‌هایی با مبلغ نامعتبر',
    payments.filter((p) => !(Number(p.amount) > 0)).map((p) => `${p.receiptNumber}`))
  add('warning', 'پرداخت‌هایی که ارزشان با ارز بسته‌ی زائر فرق دارد و هیچ نرخ برابری‌ای ثبت نشده است (در باقی‌مانده حساب نمی‌شوند)',
    payments.filter((p) => {
      const z = pilgrimMap.get(p.pilgrimId)
      if (!z || !(Number(z.packagePrice) > 0)) return false
      return (z.currency || 'افغانی') !== (p.currency || 'افغانی') && !(Number(p.exchangeRate) > 0) && !(rate > 0)
    }).map((p) => `${p.receiptNumber} — ${p.pilgrimName}`))

  // زائر ← شرکت
  add('warning', 'زائرانی که شرکتشان حذف شده است',
    pilgrims.filter((p) => p.companyId && !companyIds.has(p.companyId)).map(fullName))

  // کاربر ← نقش
  add('error', 'کاربرانی که نقششان وجود ندارد (بعد از ورود به هیچ صفحه‌ای دسترسی ندارند)',
    users.filter((u) => !roleNames.has(u.role)).map((u) => `${u.username} (${u.role})`))
  const canManage = users.some((u) => roles.find((r) => r.name === u.role)?.permissions?.settings?.view)
  if (!canManage) {
    issues.push({ level: 'error', title: 'هیچ کاربری به صفحه‌ی تنظیمات دسترسی ندارد', count: 1, samples: [] })
  }

  // یکتایی
  add('error', 'نام کاربری تکراری', dupes(users, (u) => String(u.username || '').toLowerCase()))
  add('error', 'نام نقش تکراری', dupes(roles, (r) => String(r.name || '').toLowerCase()))
  add('warning', 'شماره گذرنامه تکراری', dupes(pilgrims, (p) => String(p.passportNumber || '').trim().toUpperCase()))
  add('warning', 'شماره فیش تکراری', dupes(payments, (p) => p.receiptNumber))
  add('warning', 'کد کارمند تکراری', dupes(employees, (e) => e.employeeCode))
  add('error', 'شناسه‌ی تکراری در یک جدول', [
    ['زائر', pilgrims], ['پرداخت', payments], ['شرکت', companies], ['کارمند', employees], ['کاربر', users],
  ].flatMap(([name, list]) => dupes(list, (x) => x.id).map((s) => `${name}: ${s}`)))

  return issues
}
