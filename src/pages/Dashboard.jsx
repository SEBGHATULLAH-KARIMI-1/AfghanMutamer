import { Children, useMemo, useState, useEffect } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler,
} from 'chart.js'
import {
  FiUserCheck, FiTrendingUp, FiDollarSign, FiCalendar, FiTrendingDown,
} from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import StatCard from '../components/common/StatCard'
import { SkeletonCards, SkeletonTable } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import { formatCurrency, formatJalali, gregorianToJalali, toPersianDigits } from '../utils/dateUtils'
import { pilgrimBalances, isReceived } from '../utils/finance'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const MONTH_NAMES = ['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت']

// ───────── توابع کمکی تاریخ (بر اساس زمان محلی، نه UTC) ─────────

function pad(n) {
  return String(n).padStart(2, '0')
}

function todayParts() {
  const n = new Date()
  return [n.getFullYear(), n.getMonth() + 1, n.getDate()]
}

function todayLocalISO() {
  const [y, m, d] = todayParts()
  return `${y}-${pad(m)}-${pad(d)}`
}

// تاریخ میلادی را به [سال، ماه، روز] تبدیل می‌کند؛ رشته‌های YYYY-MM-DD بدون اثر منطقه زمانی خوانده می‌شوند
function dateParts(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return [y, m, d]
  }
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
}

// چیدمان ردیفی: اگر فقط یک کارت قابل نمایش باشد، تمام عرض را می‌گیرد
function Row({ children, className = '' }) {
  const items = Children.toArray(children)
  if (items.length === 0) return null
  return (
    <div
      className={`dashboard-grid ${className}`.trim()}
      style={items.length === 1 ? { gridTemplateColumns: '1fr' } : undefined}
    >
      {items}
    </div>
  )
}

export default function Dashboard() {
  const { pilgrims, payments, employees, settings } = useData()
  const { can } = useAuth()
  const [loading, setLoading] = useState(true)
  const [chartCur, setChartCur] = useState(null)

  const canPilgrims = can('pilgrims')
  const canPayments = can('payments')
  const canEmployees = can('employees')

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  const todayStr = todayLocalISO()
  const [jalaliYear] = gregorianToJalali(...todayParts())
  const displayCur = settings.displayCurrency || 'دالر'

  // ───────── آمار زائران ─────────
  const totalPilgrims = pilgrims.length
  const totalEmployees = employees.length
  const todayPaymentsCount = payments.filter((p) => p.date === todayStr && isReceived(p)).length

  // ───────── آمار مالی (هر ارز جداگانه، بدون جمع‌زدن دالر و افغانی) ─────────
  const finance = useMemo(() => {
    const income = { usd: 0, afn: 0 }
    const monthly = { usd: new Array(12).fill(0), afn: new Array(12).fill(0) }

    payments.forEach((p) => {
      if (!isReceived(p)) return // پرداخت «در انتظار» هنوز دریافت نشده و درآمد نیست
      const key = p.currency === 'دالر' ? 'usd' : 'afn' // پرداخت بدون ارز = افغانی
      const amt = Number(p.amount) || 0
      income[key] += amt

      const parts = dateParts(p.date)
      if (!parts) return
      const [jy, jm] = gregorianToJalali(parts[0], parts[1], parts[2])
      if (jy === jalaliYear) monthly[key][jm - 1] += amt
    })

    // باقی‌مانده حساب از محاسبه‌ی مشترک (همان محاسبه‌ی صفحه‌ی پرداخت‌ها)
    const remaining = { usd: 0, afn: 0 }
    let debtorsCount = 0
    pilgrimBalances(pilgrims, payments).forEach((b) => {
      if (b.remaining > 0.005) {
        remaining[b.key] += b.remaining
        debtorsCount += 1
      }
    })

    return { income, monthly, remaining, debtorsCount }
  }, [payments, pilgrims, jalaliYear])

  // ارز نمودار درآمد: پیش‌فرض ارز تنظیمات، قابل تغییر با دکمه‌ها
  const incomeCur = chartCur || (displayCur === 'افغانی' ? 'افغانی' : 'دالر')
  const incomeKey = incomeCur === 'دالر' ? 'usd' : 'afn'

  // ───────── ثبت‌نام ماهانه (سال جاری شمسی) ─────────
  const monthlyRegistration = useMemo(() => {
    const counts = new Array(12).fill(0)
    pilgrims.forEach((p) => {
      const parts = dateParts(p.createdAt)
      if (!parts) return
      const [jy, jm] = gregorianToJalali(parts[0], parts[1], parts[2])
      if (jy === jalaliYear) counts[jm - 1] += 1
    })
    return counts
  }, [pilgrims, jalaliYear])

  // ───────── کاروان‌ها (از داده‌های واقعی زائران) ─────────
  const caravans = useMemo(() => {
    const map = {}
    pilgrims.forEach((p) => {
      if (p.status === 'لغو شده' || !p.caravanNumber) return
      const c = (map[p.caravanNumber] ||= { caravan: p.caravanNumber, count: 0, hajj: 0, umrah: 0 })
      c.count += 1
      if (p.travelType === 'حج') c.hajj += 1
      if (p.travelType === 'عمره') c.umrah += 1
    })
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [pilgrims])

  // ───────── اعلان‌ها (محاسبه‌شده از داده‌ها) ─────────
  const notifications = useMemo(() => {
    const list = []
    if (canPilgrims) {
      const [ty, tm, td] = todayParts()
      const todayUtc = Date.UTC(ty, tm - 1, td)
      let expired = 0
      let soon = 0
      let pending = 0
      pilgrims.forEach((p) => {
        if (p.status === 'لغو شده') return
        if (p.status === 'در انتظار') pending += 1
        const parts = dateParts(p.passportExpiryDate)
        if (!parts) return
        const days = Math.round((Date.UTC(parts[0], parts[1] - 1, parts[2]) - todayUtc) / 86400000)
        if (days < 0) expired += 1
        else if (days <= 180) soon += 1
      })
      if (expired > 0) list.push({ icon: '⚠️', text: `گذرنامه ${toPersianDigits(expired)} زائر منقضی شده است` })
      if (soon > 0) list.push({ icon: '📌', text: `گذرنامه ${toPersianDigits(soon)} زائر تا ۶ ماه آینده منقضی می‌شود` })
      if (pending > 0) list.push({ icon: '📌', text: `${toPersianDigits(pending)} زائر در انتظار تایید هستند` })
    }
    if (canPayments) {
      const pendingPayments = payments.filter((p) => p.status === 'در انتظار').length
      if (pendingPayments > 0) list.push({ icon: '📌', text: `${toPersianDigits(pendingPayments)} پرداخت در وضعیت انتظار است` })
      if (finance.debtorsCount > 0) list.push({ icon: '📌', text: `${toPersianDigits(finance.debtorsCount)} زائر باقی‌مانده حساب دارند` })
    }
    return list
  }, [pilgrims, payments, finance.debtorsCount, canPilgrims, canPayments])

  const recentPayments = [...payments]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 5)
  const recentPilgrims = [...pilgrims]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 5)

  if (loading) {
    return (
      <div>
        <SkeletonCards count={6} />
        <SkeletonTable rows={4} cols={5} />
      </div>
    )
  }

  if (!canPilgrims && !canPayments && !canEmployees) {
    return <EmptyState title="اطلاعاتی برای نمایش وجود ندارد" description="دسترسی شما به داده‌های داشبورد محدود است." />
  }

  const gridColor = 'rgba(128,128,128,0.1)'
  const lineOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: gridColor } },
    },
  }
  const barOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: gridColor } },
    },
  }

  const lineData = {
    labels: MONTH_NAMES,
    datasets: [
      {
        label: 'ثبت‌نام ماهانه',
        data: monthlyRegistration,
        borderColor: '#0F5132',
        backgroundColor: 'rgba(15,81,50,0.15)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#D4AF37',
      },
    ],
  }

  const barData = {
    labels: MONTH_NAMES,
    datasets: [
      {
        label: `درآمد (${incomeCur})`,
        data: finance.monthly[incomeKey],
        backgroundColor: '#D4AF37',
        borderRadius: 6,
      },
    ],
  }

  const caravanTypeText = (c) => {
    if (c.hajj > 0 && c.umrah > 0) return 'حج و عمره'
    if (c.hajj > 0) return 'حج'
    if (c.umrah > 0) return 'عمره'
    return '-'
  }

  return (
    <div>
      <div className="stats-grid">
        {canPilgrims && <StatCard icon={<FiUserCheck />} label="تعداد کل زائران" value={toPersianDigits(totalPilgrims)} color="#0F5132" />}
        {canPayments && <StatCard icon={<FiCalendar />} label="پرداخت‌های امروز" value={toPersianDigits(todayPaymentsCount)} color="#c0392b" />}
        {canPayments && <StatCard icon={<FiDollarSign />} label="مجموع درآمد (دالر)" value={formatCurrency(finance.income.usd, 'دالر')} color="#D4AF37" />}
        {canPayments && <StatCard icon={<FiDollarSign />} label="مجموع درآمد (افغانی)" value={formatCurrency(finance.income.afn, 'افغانی')} color="#b8860b" />}
        {canPayments && <StatCard icon={<FiTrendingDown />} label="باقی مانده حساب‌ها (دالر)" value={formatCurrency(finance.remaining.usd, 'دالر')} color="#c0392b" />}
        {canPayments && <StatCard icon={<FiTrendingDown />} label="باقی مانده حساب‌ها (افغانی)" value={formatCurrency(finance.remaining.afn, 'افغانی')} color="#a93226" />}
        {canEmployees && <StatCard icon={<FiTrendingUp />} label="تعداد کارمندان" value={toPersianDigits(totalEmployees)} color="#1d8a4e" />}
      </div>

      <Row>
        {canPilgrims && (
          <div className="card">
            <div className="card-header"><h3>نمودار ثبت‌نام ماهانه زائران ({toPersianDigits(jalaliYear)})</h3></div>
            <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}><Line data={lineData} options={lineOptions} /></div>
          </div>
        )}
        {canPilgrims && (
          <div className="card">
            <div className="card-header"><h3>کاروان‌ها</h3></div>
            {caravans.length === 0 ? <EmptyState title="کاروانی ثبت نشده" /> : (
              <div className="card-body">
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {caravans.map((c, idx) => (
                    <li key={c.caravan} className="flex-between" style={{ padding: '10px 0', borderBottom: idx < caravans.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <div>
                        <div className="fw-bold" style={{ fontSize: 13.5 }}>کاروان {c.caravan}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>{caravanTypeText(c)}</div>
                      </div>
                      <span className="badge badge-gold">{toPersianDigits(c.count)} زائر</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Row>

      <Row className="mt-3">
        {canPayments && (
          <div className="card">
            <div className="card-header">
              <h3>نمودار درآمد ماهانه ({toPersianDigits(jalaliYear)})</h3>
              <div className="chip-group">
                {['دالر', 'افغانی'].map((c) => (
                  <button key={c} className={`chip ${incomeCur === c ? 'active' : ''}`} onClick={() => setChartCur(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}><Bar data={barData} options={barOptions} /></div>
          </div>
        )}
        {(canPilgrims || canPayments) && (
          <div className="card">
            <div className="card-header"><h3>اعلان‌ها</h3></div>
            <div className="card-body">
              {notifications.length === 0 ? (
                <div className="text-muted" style={{ fontSize: 13 }}>اعلان جدیدی وجود ندارد</div>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {notifications.map((n, idx) => (
                    <li key={idx} style={{ fontSize: 13 }}>{n.icon} {n.text}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Row>

      <Row className="mt-3">
        {canPayments && (
          <div className="card">
            <div className="card-header"><h3>آخرین پرداخت‌ها</h3></div>
            {recentPayments.length === 0 ? <EmptyState title="پرداختی ثبت نشده" /> : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>شماره فیش</th>
                      <th>زائر</th>
                      <th>مبلغ</th>
                      <th>تاریخ</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.receiptNumber}</td>
                        <td>{p.pilgrimName}</td>
                        <td>{formatCurrency(p.amount, p.currency)}</td>
                        <td>{formatJalali(p.date)}</td>
                        <td><span className={`badge ${p.status === 'پرداخت شده' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {canPilgrims && (
          <div className="card">
            <div className="card-header"><h3>زائران اخیر</h3></div>
            {recentPilgrims.length === 0 ? <EmptyState title="زائری ثبت نشده" /> : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>نام کامل</th>
                      <th>نوع سفر</th>
                      <th>کاروان</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPilgrims.map((p) => (
                      <tr key={p.id}>
                        <td>{p.fullName} {p.lastName}</td>
                        <td><span className="badge badge-info">{p.travelType}</span></td>
                        <td>{p.caravanNumber || '-'}</td>
                        <td><span className={`badge ${p.status === 'تایید شده' ? 'badge-success' : p.status === 'لغو شده' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Row>
    </div>
  )
}
