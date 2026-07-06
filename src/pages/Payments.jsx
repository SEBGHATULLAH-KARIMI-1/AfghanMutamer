import { useMemo, useState } from 'react'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiPrinter, FiDollarSign, FiCalendar, FiTrendingDown,
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
import { formatCurrency, formatJalali, todayISO, toPersianDigits } from '../utils/dateUtils'

const EMPTY_FORM = {
  receiptNumber: '', pilgrimId: '', pilgrimName: '', amount: '', paymentType: 'نقدی',
  date: todayISO(), description: '', status: 'پرداخت شده', currency: 'افغانی',
  exchangeRate: '', usdAmount: '',
}

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
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [confirmId, setConfirmId] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedPilgrimDetails, setSelectedPilgrimDetails] = useState(null)

  const dateFiltered = useMemo(() => {
    let list = table.filtered
    if (dateFrom) list = list.filter((p) => p.date >= dateFrom)
    if (dateTo) list = list.filter((p) => p.date <= dateTo)
    return list
  }, [table.filtered, dateFrom, dateTo])

  const displayCur = settings.displayCurrency || 'دالر'
  const totalPayments = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const todayTotal = payments.filter((p) => p.date === todayISO()).reduce((s, p) => s + Number(p.amount || 0), 0)
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

  // ─── بدهکاران: زائرانی که باقی حساب دارند ───
  const debtors = useMemo(() => {
    return pilgrims
      .filter((p) => Number(p.packagePrice || 0) > 0)
      .map((p) => {
        const pPayments = payments.filter((pm) => pm.pilgrimId === p.id)
        const totalPaid = pPayments.reduce((s, pm) => s + Number(pm.amount || 0), 0)
        const remaining = Number(p.packagePrice) - totalPaid
        return { ...p, totalPaid, remaining, paymentCount: pPayments.length }
      })
      .filter((p) => p.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)
  }, [pilgrims, payments])

  function openAdd() {
    setForm({ ...EMPTY_FORM, receiptNumber: 'RC-' + Math.floor(10000 + Math.random() * 89999) })
    setEditId(null)
    setErrors({})
    setSelectedPilgrimDetails(null)
    setModalOpen(true)
  }

  function openEdit(p) {
    setForm(p)
    setEditId(p.id)
    setErrors({})
    const pilgrim = pilgrims.find((x) => x.id === p.pilgrimId)
    setSelectedPilgrimDetails(pilgrim || null)
    setModalOpen(true)
  }

  function validate() {
    const errs = {}
    if (!form.pilgrimId) errs.pilgrimId = 'انتخاب زائر الزامی است'
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'مبلغ معتبر وارد کنید'
    if (!form.date) errs.date = 'تاریخ الزامی است'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handlePilgrimChange(id) {
    const p = pilgrims.find((x) => x.id === id)
    setForm((f) => ({ ...f, pilgrimId: id, pilgrimName: p ? `${p.fullName} ${p.lastName}` : '' }))
    setSelectedPilgrimDetails(p || null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const usdAmount = form.currency === 'دالر'
      ? Number(form.amount || 0)
      : Number(form.amount || 0) / (Number(form.exchangeRate) || 1)
    const payload = { ...form, usdAmount }
    if (editId) {
      updatePayment(editId, payload)
      showToast('پرداخت بروزرسانی شد', 'success')
    } else {
      addPayment(payload)
      showToast('پرداخت جدید ثبت شد', 'success')
    }
    setModalOpen(false)
  }

  function handleDelete() {
    deletePayment(confirmId)
    showToast('پرداخت حذف شد', 'error')
  }

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={<FiDollarSign />} label={`مجموع پرداخت‌ها (${displayCur})`} value={formatCurrency(totalPayments, displayCur)} color="#0F5132" />
        <StatCard icon={<FiCalendar />} label={`پرداخت‌های امروز (${displayCur})`} value={formatCurrency(todayTotal, displayCur)} color="#D4AF37" />
        <StatCard icon={<FiTrendingDown />} label={`باقی مانده حساب‌ها (${displayCur})`} value={formatCurrency(remainingBalance, displayCur)} color="#c0392b" />
      </div>


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
                </tr>
              </thead>
              <tbody>
                {debtors.map((d) => (
                  <tr key={d.id}>
                    <td>{d.fullName} {d.lastName}</td>
                    <td>{Number(d.packagePrice).toLocaleString()} {d.currency || 'افغانی'}</td>
                    <td style={{ color: 'var(--success)' }}>{d.totalPaid.toLocaleString()} {d.currency || 'افغانی'}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{d.remaining.toLocaleString()} {d.currency || 'افغانی'}</td>
                    <td>{toPersianDigits(d.paymentCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <input type="date" className="date-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="از تاریخ" placeholder="از تاریخ" />
            <input type="date" className="date-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="تا تاریخ" placeholder="تا تاریخ" />
            <select className="select-input" onChange={(e) => table.setFilter('status', e.target.value)}>
              <option value="all">همه وضعیت‌ها</option>
              <option value="پرداخت شده">پرداخت شده</option>
              <option value="در انتظار">در انتظار</option>
            </select>
            {can('payments', 'create') && <button className="btn btn-primary" onClick={openAdd}><FiPlus /> ثبت پرداخت</button>}
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
                {dateFiltered.slice((table.page - 1) * table.pageSize, table.page * table.pageSize).map((p) => (
                  <tr key={p.id}>
                    <td>{p.receiptNumber}</td>
                    <td>{p.pilgrimName}</td>
                    <td className="fw-bold">{formatCurrency(p.amount, p.currency)}</td>
                    <td><span className="badge badge-primary">{p.paymentType}</span></td>
                    <td>{formatJalali(p.date)}</td>
                    <td><span className={`badge ${p.status === 'پرداخت شده' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="print-btn" onClick={() => {
                          const pilgrim = pilgrims.find((x) => x.id === p.pilgrimId)
                          const pilgrimPayments = payments.filter((pm) => pm.pilgrimId === p.pilgrimId)
                          const totalPaid = pilgrimPayments.reduce((s, pm) => s + Number(pm.amount || 0), 0)
                          const remaining = pilgrim ? Number(pilgrim.packagePrice || 0) - totalPaid : 0
                          exportReceiptToPDF(p, settings, remaining > 0 ? remaining : undefined)
                        }} title="چاپ فیش / PDF"><FiPrinter /></button>
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
        <Pagination page={table.page} totalPages={Math.max(1, Math.ceil(dateFiltered.length / table.pageSize))} onChange={table.setPage} totalItems={dateFiltered.length} pageSize={table.pageSize} />
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
              <input className="text-input" value={form.receiptNumber} disabled />
            </div>
            <div className="form-field">
              <label>زائر</label>
              <select className="select-input" value={form.pilgrimId} onChange={(e) => handlePilgrimChange(e.target.value)}>
                <option value="">انتخاب زائر...</option>
                {pilgrims.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} {p.lastName}</option>
                ))}
              </select>
              {errors.pilgrimId && <span className="error-text">{errors.pilgrimId}</span>}
              {selectedPilgrimDetails && (selectedPilgrimDetails.packagePrice || selectedPilgrimDetails.stayDuration) && (
                <div className="pilgrim-package-info">
                  {selectedPilgrimDetails.packagePrice && (
                    <span>قیمت بسته: <strong>{Number(selectedPilgrimDetails.packagePrice).toLocaleString()} {selectedPilgrimDetails.currency || 'افغانی'}</strong></span>
                  )}
                  {selectedPilgrimDetails.stayDuration && (
                    <span>مدت اقامت: <strong>{selectedPilgrimDetails.stayDuration} روز</strong></span>
                  )}
                  {(() => {
                    const pilgrimPayments = payments.filter((pm) => pm.pilgrimId === selectedPilgrimDetails.id)
                    const totalPaid = pilgrimPayments.reduce((s, pm) => s + Number(pm.amount || 0), 0)
                    const remaining = Number(selectedPilgrimDetails.packagePrice || 0) - totalPaid
                    if (!selectedPilgrimDetails.packagePrice) return null
                    return (
                      <span>باقی مانده: <strong style={{ color: remaining > 0 ? '#c0392b' : '#0F5132' }}>{remaining > 0 ? Number(remaining).toLocaleString() : 0} {selectedPilgrimDetails.currency || 'افغانی'}</strong></span>
                    )
                  })()}
                </div>
              )}
            </div>
            <div className="form-field">
              <label>مبلغ</label>
              <div className="input-with-currency">
                <input type="number" className="text-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="مبلغ پرداختی" />
                <select className="currency-select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value, exchangeRate: '' })}>
                  <option value="افغانی">افغانی</option>
                  <option value="دالر">دالر</option>
                </select>
              </div>
              {errors.amount && <span className="error-text">{errors.amount}</span>}
              {form.currency === 'افغانی' && (
                <div style={{ marginTop: 6 }}>
                  <label style={{ fontSize: 11.5, color: '#667085' }}>نرخ برابری دالر (هر 1 دالر = ? افغانی)</label>
                  <input type="number" className="text-input" style={{ marginTop: 4 }} placeholder="مثال: 70 (نرخ برابری)" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} />
                  {form.exchangeRate && form.amount && (
                    <div style={{ fontSize: 11.5, color: '#166534', marginTop: 4 }}>
                      معادل: <strong>{(Number(form.amount) / Number(form.exchangeRate)).toLocaleString()} دالر</strong>
                    </div>
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
                <option value="در انتظار">در انتظار</option>
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
