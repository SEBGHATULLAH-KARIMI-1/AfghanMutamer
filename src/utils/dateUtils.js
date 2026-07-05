// تبدیل تاریخ میلادی به شمسی (جلالی) و توابع کمکی تاریخ

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

export function toPersianDigits(input) {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)])
}

function div(a, b) {
  return Math.trunc(a / b)
}

// الگوریتم استاندارد تبدیل میلادی به جلالی
export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let gy2 = gm > 2 ? gy + 1 : gy
  let days =
    355666 +
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    g_d_m[gm - 1]
  let jy = -1595 + 33 * div(days, 12053)
  days %= 12053
  jy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) {
    jy += div(days - 1, 365)
    days = (days - 1) % 365
  }
  let jm, jd
  if (days < 186) {
    jm = 1 + div(days, 31)
    jd = 1 + (days % 31)
  } else {
    jm = 7 + div(days - 186, 30)
    jd = 1 + ((days - 186) % 30)
  }
  return [jy, jm, jd]
}

const JALALI_MONTHS = [
  'حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله',
  'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت',
]

export function formatJalali(dateInput, withTime = false) {
  if (!dateInput) return '-'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '-'
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const datePart = `${toPersianDigits(jy)}/${toPersianDigits(String(jm).padStart(2, '0'))}/${toPersianDigits(String(jd).padStart(2, '0'))}`
  if (!withTime) return datePart
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${datePart} - ${toPersianDigits(hh)}:${toPersianDigits(mm)}`
}

export function formatJalaliLong(dateInput) {
  if (!dateInput) return '-'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '-'
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`
}

export function formatGregorian(dateInput) {
  if (!dateInput) return '-'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '-'
  return d.toISOString().slice(0, 10)
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function formatCurrency(amount, currency) {
  const n = Number(amount) || 0
  const suffix = currency || 'افغانی'
  return toPersianDigits(n.toLocaleString('en-US')) + ' ' + suffix
}

export function formatNumber(n) {
  return toPersianDigits(Number(n || 0).toLocaleString('en-US'))
}
