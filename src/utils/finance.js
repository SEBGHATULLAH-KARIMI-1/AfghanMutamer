// محاسبات مالی مشترک بین داشبورد، گزارش‌ها، تحلیل هوشمند و صفحه‌ی پرداخت‌ها
// قواعد:
//  ۱) دالر و افغانی هیچ‌وقت با هم جمع نمی‌شوند. پرداخت بدون ارز = افغانی.
//  ۲) «نرخ برابری» همیشه یعنی هر ۱ دالر = ? افغانی.
//  ۳) پرداخت با وضعیت «در انتظار» هنوز دریافت نشده است: نه در درآمد حساب می‌شود و نه از باقی‌مانده‌ی زائر کم می‌کند.
//  ۴) پرداخت به ارز دیگرِ بسته، با نرخ خودِ همان فیش تبدیل می‌شود؛ اگر فیش نرخ نداشت، نرخِ نزدیک‌ترِ قبل از تاریخ آن فیش
//     (و اگر قبل از آن نرخی نبود، اولین نرخ ثبت‌شده) به‌کار می‌رود، نه «آخرین نرخ کل سیستم».

export function currencyKey(currency) {
  return currency === 'دالر' ? 'usd' : 'afn'
}

export function currencyLabel(key) {
  return key === 'usd' ? 'دالر' : 'افغانی'
}

export const PENDING_STATUS = 'در انتظار'

// آیا این پرداخت دریافت شده است؟ (همه‌ی وضعیت‌ها به‌جز «در انتظار»)
export const isReceived = (p) => p?.status !== PENDING_STATUS

// شماره فیش بعدی (فقط برای نمایش/حالت‌های بدون سرور؛ سرور خودش شماره‌ی بدون تکرار می‌سازد)
export function nextReceiptNumber(payments) {
  const nums = payments
    .map((p) => parseInt(String(p.receiptNumber || '').replace(/\D/g, ''), 10))
    .filter((n) => Number.isFinite(n))
  return 'RC-' + (Math.max(9999, ...nums) + 1)
}

// آیا ارز پرداخت با ارز قیمت بسته‌ی زائر فرق دارد؟
export function isCrossCurrency(pilgrim, payCurrency) {
  if (!pilgrim || !(Number(pilgrim.packagePrice) > 0)) return false
  return (pilgrim.currency || 'افغانی') !== payCurrency
}

// آخرین نرخ برابری ثبت‌شده (هر ۱ دالر = ? افغانی)؛ اگر هیچ نرخی ثبت نشده باشد ۰
export function latestRate(payments) {
  const withRate = payments.filter((p) => Number(p.exchangeRate) > 0)
  if (withRate.length === 0) return 0
  withRate.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  return Number(withRate[0].exchangeRate)
}

// جدول نرخ‌ها به ترتیب تاریخ (قدیمی → جدید)
export function rateTable(payments) {
  return payments
    .filter((p) => Number(p.exchangeRate) > 0)
    .map((p) => ({ date: String(p.date || '').slice(0, 10), rate: Number(p.exchangeRate) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// نرخِ معتبر برای یک تاریخ: آخرین نرخِ ثبت‌شده تا همان روز؛ اگر نبود، اولین نرخِ موجود؛ اگر هیچ نرخی نبود ۰
export function rateOn(table, date) {
  if (!table.length) return 0
  const d = String(date || '').slice(0, 10)
  let found = null
  for (const r of table) {
    if (r.date <= d) found = r
    else break
  }
  return (found || table[0]).rate
}

// تبدیل مبلغ بین دو ارز با نرخ (۱ دالر = rate افغانی)؛ بدون نرخ برای ارز متفاوت null برمی‌گرداند
export function convertAmount(amount, fromCurrency, toCurrency, rate) {
  const a = Number(amount) || 0
  const f = currencyKey(fromCurrency)
  const t = currencyKey(toCurrency)
  if (f === t) return a
  if (!(Number(rate) > 0)) return null
  return f === 'usd' ? a * Number(rate) : a / Number(rate)
}

const ZERO = { usd: 0, afn: 0, afnInUsd: 0, usdInAfn: 0, afnLost: 0, usdLost: 0, count: 0 }

/**
 * وضعیت حساب هر زائرِ دارای قیمت بسته، به ارزِ همان بسته.
 * فقط پرداخت‌های دریافت‌شده حساب می‌شوند (نه «در انتظار»).
 * اگر پرداخت به ارز دیگر باشد و هیچ نرخی در کل سیستم نباشد، آن مبلغ قابل تبدیل نیست؛ در `unconverted`
 * (به ارز پرداخت) برمی‌گردد تا صفحه بتواند هشدار بدهد، و در `remaining` اثری ندارد.
 */
export function pilgrimBalances(pilgrims, payments) {
  const table = rateTable(payments)
  const paidBy = {}

  payments.forEach((p) => {
    if (!isReceived(p)) return
    const key = currencyKey(p.currency)
    const amt = Number(p.amount) || 0
    const own = Number(p.exchangeRate) > 0 ? Number(p.exchangeRate) : 0
    const rate = own || rateOn(table, p.date)
    const e = (paidBy[p.pilgrimId] ||= { ...ZERO })
    e[key] += amt
    e.count += 1
    if (rate > 0) {
      if (key === 'afn') e.afnInUsd += amt / rate
      else e.usdInAfn += amt * rate
    } else if (key === 'afn') e.afnLost += amt
    else e.usdLost += amt
  })

  // زائران لغو‌شده بدهی ندارند؛ پرداخت‌هایشان همچنان در درآمد حساب می‌شود
  return pilgrims
    .filter((p) => Number(p.packagePrice) > 0 && p.status !== 'لغو شده')
    .map((p) => {
      const key = currencyKey(p.currency)
      const e = paidBy[p.id] || ZERO
      const price = Number(p.packagePrice)
      const paid = key === 'usd' ? e.usd + e.afnInUsd : e.afn + e.usdInAfn
      return {
        pilgrim: p,
        key,
        currency: currencyLabel(key),
        price,
        paid,
        remaining: price - paid,
        paymentCount: e.count,
        unconverted: key === 'usd' ? e.afnLost : e.usdLost,
        unconvertedCurrency: key === 'usd' ? 'افغانی' : 'دالر',
      }
    })
}
