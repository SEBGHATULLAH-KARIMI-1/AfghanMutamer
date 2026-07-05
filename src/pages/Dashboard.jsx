import { useMemo, useState, useEffect } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler,
} from 'chart.js'
import {
  FiUsers, FiUserCheck, FiTrendingUp, FiDollarSign, FiCalendar, FiBriefcase, FiTrendingDown,
} from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import StatCard from '../components/common/StatCard'
import { SkeletonCards, SkeletonTable } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import { formatCurrency, formatJalali, toPersianDigits } from '../utils/dateUtils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const MONTH_NAMES = ['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت']

export default function Dashboard() {
  const { pilgrims, payments, employees, settings } = useData()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  const todayStr = new Date().toISOString().slice(0, 10)

  const totalPilgrims = pilgrims.length
  const umrahCount = pilgrims.filter((p) => p.travelType === 'عمره').length
  const hajjCount = pilgrims.filter((p) => p.travelType === 'حج').length
  const todayPayments = payments.filter((p) => p.date === todayStr)
  const todayPaymentsCount = todayPayments.length
  const displayCur = settings.displayCurrency || 'دالر'
  const totalIncome = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const totalEmployees = employees.length
  const pilgrimsWithPrice = pilgrims.filter((p) => p.packagePrice)
  const pricePilgrimIds = new Set(pilgrimsWithPrice.map((p) => p.id))
  const totalExpected = pilgrimsWithPrice.reduce((s, p) => s + Number(p.packagePrice || 0), 0)
  const paidForPriced = payments
    .filter((p) => pricePilgrimIds.has(p.pilgrimId))
    .reduce((s, p) => {
      if (p.currency === 'دالر') return s + Number(p.usdAmount || p.amount || 0)
      return s
    }, 0)
  const remainingBalance = Math.max(0, totalExpected - paidForPriced)

  const monthlyRegistration = useMemo(() => {
    const counts = new Array(12).fill(0)
    pilgrims.forEach((p) => {
      const d = new Date(p.createdAt || p.dob)
      if (!isNaN(d.getTime())) counts[d.getMonth()] += 1
    })
    return counts
  }, [pilgrims])

  const monthlyIncome = useMemo(() => {
    const sums = new Array(12).fill(0)
    payments.forEach((p) => {
      const d = new Date(p.date)
      if (!isNaN(d.getTime())) sums[d.getMonth()] += Number(p.usdAmount || p.amount || 0)
    })
    return sums
  }, [payments])

  const recentPayments = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
  const recentPilgrims = [...pilgrims].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)

  const upcomingSchedules = [
    { caravan: 'C-101', destination: 'مکه مکرمه - عمره', date: '۱۴۰۵/۰۴/۱۲' },
    { caravan: 'C-108', destination: 'مدینه منوره - حج', date: '۱۴۰۵/۰۵/۰۲' },
    { caravan: 'C-114', destination: 'مکه مکرمه - عمره', date: '۱۴۰۵/۰۵/۲۰' },
  ]

  if (loading) {
    return (
      <div>
        <SkeletonCards count={6} />
        <SkeletonTable rows={4} cols={5} />
      </div>
    )
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
        label: `درآمد (${displayCur})`,
        data: monthlyIncome,
        backgroundColor: '#D4AF37',
        borderRadius: 6,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(128,128,128,0.1)' } },
    },
  }

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={<FiUsers />} label="تعداد کل زائران" value={toPersianDigits(totalPilgrims)} color="#0F5132" />
        <StatCard icon={<FiUserCheck />} label="تعداد زائران عمره" value={toPersianDigits(umrahCount)} color="#2b6cc0" />
        <StatCard icon={<FiBriefcase />} label="تعداد زائران حج" value={toPersianDigits(hajjCount)} color="#b8860b" />
        <StatCard icon={<FiCalendar />} label="پرداخت‌های امروز" value={toPersianDigits(todayPaymentsCount)} color="#c0392b" />
        <StatCard icon={<FiDollarSign />} label={`مجموع درآمد (${displayCur})`} value={formatCurrency(totalIncome, displayCur)} color="#D4AF37" />
        <StatCard icon={<FiTrendingDown />} label={`باقی مانده حساب‌ها (${displayCur})`} value={formatCurrency(remainingBalance, displayCur)} color="#c0392b" />
        <StatCard icon={<FiTrendingUp />} label="تعداد کارمندان" value={toPersianDigits(totalEmployees)} color="#1d8a4e" />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header"><h3>نمودار ثبت‌نام ماهانه زائران</h3></div>
          <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}><Line data={lineData} options={chartOptions} /></div>
        </div>
        <div className="card">
          <div className="card-header"><h3>برنامه‌های سفر آینده</h3></div>
          <div className="card-body">
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcomingSchedules.map((s, idx) => (
                <li key={idx} className="flex-between" style={{ padding: '10px 0', borderBottom: idx < upcomingSchedules.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div>
                    <div className="fw-bold" style={{ fontSize: 13.5 }}>{s.destination}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>کاروان {s.caravan}</div>
                  </div>
                  <span className="badge badge-gold">{s.date}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="dashboard-grid mt-3">
        <div className="card">
          <div className="card-header"><h3>نمودار درآمد ماهانه</h3></div>
          <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}><Bar data={barData} options={chartOptions} /></div>
        </div>
        <div className="card">
          <div className="card-header"><h3>اعلان‌های اخیر</h3></div>
          <div className="card-body">
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <li style={{ fontSize: 13 }}>📌 یادآوری: تمدید گذرنامه ۳ زائر تا پایان ماه</li>
              <li style={{ fontSize: 13 }}>📌 کاروان C-101 آماده اعزام است</li>
              <li style={{ fontSize: 13 }}>📌 موجودی صندوق امروز بروزرسانی شد</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="dashboard-grid mt-3">
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
                      <td>{p.caravanNumber}</td>
                      <td><span className={`badge ${p.status === 'تایید شده' ? 'badge-success' : p.status === 'لغو شده' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
