import { useMemo, useState } from 'react'
import { Pie, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { FiDownload, FiFileText } from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import EmptyState from '../components/common/EmptyState'
import { exportTableToPDF } from '../utils/pdfExport'
import { exportToExcel } from '../utils/excelExport'
import { currencyKey, isReceived } from '../utils/finance'
import { formatCurrency, formatJalali, toPersianDigits } from '../utils/dateUtils'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const TABS = [
  { key: 'pilgrims', label: 'گزارش زائران', perm: 'pilgrims' },
  { key: 'financial', label: 'گزارش مالی', perm: 'payments' },
  { key: 'employees', label: 'گزارش کارمندان', perm: 'employees' },
]

const RANGE_OPTIONS = [
  { key: 'daily', label: 'روزانه' },
  { key: 'weekly', label: 'هفتگی' },
  { key: 'monthly', label: 'ماهانه' },
  { key: 'yearly', label: 'سالانه' },
  { key: 'custom', label: 'بازه دلخواه' },
]

const PREVIEW_LIMIT = 30

// تاریخ YYYY-MM-DD را به زمان محلی تبدیل می‌کند (نه UTC)
function toLocalDate(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// بازه‌های نسبی از نیم‌شبِ امروز شروع می‌شوند (نه از «همین ساعت مبارک»)؛ وگرنه فیشِ همان روزِ هفته/ماهِ قبل بیرون می‌ماند
function getRangeStart(range) {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const back = (days) => new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate() - days)
  switch (range) {
    case 'daily': return midnight
    case 'weekly': return back(6)     // ۷ روز شامل امروز
    case 'monthly': return back(29)   // ۳۰ روز شامل امروز
    case 'yearly': return back(364)   // ۳۶۵ روز شامل امروز
    default: return null
  }
}

export default function Reports() {
  const { pilgrims, payments, employees } = useData()
  const { can } = useAuth()
  const { showToast } = useToast()
  const [tab, setTab] = useState('pilgrims')
  const [range, setRange] = useState('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const canExport = can('reports', 'export')

  // فقط گزارش‌هایی که کاربر به داده‌ی آن‌ها دسترسی دارد
  const visibleTabs = TABS.filter((t) => can(t.perm))
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : visibleTabs[0]?.key

  function inRange(dateStr) {
    if (range === 'custom') {
      return (!customFrom || (dateStr || '') >= customFrom) && (!customTo || (dateStr || '') <= customTo)
    }
    const start = getRangeStart(range)
    if (!start) return true
    const d = toLocalDate(dateStr)
    return !!d && d >= start
  }

  const filteredPayments = useMemo(
    () => payments.filter((p) => inRange(p.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, range, customFrom, customTo]
  )

  const filteredPilgrims = useMemo(
    () => pilgrims.filter((p) => inRange(p.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pilgrims, range, customFrom, customTo]
  )

  const hajjCount = filteredPilgrims.filter((p) => p.travelType === 'حج').length
  const umrahCount = filteredPilgrims.filter((p) => p.travelType === 'عمره').length

  // مجموع درآمد به تفکیک ارز (دالر و افغانی هیچ‌وقت با هم جمع نمی‌شوند)
  const income = useMemo(() => {
    const sum = { usd: 0, afn: 0 }
    filteredPayments.forEach((p) => { if (isReceived(p)) sum[currencyKey(p.currency)] += Number(p.amount) || 0 })
    return sum
  }, [filteredPayments])

  const pieData = {
    labels: ['حج', 'عمره'],
    datasets: [{ data: [hajjCount, umrahCount], backgroundColor: ['#0F5132', '#D4AF37'] }],
  }

  const positionCounts = useMemo(() => {
    const map = {}
    employees.forEach((e) => { map[e.position] = (map[e.position] || 0) + 1 })
    return map
  }, [employees])

  const barData = {
    labels: Object.keys(positionCounts),
    datasets: [{ label: 'تعداد کارمندان', data: Object.values(positionCounts), backgroundColor: '#0F5132', borderRadius: 6 }],
  }

  // ─── داده‌های خروجی (برای PDF و Excel) ───
  function buildExport() {
    if (activeTab === 'pilgrims') {
      return {
        title: 'گزارش زائران', baseName: 'pilgrims-report', sheet: 'زائران',
        columns: ['نام', 'تلفن', 'نوع سفر', 'کاروان', 'وضعیت'],
        data: filteredPilgrims.map((p) => [`${p.fullName} ${p.lastName}`, p.phone, p.travelType, p.caravanNumber || '-', p.status]),
      }
    }
    if (activeTab === 'financial') {
      return {
        title: 'گزارش مالی', baseName: 'financial-report', sheet: 'پرداخت‌ها',
        columns: ['فیش', 'زائر', 'مبلغ', 'ارز', 'نوع پرداخت', 'تاریخ', 'وضعیت'],
        data: filteredPayments.map((p) => [p.receiptNumber, p.pilgrimName, Number(p.amount) || 0, p.currency || 'افغانی', p.paymentType, formatJalali(p.date), p.status]),
      }
    }
    return {
      title: 'گزارش کارمندان', baseName: 'employees-report', sheet: 'کارمندان',
      columns: ['کد', 'نام', 'سمت', 'تلفن', 'معاش', 'ارز', 'وضعیت'],
      data: employees.map((e) => [e.employeeCode, e.name, e.position, e.phone, Number(e.salary) || 0, e.currency || 'افغانی', e.status]),
    }
  }

  async function handlePdfExport() {
    const ex = buildExport()
    if (ex.data.length === 0) { showToast('داده‌ای برای خروجی وجود ندارد', 'error'); return }
    try {
      // در PDF مبلغ‌ها با جداکننده‌ی هزارگان نوشته می‌شوند
      const rows = ex.data.map((r) => r.map((cell) => (typeof cell === 'number' ? cell.toLocaleString() : cell)))
      await exportTableToPDF({ title: ex.title, fileName: `${ex.baseName}-${Date.now()}.pdf`, columns: ex.columns, rows })
      showToast('خروجی PDF با موفقیت دریافت شد', 'success')
    } catch {
      showToast('خطا در تولید فایل PDF', 'error')
    }
  }

  async function handleExcelExport() {
    const ex = buildExport()
    if (ex.data.length === 0) { showToast('داده‌ای برای خروجی وجود ندارد', 'error'); return }
    try {
      const rows = ex.data.map((r) => Object.fromEntries(ex.columns.map((c, i) => [c, r[i]])))
      await exportToExcel({ sheetName: ex.sheet, fileName: `${ex.baseName}-${Date.now()}.xlsx`, rows })
      showToast('خروجی Excel با موفقیت دریافت شد', 'success')
    } catch {
      showToast('خطا در تولید فایل Excel', 'error')
    }
  }

  if (visibleTabs.length === 0) {
    return <EmptyState title="گزارشی برای نمایش وجود ندارد" description="دسترسی شما به داده‌های گزارش‌ها محدود است." />
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-body reports-filterbar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div className="chip-group">
            {RANGE_OPTIONS.map((r) => (
              <button key={r.key} className={`chip ${range === r.key ? 'active' : ''}`} onClick={() => setRange(r.key)}>{r.label}</button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="toolbar">
              <input type="date" className="date-input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-muted">تا</span>
              <input type="date" className="date-input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
          {canExport && (
            <div className="toolbar">
              <button className="btn btn-outline" onClick={handlePdfExport}><FiFileText /> خروجی PDF</button>
              <button className="btn btn-outline" onClick={handleExcelExport}><FiDownload /> خروجی Excel</button>
            </div>
          )}
        </div>
      </div>

      <div className="tabs">
        {visibleTabs.map((t) => (
          <button key={t.key} className={activeTab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'pilgrims' && (
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header"><h3>فهرست زائران در بازه انتخابی ({toPersianDigits(filteredPilgrims.length)})</h3></div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>نام</th><th>نوع سفر</th><th>کاروان</th><th>وضعیت</th></tr></thead>
                <tbody>
                  {filteredPilgrims.slice(0, PREVIEW_LIMIT).map((p) => (
                    <tr key={p.id}>
                      <td>{p.fullName} {p.lastName}</td>
                      <td><span className="badge badge-info">{p.travelType}</span></td>
                      <td>{p.caravanNumber || '-'}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredPilgrims.length > PREVIEW_LIMIT && (
              <div className="text-muted" style={{ padding: '10px 20px', fontSize: 12 }}>
                {toPersianDigits(PREVIEW_LIMIT)} مورد اول نمایش داده شده؛ خروجی PDF و Excel شامل همه‌ی {toPersianDigits(filteredPilgrims.length)} مورد است.
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-header"><h3>نسبت حج و عمره</h3></div>
            <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}><Pie data={pieData} /></div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3>گزارش مالی</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
              <span>مجموع دریافت‌شده (دالر): <strong>{formatCurrency(income.usd, 'دالر')}</strong></span>
              <span>مجموع دریافت‌شده (افغانی): <strong>{formatCurrency(income.afn, 'افغانی')}</strong></span>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>فیش</th><th>زائر</th><th>مبلغ</th><th>تاریخ</th><th>وضعیت</th></tr></thead>
              <tbody>
                {filteredPayments.slice(0, PREVIEW_LIMIT).map((p) => (
                  <tr key={p.id}>
                    <td>{p.receiptNumber}</td>
                    <td>{p.pilgrimName}</td>
                    <td className="fw-bold">{formatCurrency(p.amount, p.currency)}</td>
                    <td>{formatJalali(p.date)}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPayments.length > PREVIEW_LIMIT && (
            <div className="text-muted" style={{ padding: '10px 20px', fontSize: 12 }}>
              {toPersianDigits(PREVIEW_LIMIT)} مورد اول نمایش داده شده؛ خروجی PDF و Excel شامل همه‌ی {toPersianDigits(filteredPayments.length)} مورد است.
            </div>
          )}
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header"><h3>فهرست کارمندان</h3></div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>نام</th><th>سمت</th><th>معاش</th><th>وضعیت</th></tr></thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td>{e.position}</td>
                      <td>{formatCurrency(e.salary, e.currency)}</td>
                      <td>{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>توزیع سمت‌ها</h3></div>
            <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}><Bar data={barData} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div>
          </div>
        </div>
      )}
    </div>
  )
}
