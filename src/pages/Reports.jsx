import { useMemo, useState } from 'react'
import { Pie, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { FiDownload, FiFileText } from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { exportTableToPDF } from '../utils/pdfExport'
import { exportToExcel } from '../utils/excelExport'
import { formatCurrency, formatJalali, toPersianDigits } from '../utils/dateUtils'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const TABS = [
  { key: 'pilgrims', label: 'گزارش زائران' },
  { key: 'financial', label: 'گزارش مالی' },
  { key: 'employees', label: 'گزارش کارمندان' },
]

const RANGE_OPTIONS = [
  { key: 'daily', label: 'روزانه' },
  { key: 'weekly', label: 'هفتگی' },
  { key: 'monthly', label: 'ماهانه' },
  { key: 'yearly', label: 'سالانه' },
  { key: 'custom', label: 'بازه دلخواه' },
]

function getRangeStart(range) {
  const now = new Date()
  switch (range) {
    case 'daily': return new Date(now.setHours(0, 0, 0, 0))
    case 'weekly': return new Date(Date.now() - 7 * 86400000)
    case 'monthly': return new Date(Date.now() - 30 * 86400000)
    case 'yearly': return new Date(Date.now() - 365 * 86400000)
    default: return null
  }
}

export default function Reports() {
  const { pilgrims, payments, employees, settings } = useData()
  const [tab, setTab] = useState('pilgrims')
  const [range, setRange] = useState('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const filteredPayments = useMemo(() => {
    if (range === 'custom') {
      return payments.filter((p) => (!customFrom || p.date >= customFrom) && (!customTo || p.date <= customTo))
    }
    const start = getRangeStart(range)
    if (!start) return payments
    return payments.filter((p) => new Date(p.date) >= start)
  }, [payments, range, customFrom, customTo])

  const filteredPilgrims = useMemo(() => {
    if (range === 'custom') {
      return pilgrims.filter((p) => (!customFrom || p.createdAt >= customFrom) && (!customTo || p.createdAt <= customTo))
    }
    const start = getRangeStart(range)
    if (!start) return pilgrims
    return pilgrims.filter((p) => new Date(p.createdAt) >= start)
  }, [pilgrims, range, customFrom, customTo])

  const hajjCount = filteredPilgrims.filter((p) => p.travelType === 'حج').length
  const umrahCount = filteredPilgrims.filter((p) => p.travelType === 'عمره').length
  const displayCur = settings.displayCurrency || 'دالر'
  const totalIncome = filteredPayments.reduce((s, p) => s + Number(p.usdAmount || p.amount || 0), 0)

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

  function handlePdfExport() {
    if (tab === 'pilgrims') {
      exportTableToPDF({
        title: 'Pilgrims Report',
        fileName: 'pilgrims-report.pdf',
        columns: ['Name', 'Phone', 'Travel Type', 'Caravan', 'Status'],
        rows: filteredPilgrims.map((p) => [`${p.fullName} ${p.lastName}`, p.phone, p.travelType, p.caravanNumber, p.status]),
      })
    } else if (tab === 'financial') {
      exportTableToPDF({
        title: 'Financial Report',
        fileName: 'financial-report.pdf',
        columns: ['Receipt', 'Pilgrim', 'Amount', 'Type', 'Date', 'Status'],
        rows: filteredPayments.map((p) => [p.receiptNumber, p.pilgrimName, p.amount, p.paymentType, p.date, p.status]),
      })
    } else {
      exportTableToPDF({
        title: 'Employees Report',
        fileName: 'employees-report.pdf',
        columns: ['Code', 'Name', 'Position', 'Phone', 'Salary', 'Status'],
        rows: employees.map((e) => [e.employeeCode, e.name, e.position, e.phone, e.salary, e.status]),
      })
    }
  }

  function handleExcelExport() {
    if (tab === 'pilgrims') {
      exportToExcel({
        sheetName: 'Pilgrims', fileName: 'pilgrims-report.xlsx',
        rows: filteredPilgrims.map((p) => ({ نام: `${p.fullName} ${p.lastName}`, تلفن: p.phone, نوع_سفر: p.travelType, کاروان: p.caravanNumber, وضعیت: p.status })),
      })
    } else if (tab === 'financial') {
      exportToExcel({
        sheetName: 'Payments', fileName: 'financial-report.xlsx',
        rows: filteredPayments.map((p) => ({ فیش: p.receiptNumber, زائر: p.pilgrimName, مبلغ: p.amount, نوع: p.paymentType, تاریخ: p.date, وضعیت: p.status })),
      })
    } else {
      exportToExcel({
        sheetName: 'Employees', fileName: 'employees-report.xlsx',
        rows: employees.map((e) => ({ کد: e.employeeCode, نام: e.name, سمت: e.position, تلفن: e.phone, معاش: e.salary, وضعیت: e.status })),
      })
    }
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
          <div className="toolbar">
            <button className="btn btn-outline" onClick={handlePdfExport}><FiFileText /> خروجی PDF</button>
            <button className="btn btn-outline" onClick={handleExcelExport}><FiDownload /> خروجی Excel</button>
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'pilgrims' && (
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header"><h3>فهرست زائران در بازه انتخابی ({toPersianDigits(filteredPilgrims.length)})</h3></div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>نام</th><th>نوع سفر</th><th>کاروان</th><th>وضعیت</th></tr></thead>
                <tbody>
                  {filteredPilgrims.slice(0, 30).map((p) => (
                    <tr key={p.id}>
                      <td>{p.fullName} {p.lastName}</td>
                      <td><span className="badge badge-info">{p.travelType}</span></td>
                      <td>{p.caravanNumber}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>نسبت حج و عمره</h3></div>
            <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}><Pie data={pieData} /></div>
          </div>
        </div>
      )}

      {tab === 'financial' && (
        <div className="card">
          <div className="card-header">
            <h3>گزارش مالی — مجموع: {formatCurrency(totalIncome, displayCur)}</h3>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>فیش</th><th>زائر</th><th>مبلغ</th><th>تاریخ</th><th>وضعیت</th></tr></thead>
              <tbody>
                {filteredPayments.slice(0, 30).map((p) => (
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
        </div>
      )}

      {tab === 'employees' && (
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
            <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}><Bar data={barData} options={{ plugins: { legend: { display: false } } }} /></div>
          </div>
        </div>
      )}
    </div>
  )
}
