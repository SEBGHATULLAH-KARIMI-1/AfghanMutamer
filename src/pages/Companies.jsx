import { useState, useMemo, useEffect } from 'react'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiBriefcase, FiPhone, FiMail, FiMapPin, FiUser, FiDollarSign, FiDownload, FiFileText, FiShare2, FiArrowRight, FiInfo, FiList, FiCreditCard, FiPrinter, FiUpload,
} from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/common/Modal'
import ConfirmModal from '../components/common/ConfirmModal'
import EmptyState from '../components/common/EmptyState'
import Pagination from '../components/common/Pagination'
import StatCard from '../components/common/StatCard'
import { formatCurrency, formatJalali, todayISO, toPersianDigits } from '../utils/dateUtils'
import { exportToExcel } from '../utils/excelExport'
import { exportTableToPDF, previewPdfBlob, exportReceiptToPDF } from '../utils/pdfExport'
import { useTableState, normalize } from '../utils/useTableState'
import { pilgrimBalances, latestRate, currencyKey, nextReceiptNumber, isCrossCurrency } from '../utils/finance'
import { compressImage } from '../utils/image'

const EMPTY_FORM = {
  name: '', phone: '', address: '', email: '', contactPerson: '',
}

const EMPTY_PILGRIM = {
  fullName: '', lastName: '', phone: '', passportNumber: '', travelType: 'عمره',
  packagePrice: '', currency: 'افغانی', finalPrice: '', stayDuration: '', status: 'در انتظار', photo: '',
}

const EMPTY_PAYMENT = {
  receiptNumber: '', pilgrimId: '', pilgrimName: '', amount: '', paymentType: 'نقدی',
  date: '', description: '', status: 'پرداخت شده', currency: 'افغانی', exchangeRate: '', usdAmount: '',
}

const COMPANY_TABS = [
  { key: 'info', label: 'اطلاعات شرکت', icon: <FiInfo /> },
  { key: 'pilgrims', label: 'زائران', icon: <FiList />, perm: 'pilgrims' },
  { key: 'payments', label: 'پرداخت‌ها', icon: <FiCreditCard />, perm: 'payments' },
  { key: 'receipts', label: 'رسیدها', icon: <FiPrinter />, perm: 'payments' },
]

function RemainingBadges({ remaining }) {
  const items = [['usd', 'دالر'], ['afn', 'افغانی']].filter(([k]) => remaining[k] > 0.005)
  if (items.length === 0) return <span className="badge badge-success">تسویه</span>
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map(([k, c]) => <span key={k} className="badge badge-danger">{formatCurrency(remaining[k], c)}</span>)}
    </div>
  )
}

export default function Companies() {
  const { companies, addCompany, updateCompany, deleteCompany, pilgrims, payments, settings, addPilgrim, updatePilgrim, deletePilgrim, addPayment } = useData()
  const { showToast } = useToast()
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmId, setConfirmId] = useState(null)
  const [viewCompanyId, setViewCompanyId] = useState(null)
  const [companyTab, setCompanyTab] = useState('info')

  // شرکتِ در حال مشاهده همیشه از لیست زنده خوانده می‌شود تا بعد از ویرایش، اطلاعات قدیمی نماند
  const viewCompany = viewCompanyId ? companies.find((c) => c.id === viewCompanyId) || null : null

  const balances = useMemo(() => pilgrimBalances(pilgrims, payments), [pilgrims, payments])

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    if (!q) return companies
    return companies.filter((c) =>
      [c.name, c.phone, c.contactPerson].map(normalize).join(' ').includes(q)
    )
  }, [companies, search])

  const visibleTabs = COMPANY_TABS.filter((t) => !t.perm || can(t.perm))

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(c) {
    setForm({ ...EMPTY_FORM, ...c })
    setEditId(c.id)
    setModalOpen(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) { showToast('نام شرکت الزامی است', 'error'); return }
    if (companies.some((c) => c.id !== editId && String(c.name || '').trim().toLowerCase() === name.toLowerCase())) {
      showToast('شرکتی با این نام قبلاً ثبت شده است', 'error'); return
    }
    if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 7) {
      showToast('شماره تماس معتبر نیست', 'error'); return
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      showToast('ایمیل معتبر نیست', 'error'); return
    }
    if (editId) {
      updateCompany(editId, form)
      showToast('شرکت بروزرسانی شد', 'success')
    } else {
      addCompany(form)
      showToast('شرکت جدید اضافه شد', 'success')
    }
    setModalOpen(false)
  }

  function companyPilgrims(companyId) {
    return pilgrims.filter((p) => p.companyId === companyId)
  }

  function companyPayments(companyId) {
    const ids = new Set(companyPilgrims(companyId).map((p) => p.id))
    return payments.filter((pm) => ids.has(pm.pilgrimId))
  }

  // حذف شرکت: زائران حذف نمی‌شوند، فقط از شرکت جدا می‌شوند
  function handleDelete() {
    companyPilgrims(confirmId).forEach((p) => updatePilgrim(p.id, { companyId: '' }))
    deleteCompany(confirmId)
    showToast('شرکت حذف شد', 'error')
  }

  function enterCompany(c) {
    setViewCompanyId(c.id)
    setCompanyTab('info')
  }

  // ─── مالی شرکت (هر ارز جداگانه) ───
  function companyFinancials(companyId) {
    const cp = companyPilgrims(companyId)
    const ids = new Set(cp.map((p) => p.id))
    const packages = { usd: 0, afn: 0 }
    const profit = { usd: 0, afn: 0 }
    const paid = { usd: 0, afn: 0 }
    const remaining = { usd: 0, afn: 0 }

    cp.forEach((p) => {
      if (!(Number(p.packagePrice) > 0) || p.status === 'لغو شده') return
      const k = currencyKey(p.currency)
      packages[k] += Number(p.packagePrice)
      if (Number(p.finalPrice) > 0) profit[k] += Number(p.packagePrice) - Number(p.finalPrice)
    })
    payments.forEach((pm) => {
      if (ids.has(pm.pilgrimId)) paid[currencyKey(pm.currency)] += Number(pm.amount) || 0
    })
    balances.forEach((b) => {
      if (ids.has(b.pilgrim.id) && b.remaining > 0.005) remaining[b.key] += b.remaining
    })
    return { totalPilgrims: cp.length, packages, profit, paid, remaining }
  }

  // ─── خروجی‌ها ───
  async function exportPilgrims(company, format) {
    const cp = companyPilgrims(company.id)
    if (cp.length === 0) { showToast('این شرکت زائری ندارد', 'error'); return }
    const rows = cp.map((p, i) => ({
      ردیف: i + 1,
      نام: p.fullName,
      'نام خانوادگی': p.lastName,
      'نام پدر': p.fatherName || '-',
      'شماره گذرنامه': p.passportNumber,
      تلفن: p.phone,
      'نوع سفر': p.travelType,
      'قیمت بسته': p.packagePrice ? Number(p.packagePrice).toLocaleString() + ' ' + (p.currency || 'افغانی') : '-',
      'مدت اقامت': p.stayDuration || '-',
      وضعیت: p.status,
    }))
    try {
      if (format === 'excel') {
        await exportToExcel({ sheetName: company.name, fileName: `${company.name}-zayeran.xlsx`, rows })
        showToast('خروجی Excel دریافت شد', 'success')
      } else {
        const cols = ['ردیف', 'نام', 'نام خانوادگی', 'نام پدر', 'شماره گذرنامه', 'تلفن', 'نوع سفر', 'قیمت بسته', 'مدت اقامت', 'وضعیت']
        await exportTableToPDF({
          title: `زائران شرکت: ${company.name}`,
          columns: cols,
          rows: rows.map((r) => cols.map((c) => r[c])),
          fileName: `${company.name}-zayeran.pdf`,
        })
        showToast('خروجی PDF دریافت شد', 'success')
      }
    } catch {
      showToast('خطا در تولید فایل خروجی', 'error')
    }
  }

  async function exportPayments(company, format) {
    const cPay = companyPayments(company.id)
    if (cPay.length === 0) { showToast('پرداختی وجود ندارد', 'error'); return }
    try {
      if (format === 'excel') {
        const rows = cPay.map((pm, i) => ({
          ردیف: i + 1,
          'شماره فیش': pm.receiptNumber,
          زائر: pm.pilgrimName,
          مبلغ: Number(pm.amount) || 0,
          ارز: pm.currency || 'افغانی',
          'نوع پرداخت': pm.paymentType,
          تاریخ: formatJalali(pm.date),
          وضعیت: pm.status,
        }))
        await exportToExcel({ sheetName: `${company.name}-payments`, fileName: `${company.name}-payments.xlsx`, rows })
        showToast('خروجی Excel دریافت شد', 'success')
      } else {
        await exportTableToPDF({
          title: `پرداخت‌های شرکت: ${company.name}`,
          columns: ['ردیف', 'شماره فیش', 'زائر', 'مبلغ', 'نوع پرداخت', 'تاریخ', 'وضعیت'],
          rows: cPay.map((pm, i) => [
            i + 1, pm.receiptNumber, pm.pilgrimName, formatCurrency(pm.amount, pm.currency),
            pm.paymentType, formatJalali(pm.date), pm.status,
          ]),
          fileName: `${company.name}-payments.pdf`,
        })
        showToast('خروجی PDF دریافت شد', 'success')
      }
    } catch {
      showToast('خطا در تولید فایل خروجی', 'error')
    }
  }

  async function sharePilgrims(company) {
    const cp = companyPilgrims(company.id)
    if (cp.length === 0) { showToast('این شرکت زائری ندارد', 'error'); return }
    try {
      const cols = ['ردیف', 'نام', 'تلفن']
      const rows = cp.map((p, i) => [i + 1, `${p.fullName} ${p.lastName}`, p.phone])
      const url = await previewPdfBlob({ title: `زائران شرکت: ${company.name}`, columns: cols, rows })
      const resp = await fetch(url)
      const blob = await resp.blob()
      URL.revokeObjectURL(url)
      const file = new File([blob], `${company.name}-zayeran.pdf`, { type: 'application/pdf' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: `زائران ${company.name}` }).catch(() => {})
      } else {
        showToast('مرورگر شما از اشتراک پشتیبانی نمی‌کند', 'error')
      }
    } catch {
      showToast('خطا در آماده‌سازی فایل برای اشتراک', 'error')
    }
  }

  const deleteTarget = confirmId ? companies.find((c) => c.id === confirmId) : null
  const deleteCount = confirmId ? companyPilgrims(confirmId).length : 0

  return (
    <div>
      {viewCompany ? (
        /* ─── جزئیات شرکت با تب‌ها ─── */
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => setViewCompanyId(null)} style={{ marginBottom: 16 }}>
            <FiArrowRight /> برگشت به لیست شرکت‌ها
          </button>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><FiBriefcase /> {viewCompany.name}</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {can('companies', 'edit') && <button className="btn btn-outline btn-sm" onClick={() => openEdit(viewCompany)}><FiEdit2 /> ویرایش</button>}
              </div>
            </div>
            <div className="card-body" style={{ padding: '10px 20px', fontSize: 12.5, color: 'var(--color-text-muted)', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {viewCompany.phone && <span><FiPhone /> {viewCompany.phone}</span>}
              {viewCompany.email && <span><FiMail /> {viewCompany.email}</span>}
              {viewCompany.address && <span><FiMapPin /> {viewCompany.address}</span>}
              {viewCompany.contactPerson && <span><FiUser /> {viewCompany.contactPerson}</span>}
            </div>
          </div>

          <div className="tabs">
            {visibleTabs.map((t) => (
              <button key={t.key} className={companyTab === t.key ? 'active' : ''} onClick={() => setCompanyTab(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {companyTab === 'info' && (
            <CompanyInfo
              company={viewCompany}
              fin={companyFinancials(viewCompany.id)}
              showFinance={can('payments')}
              canExport={can('pilgrims')}
              exportPilgrims={exportPilgrims}
              sharePilgrims={sharePilgrims}
            />
          )}
          {companyTab === 'pilgrims' && (
            <CompanyPilgrims
              company={viewCompany}
              pilgrims={companyPilgrims(viewCompany.id)}
              allPilgrims={pilgrims}
              allPayments={payments}
              can={can}
              exportPilgrims={exportPilgrims}
              sharePilgrims={sharePilgrims}
              addPilgrim={addPilgrim}
              updatePilgrim={updatePilgrim}
              deletePilgrim={deletePilgrim}
            />
          )}
          {companyTab === 'payments' && (
            <CompanyPayments
              company={viewCompany}
              payments={companyPayments(viewCompany.id)}
              allPayments={payments}
              companyPilgrims={companyPilgrims(viewCompany.id)}
              balances={balances}
              can={can}
              exportPayments={exportPayments}
              addPayment={addPayment}
            />
          )}
          {companyTab === 'receipts' && (
            <CompanyReceipts
              company={viewCompany}
              payments={companyPayments(viewCompany.id)}
              allPayments={payments}
              companyPilgrims={companyPilgrims(viewCompany.id)}
              balances={balances}
              settings={settings}
              can={can}
              addPayment={addPayment}
            />
          )}
        </div>
      ) : (
        /* ─── لیست شرکت‌ها ─── */
        <div className="card">
          <div className="card-header">
            <h3><FiBriefcase /> شرکت‌ها ({toPersianDigits(companies.length)})</h3>
            <div className="toolbar">
              <div className="search-box">
                <FiSearch />
                <input placeholder="جستجوی شرکت..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {can('companies', 'create') && <button className="btn btn-primary" onClick={openAdd}><FiPlus /> شرکت جدید</button>}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="شرکتی یافت نشد" description="اولین شرکت را ثبت کنید." action={
              can('companies', 'create') && <button className="btn btn-primary" onClick={openAdd}><FiPlus /> ثبت شرکت</button>
            } />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>نام شرکت</th>
                    <th>تماس</th>
                    <th>شخص رابط</th>
                    <th>زائران</th>
                    {can('payments') && <th>باقی مانده</th>}
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const fin = companyFinancials(c.id)
                    return (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.phone || '-'}</td>
                        <td>{c.contactPerson || '-'}</td>
                        <td><span className="badge badge-info">{toPersianDigits(fin.totalPilgrims)} نفر</span></td>
                        {can('payments') && <td><RemainingBadges remaining={fin.remaining} /></td>}
                        <td>
                          <div className="row-actions">
                            <button className="view-btn" onClick={() => enterCompany(c)} title="ورود به شرکت"><FiArrowRight /></button>
                            {can('companies', 'edit') && <button className="edit-btn" onClick={() => openEdit(c)} title="ویرایش"><FiEdit2 /></button>}
                            {can('companies', 'delete') && <button className="delete-btn" onClick={() => setConfirmId(c.id)} title="حذف"><FiTrash2 /></button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── مودال افزودن/ویرایش شرکت ─── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'ویرایش شرکت' : 'شرکت جدید'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>انصراف</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? 'ذخیره تغییرات' : 'ثبت شرکت'}</button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field full">
              <label>نام شرکت</label>
              <input className="text-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: شرکت خدمات حج الفردوس" />
            </div>
            <div className="form-field">
              <label>شماره تماس</label>
              <input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="مثال: 0700123456" />
            </div>
            <div className="form-field">
              <label>ایمیل</label>
              <input type="email" className="text-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="مثال: info@company.com" />
            </div>
            <div className="form-field full">
              <label>آدرس</label>
              <input className="text-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="مثال: کابل، افغانستان" />
            </div>
            <div className="form-field">
              <label>شخص رابط</label>
              <input className="text-input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="مثال: احمد محمدی" />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="حذف شرکت"
        message={
          deleteCount > 0
            ? `${toPersianDigits(deleteCount)} زائر به شرکت «${deleteTarget?.name || ''}» وابسته است. با حذف شرکت، این زائران حذف نمی‌شوند ولی بدون شرکت می‌مانند. ادامه می‌دهید؟`
            : 'آیا از حذف این شرکت اطمینان دارید؟'
        }
      />
    </div>
  )
}

// ─── تب اطلاعات شرکت ───
function CompanyInfo({ company, fin, showFinance, canExport, exportPilgrims, sharePilgrims }) {
  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={<FiUser />} label="تعداد زائران" value={toPersianDigits(fin.totalPilgrims)} color="var(--color-primary)" />
        {showFinance && (
          <>
            <StatCard icon={<FiDollarSign />} label="مفاد (دالر)" value={formatCurrency(fin.profit.usd, 'دالر')} color="#D4AF37" />
            <StatCard icon={<FiDollarSign />} label="مفاد (افغانی)" value={formatCurrency(fin.profit.afn, 'افغانی')} color="#b8860b" />
            <StatCard icon={<FiDollarSign />} label="مجموع پرداخت‌ها (دالر)" value={formatCurrency(fin.paid.usd, 'دالر')} color="var(--success)" />
            <StatCard icon={<FiDollarSign />} label="مجموع پرداخت‌ها (افغانی)" value={formatCurrency(fin.paid.afn, 'افغانی')} color="#1d8a4e" />
            <StatCard icon={<FiDollarSign />} label="باقی مانده (دالر)" value={formatCurrency(fin.remaining.usd, 'دالر')} color={fin.remaining.usd > 0.005 ? 'var(--danger)' : 'var(--success)'} />
            <StatCard icon={<FiDollarSign />} label="باقی مانده (افغانی)" value={formatCurrency(fin.remaining.afn, 'افغانی')} color={fin.remaining.afn > 0.005 ? 'var(--danger)' : 'var(--success)'} />
          </>
        )}
      </div>
      {canExport && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => exportPilgrims(company, 'pdf')}><FiFileText /> خروجی PDF زائران</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportPilgrims(company, 'excel')}><FiDownload /> خروجی Excel زائران</button>
          <button className="btn btn-outline btn-sm" onClick={() => sharePilgrims(company)}><FiShare2 /> اشتراک زائران</button>
        </div>
      )}
    </div>
  )
}

// ─── تب زائران شرکت ───
function CompanyPilgrims({ company, pilgrims: cp, allPilgrims, allPayments, can, exportPilgrims, sharePilgrims, addPilgrim, updatePilgrim, deletePilgrim }) {
  const { showToast } = useToast()
  const table = useTableState(cp, { searchFields: ['fullName', 'lastName', 'phone', 'passportNumber'], pageSize: 8 })
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_PILGRIM)
  const [errors, setErrors] = useState({})
  const [editId, setEditId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const photo = await compressImage(file)
      setForm((f) => ({ ...f, photo }))
    } catch {
      showToast('فایل عکس معتبر نیست', 'error')
    }
  }

  function openAdd() {
    setForm({ ...EMPTY_PILGRIM })
    setErrors({})
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(p) {
    setForm({ ...EMPTY_PILGRIM, ...p })
    setErrors({})
    setEditId(p.id)
    setModalOpen(true)
  }

  function validate() {
    const errs = {}
    if (!form.fullName.trim()) errs.fullName = 'نام الزامی است'
    if (!form.lastName.trim()) errs.lastName = 'نام خانوادگی الزامی است'
    if (!String(form.phone || '').trim()) errs.phone = 'شماره تماس الزامی است'
    else if (String(form.phone).replace(/\D/g, '').length < 7) errs.phone = 'شماره تماس معتبر نیست'
    const pp = String(form.passportNumber || '').trim().toUpperCase()
    if (!pp) errs.passportNumber = 'شماره گذرنامه الزامی است'
    else if (allPilgrims.some((p) => p.id !== editId && String(p.passportNumber || '').trim().toUpperCase() === pp)) {
      errs.passportNumber = 'این شماره گذرنامه قبلاً ثبت شده است'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    if (editId) {
      updatePilgrim(editId, form)
      showToast('اطلاعات زائر بروزرسانی شد', 'success')
    } else {
      addPilgrim({ ...form, companyId: company.id, createdAt: todayISO() })
      showToast('زائر جدید اضافه شد', 'success')
    }
    setModalOpen(false)
  }

  function handleDelete() {
    deletePilgrim(confirmDeleteId)
    setConfirmDeleteId(null)
    showToast('زائر حذف شد', 'error')
  }

  const delPayCount = confirmDeleteId ? allPayments.filter((p) => p.pilgrimId === confirmDeleteId).length : 0

  return (
    <div className="card">
      <div className="card-header">
        <h3>زائران شرکت ({toPersianDigits(cp.length)})</h3>
        <div className="toolbar">
          <div className="search-box">
            <FiSearch />
            <input placeholder="جستجوی زائر..." value={table.search} onChange={(e) => table.setSearch(e.target.value)} />
          </div>
          {can('pilgrims', 'create') && <button className="btn btn-primary btn-sm" onClick={openAdd}><FiPlus /> زائر جدید</button>}
          <button className="btn btn-outline btn-sm" onClick={() => exportPilgrims(company, 'pdf')}><FiFileText /> PDF</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportPilgrims(company, 'excel')}><FiDownload /> Excel</button>
          <button className="btn btn-outline btn-sm" onClick={() => sharePilgrims(company)}><FiShare2 /> اشتراک</button>
        </div>
      </div>
      {table.paginated.length === 0 ? (
        <EmptyState title="زائری یافت نشد" description="این شرکت هنوز زائری ندارد" />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>نام</th>
                <th>تلفن</th>
                <th>نوع سفر</th>
                <th>قیمت بسته</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {table.paginated.map((p) => (
                <tr key={p.id}>
                  <td>{p.fullName} {p.lastName}</td>
                  <td>{p.phone}</td>
                  <td><span className="badge badge-info">{p.travelType}</span></td>
                  <td>{p.packagePrice ? formatCurrency(p.packagePrice, p.currency || 'افغانی') : '-'}</td>
                  <td><span className={`badge ${p.status === 'تایید شده' ? 'badge-success' : p.status === 'لغو شده' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span></td>
                  <td>
                    <div className="row-actions">
                      {can('pilgrims', 'edit') && <button className="edit-btn" onClick={() => openEdit(p)} title="ویرایش"><FiEdit2 /></button>}
                      {can('pilgrims', 'delete') && <button className="delete-btn" onClick={() => setConfirmDeleteId(p.id)} title="حذف"><FiTrash2 /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={table.page} totalPages={table.totalPages} onChange={table.setPage} totalItems={table.totalItems} pageSize={table.pageSize} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'ویرایش زائر' : 'افزودن زائر جدید'} footer={
        <><button className="btn btn-outline" onClick={() => setModalOpen(false)}>انصراف</button><button className="btn btn-primary" onClick={handleSubmit}>{editId ? 'ذخیره تغییرات' : 'ثبت زائر'}</button></>
      }>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <div className="profile-photo">
              {form.photo ? <img src={form.photo} alt="" /> : <FiUser />}
            </div>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              <FiUpload /> آپلود عکس
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            </label>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>نام</label>
              <input className="text-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="نام" />
              {errors.fullName && <span className="error-text">{errors.fullName}</span>}
            </div>
            <div className="form-field">
              <label>نام خانوادگی</label>
              <input className="text-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="نام خانوادگی" />
              {errors.lastName && <span className="error-text">{errors.lastName}</span>}
            </div>
            <div className="form-field">
              <label>شماره تماس</label>
              <input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="مثال: 0700123456" />
              {errors.phone && <span className="error-text">{errors.phone}</span>}
            </div>
            <div className="form-field">
              <label>شماره گذرنامه</label>
              <input className="text-input" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} placeholder="شماره گذرنامه" />
              {errors.passportNumber && <span className="error-text">{errors.passportNumber}</span>}
            </div>
            <div className="form-field">
              <label>نوع سفر</label>
              <select className="select-input" value={form.travelType} onChange={(e) => setForm({ ...form, travelType: e.target.value })}>
                {[...new Set(['عمره', 'حج', 'سیاحتی', form.travelType].filter(Boolean))].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>مدت اقامت (روز)</label>
              <input type="number" className="text-input" value={form.stayDuration} onChange={(e) => setForm({ ...form, stayDuration: e.target.value })} placeholder="مثال: 21" />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <select className="select-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>در انتظار</option><option>تایید شده</option><option>لغو شده</option>
              </select>
            </div>
            <div className="form-field">
              <label>قیمت بسته</label>
              <div className="input-with-currency">
                <input type="number" className="text-input" value={form.packagePrice} onChange={(e) => setForm({ ...form, packagePrice: e.target.value })} placeholder="قیمت بسته" />
                <select className="currency-select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="افغانی">افغانی</option><option value="دالر">دالر</option>
                </select>
              </div>
            </div>
            <div className="form-field">
              <label>قیمت تمام شده</label>
              <input type="number" className="text-input" value={form.finalPrice} onChange={(e) => setForm({ ...form, finalPrice: e.target.value })} placeholder="قیمت تمام شده (هم‌ارز با ارز بسته)" />
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="حذف زائر"
        message={
          delPayCount > 0
            ? `این زائر ${toPersianDigits(delPayCount)} پرداخت ثبت‌شده دارد که پس از حذف زائر در سیستم باقی می‌ماند. آیا از حذف اطمینان دارید؟`
            : 'آیا از حذف این زائر اطمینان دارید؟'
        }
      />
    </div>
  )
}

// ─── مودال ثبت پرداخت (مشترک بین تب پرداخت‌ها و تب رسیدها) ───
function CompanyPaymentModal({ open, onClose, title, companyPilgrims, allPayments, balances, addPayment }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY_PAYMENT)
  const [errors, setErrors] = useState({})
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_PAYMENT, date: todayISO(), receiptNumber: nextReceiptNumber(allPayments) })
      setErrors({})
      setSelected(null)
    }
    // فقط هنگام باز شدن مودال، فرم از نو ساخته می‌شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fallbackRate = useMemo(() => latestRate(allPayments), [allPayments])
  const needsRate = form.currency === 'افغانی' || isCrossCurrency(selected, form.currency)

  function handlePilgrimChange(id) {
    const p = companyPilgrims.find((x) => x.id === id)
    setForm((f) => ({ ...f, pilgrimId: id, pilgrimName: p ? `${p.fullName} ${p.lastName}` : '' }))
    setSelected(p || null)
  }

  function validate() {
    const errs = {}
    if (!form.pilgrimId) errs.pilgrimId = 'انتخاب زائر الزامی است'
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'مبلغ معتبر وارد کنید'
    if (!form.date) errs.date = 'تاریخ الزامی است'
    if (isCrossCurrency(selected, form.currency) && !(Number(form.exchangeRate) > 0) && !(fallbackRate > 0)) {
      errs.exchangeRate = 'ارز پرداخت با ارز بسته فرق دارد؛ نرخ برابری را وارد کنید'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const amount = Number(form.amount || 0)
    const rate = Number(form.exchangeRate)
    const usdAmount = form.currency === 'دالر' ? amount : (rate > 0 ? amount / rate : null)
    addPayment({ ...form, amount, usdAmount })
    showToast('پرداخت جدید ثبت شد', 'success')
    onClose()
  }

  const bal = selected ? balances.find((b) => b.pilgrim.id === selected.id) : null

  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <><button className="btn btn-outline" onClick={onClose}>انصراف</button><button className="btn btn-primary" onClick={handleSubmit}>ثبت پرداخت</button></>
    }>
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
              {companyPilgrims.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName} {p.lastName}{p.passportNumber ? ` — ${p.passportNumber}` : ''}</option>
              ))}
            </select>
            {errors.pilgrimId && <span className="error-text">{errors.pilgrimId}</span>}
            {selected && (selected.packagePrice || selected.stayDuration) && (
              <div className="pilgrim-package-info">
                {selected.packagePrice && (
                  <span>قیمت بسته: <strong>{formatCurrency(selected.packagePrice, selected.currency || 'افغانی')}</strong></span>
                )}
                {selected.stayDuration && (
                  <span>مدت اقامت: <strong>{toPersianDigits(selected.stayDuration)} روز</strong></span>
                )}
                {bal && (
                  <span>باقی مانده: <strong style={{ color: bal.remaining > 0.005 ? '#c0392b' : '#0F5132' }}>{formatCurrency(Math.max(0, bal.remaining), bal.currency)}</strong></span>
                )}
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
            {needsRate && (
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 11.5, color: '#667085' }}>نرخ برابری دالر (هر 1 دالر = ? افغانی)</label>
                <input type="number" className="text-input" style={{ marginTop: 4 }} placeholder="مثال: 70 (نرخ برابری)" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} />
                {errors.exchangeRate && <span className="error-text">{errors.exchangeRate}</span>}
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
  )
}

// ─── تب پرداخت‌های شرکت ───
function CompanyPayments({ company, payments: cPay, allPayments, companyPilgrims, balances, can, exportPayments, addPayment }) {
  const table = useTableState(cPay, { searchFields: ['receiptNumber', 'pilgrimName'], pageSize: 8 })
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="card">
      <div className="card-header">
        <h3>پرداخت‌های زائران شرکت ({toPersianDigits(cPay.length)})</h3>
        <div className="toolbar">
          <div className="search-box">
            <FiSearch />
            <input placeholder="جستجوی پرداخت..." value={table.search} onChange={(e) => table.setSearch(e.target.value)} />
          </div>
          {can('payments', 'create') && <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}><FiPlus /> پرداخت جدید</button>}
          <button className="btn btn-outline btn-sm" onClick={() => exportPayments(company, 'pdf')}><FiFileText /> PDF</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportPayments(company, 'excel')}><FiDownload /> Excel</button>
        </div>
      </div>
      {table.paginated.length === 0 ? (
        <EmptyState title="پرداختی ثبت نشده" />
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
              </tr>
            </thead>
            <tbody>
              {table.paginated.map((pm) => (
                <tr key={pm.id}>
                  <td>{pm.receiptNumber}</td>
                  <td>{pm.pilgrimName}</td>
                  <td className="fw-bold">{formatCurrency(pm.amount, pm.currency)}</td>
                  <td><span className="badge badge-primary">{pm.paymentType}</span></td>
                  <td>{formatJalali(pm.date)}</td>
                  <td><span className={`badge ${pm.status === 'پرداخت شده' ? 'badge-success' : 'badge-warning'}`}>{pm.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={table.page} totalPages={table.totalPages} onChange={table.setPage} totalItems={table.totalItems} pageSize={table.pageSize} />

      <CompanyPaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="ثبت پرداخت جدید"
        companyPilgrims={companyPilgrims}
        allPayments={allPayments}
        balances={balances}
        addPayment={addPayment}
      />
    </div>
  )
}

// ─── تب رسیدهای شرکت ───
function CompanyReceipts({ payments: cPay, allPayments, companyPilgrims, balances, settings, can, addPayment }) {
  const { showToast } = useToast()
  const table = useTableState(cPay, { searchFields: ['receiptNumber', 'pilgrimName'], pageSize: 8 })
  const [modalOpen, setModalOpen] = useState(false)

  async function handlePrint(pm) {
    const b = balances.find((x) => x.pilgrim.id === pm.pilgrimId)
    try {
      await exportReceiptToPDF(pm, settings, b && b.remaining > 0.005 ? b.remaining : undefined, b?.currency)
    } catch {
      showToast('خطا در تولید رسید', 'error')
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>رسیدهای پرداخت ({toPersianDigits(cPay.length)})</h3>
        <div className="toolbar">
          <div className="search-box">
            <FiSearch />
            <input placeholder="جستجوی رسید..." value={table.search} onChange={(e) => table.setSearch(e.target.value)} />
          </div>
          {can('payments', 'create') && <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}><FiPlus /> رسید جدید</button>}
        </div>
      </div>
      {table.paginated.length === 0 ? (
        <EmptyState title="رسیدی یافت نشد" />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>شماره فیش</th>
                <th>زائر</th>
                <th>مبلغ</th>
                <th>تاریخ</th>
                <th>رسید</th>
              </tr>
            </thead>
            <tbody>
              {table.paginated.map((pm) => (
                <tr key={pm.id}>
                  <td>{pm.receiptNumber}</td>
                  <td>{pm.pilgrimName}</td>
                  <td className="fw-bold">{formatCurrency(pm.amount, pm.currency)}</td>
                  <td>{formatJalali(pm.date)}</td>
                  <td>
                    <button className="print-btn" onClick={() => handlePrint(pm)} title="چاپ رسید"><FiPrinter /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={table.page} totalPages={table.totalPages} onChange={table.setPage} totalItems={table.totalItems} pageSize={table.pageSize} />

      <CompanyPaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="ثبت پرداخت و رسید جدید"
        companyPilgrims={companyPilgrims}
        allPayments={allPayments}
        balances={balances}
        addPayment={addPayment}
      />
    </div>
  )
}
