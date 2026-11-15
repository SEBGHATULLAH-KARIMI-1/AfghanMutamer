import { useMemo, useState } from 'react'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiPrinter, FiDollarSign, FiCalendar, FiTrendingDown, FiClock, FiAlertTriangle,
} from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useTableState } from '../utils/useTableState'
import Modal from '../components/common/Modal'
import ConfirmModal from '../components/common/ConfirmModal'
import Pagination from '../components/common/Pagination'
import EmptyState from '../components/common/EmptyState'
import StatCard from '../components/common/StatCard'
import { exportReceiptToPDF } from '../utils/pdfExport'
import {
  pilgrimBalances, latestRate, currencyKey, convertAmount, isReceived, isCrossCurrency,
} from '../utils/finance'
import { formatCurrency, formatJalali, todayISO, toPersianDigits } from '../utils/dateUtils'

const EMPTY_FORM = {
  receiptNumber: '', pilgrimId: '', pilgrimName: '', amount: '', paymentType: 'نقدی',
  date: '', description: '', status: 'پرداخت شده', currency: 'افغانی',
  exchangeRate: '', usdAmount: '',
}

const DEBTORS_PREVIEW = 10

const pilgrimLabel = (p) => `${p.fullName} ${p.lastName}${p.passportNumber ? ` — ${p.passportNumber}` : ''}`

export default function Payments() {
  const { payments, addPayment, updatePayment, deletePayment, pilgrims, settings } = useData()
  const { showToast } = useToast()
  const { can } = useAuth()

  const table = useTableState(payments, {
    searchFields: ['receiptNumber', 'pilgrimName', 'description'],
    pageSize: 8,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, date: todayISO() })
  const [errors, setErrors] = useState({})
  const [confirmId, setConfirmId] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedPilgrimDetails, setSelectedPilgrimDetails] = useState(null)
  const [showAllDebtors, setShowAllDebtors] = useState(false)
  const [pilgrimText, setPilgrimText] = useState('')

  const dateFiltered = useMemo(() => {
    let list = table.filtered
    if (dateFrom) list = list.filter((p) => p.date >= dateFrom)
    if (dateTo) list = list.filter((p) => p.date <= dateTo)
    return list
  }, [table.filtered, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(dateFiltered.length / table.pageSize))
  const page = Math.min(table.page, totalPages)

  // ─── محاسبات مالی (هر ارز جداگانه؛ فقط پرداخت‌های دریافت‌شده) ───
  const fallbackRate = useMemo(() => latestRate(payments), [payments])
  const balances = useMemo(() => pilgrimBalances(pilgrims, payments), [pilgrims, payments])

  const totals = useMemo(() => {
    const today = todayISO()
    const total = { usd: 0, afn: 0 }
    const todayTotal = { usd: 0, afn: 0 }
    let pendingCount = 0
    payments.forEach((p) => {
      if (!isReceived(p)) { pendingCount += 1; return }
      const k = currencyKey(p.currency)
      const a = Number(p.amount) || 0
      total[k] += a
      if (p.date === today) todayTotal[k] += a
    })
    const remaining = { usd: 0, afn: 0 }
    balances.forEach((b) => {
      if (b.remaining > 0.005) remaining[b.key] += b.remaining
    })
    return { total, todayTotal, remaining, pendingCount }
  }, [payments, balances])

  // ─── بدهکاران: زائرانی که باقی حساب دارند ───
  const debtors = useMemo(
    () => balances.filter((b) => b.remaining > 0.005).sort((a, b) => b.remaining - a.remaining),
    [balances]
  )
  const shownDebtors = showAllDebtors ? debtors : debtors.slice(0, DEBTORS_PREVIEW)

  // زائرانی که پرداخت به ارز دیگر دارند ولی هیچ نرخی در سیستم نیست؛ باقی‌مانده‌ی آن‌ها دقیق نیست
  const missingRate = useMemo(() => balances.filter((b) => b.unconverted > 0.005), [balances])

  function balanceOf(pilgrimId) {
    return balances.find((b) => b.pilgrim.id === pilgrimId)
  }

  // آیا پرداخت به ارزی غیر از ارز بسته‌ی زائر است؟ (نرخ برابری الزامی)
  const crossNow = isCrossCurrency(selectedPilgrimDetails, form.currency)
  // فیلد نرخ: برای افغانی همیشه (برای محاسبه‌ی معادل دالری)، برای دالر فقط وقتی بسته افغانی است
  const needsRate = form.currency === 'افغانی' || crossNow

  // نرخ پیش‌فرض فرم: آخرین نرخ ثبت‌شده؛ روی فیش ثبت می‌شود تا بعداً با عوض‌شدن نرخ‌ها حساب قدیمی جابه‌جا نشود
  function rateDefault(pilgrim, currency) {
    const need = currency === 'افغانی' || isCrossCurrency(pilgrim, currency)
    return need && fallbackRate > 0 ? String(fallbackRate) : ''
  }

  function openAdd(pilgrim) {
    const base = { ...EMPTY_FORM, date: todayISO() }
    if (pilgrim) {
      const currency = Number(pilgrim.packagePrice) > 0 ? (pilgrim.currency || 'افغانی') : base.currency
      Object.assign(base, {
        pilgrimId: pilgrim.id,
        pilgrimName: `${pilgrim.fullName} ${pilgrim.lastName}`.trim(),
        currency,
        exchangeRate: rateDefault(pilgrim, currency),
      })
    } else {
      base.exchangeRate = rateDefault(null, base.currency)
    }
    setForm(base)
    setEditId(null)
    setErrors({})
    setSelectedPilgrimDetails(pilgrim || null)
    setPilgrimText(pilgrim ? pilgrimLabel(pilgrim) : '')
    setModalOpen(true)
  }

  function openEdit(p) {
    const pilgrim = pilgrims.find((x) => x.id === p.pilgrimId) || null
    const cur = p.currency || 'افغانی'
    setForm({
      ...EMPTY_FORM,
      ...p,
      currency: cur,
      // اگر فیشِ ارز‌متفاوت نرخ نداشته، نرخ پیش‌فرض نشان داده می‌شود؛ بدون دست‌زدن به نرخ‌های ثبت‌شده
      exchangeRate: p.exchangeRate || (isCrossCurrency(pilgrim, cur) ? rateDefault(pilgrim, cur) : ''),
    })
    setEditId(p.id)
    setErrors({})
    setSelectedPilgrimDetails(pilgrim)
    setPilgrimText(pilgrim ? pilgrimLabel(pilgrim) : (p.pilgrimName || ''))
    setModalOpen(true)
  }

  function validate() {
    const errs = {}
    // فیشِ زائرِ حذف‌شده را می‌شود ویرایش کرد (بدون انتخاب زائر)؛ فقط برای فیش جدید زائر الزامی است
    if (!form.pilgrimId && !editId) {
      errs.pilgrimId = pilgrimText.trim()
        ? 'زائری با این نام پیدا نشد؛ از لیست انتخاب کنید'
        : 'انتخاب زائر الزامی است'
    }
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'مبلغ معتبر وارد کنید'
    if (!form.date) errs.date = 'تاریخ الزامی است'
    if (crossNow && !(Number(form.exchangeRate) > 0) && !(fallbackRate > 0)) {
      errs.exchangeRate = 'ارز پرداخت با ارز بسته فرق دارد؛ نرخ برابری را وارد کنید'
    }
    if (form.exchangeRate !== '' && Number(form.exchangeRate) <= 0) {
      errs.exchangeRate = 'نرخ برابری باید بزرگ‌تر از صفر باشد'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handlePilgrimChange(id) {
    const p = pilgrims.find((x) => x.id === id) || null
    // ارز پرداخت به‌طور پیش‌فرض همان ارز بسته‌ی زائر است تا تبدیل ارز لازم نشود
    const currency = p && Number(p.packagePrice) > 0 ? (p.currency || 'افغانی') : form.currency
    setForm((f) => ({
      ...f,
      pilgrimId: id,
      pilgrimName: p ? `${p.fullName} ${p.lastName}` : '',
      currency,
      exchangeRate: rateDefault(p, currency),
    }))
    setSelectedPilgrimDetails(p)
  }

  // نوشتن نام زائر در فیلد: وقتی متن با یک زائر مطابقت داشته باشد انتخاب می‌شود
  function handlePilgrimInput(text) {
    setPilgrimText(text)
    const t = text.trim()
    let match = selectablePilgrims.find((p) => pilgrimLabel(p) === t)
    if (!match) {
      const byName = selectablePilgrims.filter((p) => `${p.fullName} ${p.lastName}`.trim() === t)
      if (byName.length === 1) match = byName[0]
    }
    if (match) {
      if (match.id !== form.pilgrimId) handlePilgrimChange(match.id)
    } else if (form.pilgrimId) {
      handlePilgrimChange('')
    }
  }

  function handleCurrencyChange(currency) {
    setForm((f) => ({ ...f, currency, exchangeRate: rateDefault(selectedPilgrimDetails, currency) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const amount = Number(form.amount || 0)
    const typed = Number(form.exchangeRate)
    // نرخ فقط وقتی لازم است نگه داشته می‌شود؛ اگر ننوشته باشند برای ارز متفاوت آخرین نرخ ثبت‌شده
    let rate = 0
    if (needsRate) rate = typed > 0 ? typed : (crossNow ? fallbackRate : 0)
    const usdAmount = form.currency === 'دالر' ? amount : (rate > 0 ? amount / rate : null)

    // هشدار پرداخت بیش از باقی‌مانده‌ی حساب (فقط برای پرداخت دریافت‌شده)
    if (selectedPilgrimDetails && Number(selectedPilgrimDetails.packagePrice) > 0 && form.status !== 'در انتظار') {
      const others = payments.filter((p) => p.id !== editId)
      const b = pilgrimBalances([selectedPilgrimDetails], others)[0]
      if (b) {
        const inPackage = convertAmount(amount, form.currency, b.currency, rate)
        if (inPackage != null && inPackage > Math.max(0, b.remaining) + 0.005) {
          const over = inPackage - Math.max(0, b.remaining)
          const ok = window.confirm(
            `این مبلغ ${formatCurrency(over, b.currency)} بیشتر از باقی‌مانده‌ی حساب این زائر `
            + `(${formatCurrency(Math.max(0, b.remaining), b.currency)}) است. با این وجود ثبت شود؟`,
          )
          if (!ok) return
        }
      }
    }

    const payload = { ...form, amount, exchangeRate: rate > 0 ? rate : '', usdAmount }
    if (editId) {
      updatePayment(editId, payload)
      showToast('پرداخت بروزرسانی شد', 'success')
    } else {
      // شماره فیش را سرور می‌سازد (پشت‌سرهم و بدون تکرار حتی با چند کاربر همزمان)
      addPayment({ ...payload, receiptNumber: '' })
      showToast('پرداخت جدید ثبت شد', 'success')
    }
    setModalOpen(false)
  }

  function handleDelete() {
    deletePayment(confirmId)
    showToast('پرداخت حذف شد', 'success')
  }

  async function handlePrint(p) {
    const b = balanceOf(p.pilgrimId)
    try {
      await exportReceiptToPDF(p, settings, b && b.remaining > 0.005 ? b.remaining : undefined, b?.currency)
    } catch {
      showToast('خطا در تولید رسید', 'error')
    }
  }

  // زائران قابل انتخاب: لغوشده‌ها برای فیش جدید نمی‌آیند (به‌جز زائرِ همین فیش هنگام ویرایش)
  const selectablePilgrims = pilgrims.filter((p) => p.status !== 'لغو شده' || p.id === form.pilgrimId)
  const orphanName = editId && !form.pilgrimId && form.pilgrimName ? form.pilgrimName : ''

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={<FiDollarSign />} label="مجموع دریافتی (دالر)" value={formatCurrency(totals.total.usd, 'دالر')} color="#0F5132" />
        <StatCard icon={<FiDollarSign />} label="مجموع دریافتی (افغانی)" value={formatCurrency(totals.total.afn, 'افغانی')} color="#1d8a4e" />
        <StatCard icon={<FiCalendar />} label="دریافتی امروز (دالر)" value={formatCurrency(totals.todayTotal.usd, 'دالر')} color="#D4AF37" />
        <StatCard icon={<FiCalendar />} label="دریافتی امروز (افغانی)" value={formatCurrency(totals.todayTotal.afn, 'افغانی')} color="#b8860b" />
        <StatCard icon={<FiTrendingDown />} label="باقی مانده حساب‌ها (دالر)" value={formatCurrency(totals.remaining.usd, 'دالر')} color="#c0392b" />
        <StatCard icon={<FiTrendingDown />} label="باقی مانده حساب‌ها (افغانی)" value={formatCurrency(totals.remaining.afn, 'افغانی')} color="#a93226" />
        {can('payments', 'create') && (
          <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => openAdd()}><FiPlus /> پرداخت جدید</button>
          </div>
        )}
        {totals.pendingCount > 0 && (
          <StatCard icon={<FiClock />} label="پرداخت‌های در انتظار تایید" value={`${toPersianDigits(totals.pendingCount)} مورد`} color="#8a6508" />
        )}
      </div>

      {totals.pendingCount > 0 && (
        <div className="text-muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
          پرداخت‌های با وضعیت «در انتظار» هنوز دریافت نشده‌اند؛ در مجموع‌ها و باقی‌مانده‌ی حساب زائران حساب نمی‌شوند.
        </div>
      )}

      {missingRate.length > 0 && (
        <div className="ai-insight warn" style={{ marginBottom: 18 }}>
          <span className="ai-insight-icon"><FiAlertTriangle /></span>
          <div>
            <div className="fw-bold" style={{ fontSize: 13.5 }}>نرخ برابری ثبت نشده</div>
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.8 }}>
              برای {toPersianDigits(missingRate.length)} زائر پرداخت به ارزی غیر از ارز بسته ثبت شده، اما هیچ نرخ برابری‌ای در سیستم نیست.
              تا نرخ ثبت نشود، این مبلغ‌ها از باقی‌مانده‌ی حساب‌ها کم نمی‌شوند و باقی‌مانده بیشتر از واقعیت نشان داده می‌شود
              ({missingRate.slice(0, 3).map((b) => `${b.pilgrim.fullName} ${b.pilgrim.lastName}`).join('، ')}{missingRate.length > 3 ? ' و …' : ''}).
              یکی از آن فیش‌ها را ویرایش کنید و نرخ را وارد کنید.
            </div>
          </div>
        </div>
      )}

      {/* ─── جدول بدهکاران ─── */}
      {debtors.length > 0 && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-header">
            <h3 style={{ color: 'var(--danger)' }}>بدهکاران — باقی مانده حساب ({toPersianDigits(debtors.length)} نفر)</h3>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>نام زائر</th>
                  <th>قیمت بسته</th>
                  <th>پرداخت شده</th>
                  <th>باقی مانده</th>
                  <th>تعداد پرداخت</th>
                  {can('payments', 'create') && <th>عملیات</th>}
                </tr>
              </thead>
              <tbody>
                {shownDebtors.map((d) => (
                  <tr key={d.pilgrim.id}>
                    <td>{d.pilgrim.fullName} {d.pilgrim.lastName}</td>
                    <td>{formatCurrency(d.price, d.currency)}</td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(d.paid, d.currency)}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatCurrency(d.remaining, d.currency)}</td>
                    <td>{toPersianDigits(d.paymentCount)}</td>
                    {can('payments', 'create') && (
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => openAdd(d.pilgrim)}><FiPlus /> ثبت پرداخت</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {debtors.length > DEBTORS_PREVIEW && (
            <div style={{ padding: '10px 20px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAllDebtors((v) => !v)}>
                {showAllDebtors ? 'نمایش کمتر' : `نمایش همه (${toPersianDigits(debtors.length)} نفر)`}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>فهرست پرداخت‌ها ({toPersianDigits(dateFiltered.length)})</h3>
          <div className="toolbar">
            <div className="search-box">
              <FiSearch />
              <input placeholder="جستجو بر اساس شماره فیش یا نام زائر..." value={table.search} onChange={(e) => table.setSearch(e.target.value)} />
            </div>
            <input type="date" className="date-input" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); table.setPage(1) }} title="از تاریخ" placeholder="از تاریخ" />
            <input type="date" className="date-input" value={dateTo} onChange={(e) => { setDateTo(e.target.value); table.setPage(1) }} title="تا تاریخ" placeholder="تا تاریخ" />
            <select className="select-input" value={table.filters.status || 'all'} onChange={(e) => table.setFilter('status', e.target.value)}>
              <option value="all">همه وضعیت‌ها</option>
              <option value="پرداخت شده">پرداخت شده</option>
              <option value="در انتظار">در انتظار</option>
            </select>
          </div>
        </div>

        {dateFiltered.length === 0 ? (
          <EmptyState title="پرداختی یافت نشد" />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>شماره فیش</th>
                  <th>زائر</th>
                  <th>مبلغ</th>
                  <th>نوع پرداخت</th>
                  <th>تاریخ</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {dateFiltered.slice((page - 1) * table.pageSize, page * table.pageSize).map((p) => (
                  <tr key={p.id}>
                    <td>{p.receiptNumber || '…'}</td>
                    <td>{p.pilgrimName}</td>
                    <td className="fw-bold">
                      {formatCurrency(p.amount, p.currency)}
                      {Number(p.exchangeRate) > 0 && (
                        <div className="text-muted" style={{ fontSize: 11, fontWeight: 400 }}>
                          نرخ: {toPersianDigits(Number(p.exchangeRate))}
                        </div>
                      )}
                    </td>
                    <td><span className="badge badge-primary">{p.paymentType}</span></td>
                    <td>{formatJalali(p.date)}</td>
                    <td><span className={`badge ${p.status === 'پرداخت شده' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="print-btn" onClick={() => handlePrint(p)} title="چاپ فیش / PDF"><FiPrinter /></button>
                        {can('payments', 'edit') && <button className="edit-btn" onClick={() => openEdit(p)} title="ویرایش"><FiEdit2 /></button>}
                        {can('payments', 'delete') && <button className="delete-btn" onClick={() => setConfirmId(p.id)} title="حذف"><FiTrash2 /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={table.setPage} totalItems={dateFiltered.length} pageSize={table.pageSize} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'ویرایش پرداخت' : 'ثبت پرداخت جدید'}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>انصراف</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? 'ذخیره تغییرات' : 'ثبت پرداخت'}</button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره فیش</label>
              <input className="text-input" value={form.receiptNumber || 'خودکار (بعد از ثبت)'} disabled />
            </div>
            <div className="form-field">
              <label>زائر</label>
              <input
                className="text-input"
                list="pilgrim-options"
                value={pilgrimText}
                onChange={(e) => handlePilgrimInput(e.target.value)}
                placeholder={orphanName ? `${orphanName} (زائر حذف شده)` : 'نام زائر را بنویسید یا از لیست انتخاب کنید...'}
                autoComplete="off"
              />
              <datalist id="pilgrim-options">
                {selectablePilgrims.map((p) => <option key={p.id} value={pilgrimLabel(p)} />)}
              </datalist>
              {errors.pilgrimId && <span className="error-text">{errors.pilgrimId}</span>}
              {selectedPilgrimDetails && (selectedPilgrimDetails.packagePrice || selectedPilgrimDetails.stayDuration) && (
                <div className="pilgrim-package-info">
                  {selectedPilgrimDetails.packagePrice && (
                    <span>قیمت بسته: <strong>{formatCurrency(selectedPilgrimDetails.packagePrice, selectedPilgrimDetails.currency || 'افغانی')}</strong></span>
                  )}
                  {selectedPilgrimDetails.stayDuration && (
                    <span>مدت اقامت: <strong>{toPersianDigits(selectedPilgrimDetails.stayDuration)} روز</strong></span>
                  )}
                  {(() => {
                    const b = balanceOf(selectedPilgrimDetails.id)
                    if (!b) return null
                    return (
                      <span>باقی مانده: <strong style={{ color: b.remaining > 0.005 ? '#c0392b' : '#0F5132' }}>{formatCurrency(Math.max(0, b.remaining), b.currency)}</strong></span>
                    )
                  })()}
                </div>
              )}
            </div>
            <div className="form-field">
              <label>مبلغ</label>
              <div className="input-with-currency">
                <input type="number" min="0" step="any" className="text-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="مبلغ پرداختی" />
                <select className="currency-select" value={form.currency} onChange={(e) => handleCurrencyChange(e.target.value)}>
                  <option value="افغانی">افغانی</option>
                  <option value="دالر">دالر</option>
                </select>
              </div>
              {errors.amount && <span className="error-text">{errors.amount}</span>}
              {needsRate && (
                <div style={{ marginTop: 6 }}>
                  <label style={{ fontSize: 11.5, color: '#667085' }}>
                    نرخ برابری دالر (هر 1 دالر = ? افغانی){crossNow ? ' — الزامی' : ' — اختیاری'}
                  </label>
                  <input type="number" min="0" step="any" className="text-input" style={{ marginTop: 4 }} placeholder="مثال: 70 (نرخ برابری)" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} />
                  {errors.exchangeRate && <span className="error-text">{errors.exchangeRate}</span>}
                  {Number(form.exchangeRate) > 0 && Number(form.amount) > 0 && (
                    <div style={{ fontSize: 11.5, color: '#166534', marginTop: 4 }}>
                      {form.currency === 'افغانی'
                        ? <>معادل: <strong>{toPersianDigits((Number(form.amount) / Number(form.exchangeRate)).toLocaleString('en-US', { maximumFractionDigits: 2 }))} دالر</strong></>
                        : <>معادل: <strong>{toPersianDigits((Number(form.amount) * Number(form.exchangeRate)).toLocaleString('en-US', { maximumFractionDigits: 2 }))} افغانی</strong></>}
                    </div>
                  )}
                  {fallbackRate > 0 && String(fallbackRate) === String(form.exchangeRate) && (
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>آخرین نرخ ثبت‌شده در سیستم؛ اگر امروز فرق دارد تغییرش دهید.</div>
                  )}
                  {crossNow && !(fallbackRate > 0) && !(Number(form.exchangeRate) > 0) && (
                    <div style={{ fontSize: 11, marginTop: 2, color: '#c0392b' }}>هنوز هیچ نرخی در سیستم ثبت نشده؛ نرخ امروز را وارد کنید.</div>
                  )}
                </div>
              )}
            </div>
            <div className="form-field">
              <label>نوع پرداخت</label>
              <select className="select-input" value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })}>
                <option value="نقدی">نقدی</option>
                <option value="بانکی">بانکی</option>
                <option value="حواله">حواله</option>
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ</label>
              <input type="date" className="date-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              {errors.date && <span className="error-text">{errors.date}</span>}
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <select className="select-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="پرداخت شده">پرداخت شده</option>
                <option value="در انتظار">در انتظار (هنوز دریافت نشده)</option>
              </select>
            </div>
            <div className="form-field full">
              <label>توضیحات</label>
              <input className="text-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیحات پرداخت..." />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={handleDelete} title="حذف پرداخت" message="آیا از حذف این پرداخت اطمینان دارید؟" />
    </div>
  )
}
