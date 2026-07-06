import { useState, useMemo } from 'react'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiBriefcase, FiPhone, FiMail, FiMapPin, FiUser, FiDollarSign, FiDownload, FiFileText, FiShare2, FiArrowRight, FiEye, FiInfo, FiList, FiCreditCard, FiPrinter, FiUpload,
} from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/common/Modal'
import ConfirmModal from '../components/common/ConfirmModal'
import EmptyState from '../components/common/EmptyState'
import Pagination from '../components/common/Pagination'
import { formatCurrency, formatJalali, todayISO, toPersianDigits } from '../utils/dateUtils'
import { exportToExcel } from '../utils/excelExport'
import { exportTableToPDF, previewPdfBlob, exportReceiptToPDF } from '../utils/pdfExport'
import StatCard from '../components/common/StatCard'
import { useTableState } from '../utils/useTableState'

const EMPTY_FORM = {
  name: '', phone: '', address: '', email: '', contactPerson: '',
}

const COMPANY_TABS = [
  { key: 'info', label: 'اطلاعات شرکت', icon: <FiInfo /> },
  { key: 'pilgrims', label: 'زائران', icon: <FiList /> },
  { key: 'payments', label: 'پرداخت‌ها', icon: <FiCreditCard /> },
  { key: 'receipts', label: 'رسیدها', icon: <FiPrinter /> },
]

export default function Companies() {
  const { companies, addCompany, updateCompany, deleteCompany, pilgrims, payments, settings, addPilgrim, updatePilgrim, deletePilgrim, addPayment } = useData()
  const { showToast } = useToast()
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmId, setConfirmId] = useState(null)
  const [viewCompany, setViewCompany] = useState(null)
  const [companyTab, setCompanyTab] = useState('info')

  const filtered = useMemo(() => {
    if (!search.trim()) return companies
    const q = search.trim().toLowerCase()
    return companies.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.contactPerson?.toLowerCase().includes(q)
    )
  }, [companies, search])

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(c) {
    setForm({ ...c })
    setEditId(c.id)
    setModalOpen(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { showToast('نام شرکت الزامی است', 'error'); return }
    if (editId) {
      updateCompany(editId, form)
      showToast('شرکت بروزرسانی شد', 'success')
    } else {
      addCompany(form)
      showToast('شرکت جدید اضافه شد', 'success')
    }
    setModalOpen(false)
  }

  function handleDelete() {
    deleteCompany(confirmId)
    showToast('شرکت حذف شد', 'error')
  }

  function enterCompany(c) {
    setViewCompany(c)
    setCompanyTab('info')
  }

  // ─── Company detail helpers ───
  function companyPilgrims(companyId) {
    return pilgrims.filter((p) => p.companyId === companyId)
  }

  function companyPayments(companyId) {
    const pIds = new Set(companyPilgrims(companyId).map((p) => p.id))
    return payments.filter((pm) => pIds.has(pm.pilgrimId))
  }

  function companyFinancials(companyId) {
    const cp = companyPilgrims(companyId)
    const cPay = companyPayments(companyId)
    const totalPackages = cp.reduce((s, p) => s + Number(p.packagePrice || 0), 0)
    const totalFinal = cp.reduce((s, p) => s + Number(p.finalPrice || 0), 0)
    const totalPaid = cPay.reduce((s, pm) => s + Number(pm.amount || 0), 0)
    return { totalPilgrims: cp.length, totalPayments: cPay.length, totalPackages, totalFinal, totalPaid, remaining: totalPackages - totalPaid }
  }

  // ─── Export ───
  function exportPilgrims(company, format) {
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
    if (format === 'excel') {
      exportToExcel({ sheetName: company.name, fileName: `${company.name}-zayeran.xlsx`, rows })
      showToast('خروجی Excel دریافت شد', 'success')
    } else {
      const cols = ['ردیف', 'نام', 'نام خانوادگی', 'نام پدر', 'شماره گذرنامه', 'تلفن', 'نوع سفر', 'قیمت بسته', 'مدت اقامت', 'وضعیت']
      exportTableToPDF({
        title: `زائران شرکت: ${company.name}`,
        columns: cols,
        rows: rows.map((r) => cols.map((c) => r[c])),
        fileName: `${company.name}-zayeran.pdf`,
      })
      showToast('خروجی PDF دریافت شد', 'success')
    }
  }

  function exportPayments(company, format) {
    const cPay = companyPayments(company.id)
    if (cPay.length === 0) { showToast('پرداختی وجود ندارد', 'error'); return }
    const rows = cPay.map((pm, i) => ({
      ردیف: i + 1,
      'شماره فیش': pm.receiptNumber,
      زائر: pm.pilgrimName,
      مبلغ: Number(pm.amount).toLocaleString(),
      'نوع پرداخت': pm.paymentType,
      تاریخ: pm.date,
    }))
    if (format === 'excel') {
      exportToExcel({ sheetName: `${company.name}-payments`, fileName: `${company.name}-payments.xlsx`, rows })
      showToast('خروجی Excel دریافت شد', 'success')
    } else {
      const cols = ['ردیف', 'شماره فیش', 'زائر', 'مبلغ', 'نوع پرداخت', 'تاریخ']
      exportTableToPDF({
        title: `پرداخت‌های شرکت: ${company.name}`,
        columns: cols,
        rows: rows.map((r) => cols.map((c) => r[c])),
        fileName: `${company.name}-payments.pdf`,
      })
      showToast('خروجی PDF دریافت شد', 'success')
    }
  }

  async function sharePilgrims(company) {
    const cp = companyPilgrims(company.id)
    if (cp.length === 0) { showToast('این شرکت زائری ندارد', 'error'); return }
    const cols = ['ردیف', 'نام', 'تلفن']
    const rows = cp.map((p, i) => [i + 1, `${p.fullName} ${p.lastName}`, p.phone])
    const url = await previewPdfBlob({ title: `زائران شرکت: ${company.name}`, columns: cols, rows })
    const resp = await fetch(url)
    const blob = await resp.blob()
    URL.revokeObjectURL(url)
    const file = new File([blob], `${company.name}-zayeran.pdf`, { type: 'application/pdf' })
    if (navigator.share && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: `زائران ${company.name}` }).catch(() => {})
    } else {
      showToast('مرورگر شما از اشتراک پشتیبانی نمی‌کند', 'error')
    }
  }

  return (
    <div>
      {viewCompany ? (
        /* ─── Company Detail View with Tabs ─── */
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => setViewCompany(null)} style={{ marginBottom: 16 }}>
            <FiArrowRight /> برگشت به لیست شرکت‌ها
          </button>

          {/* Company header bar */}
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

          {/* Tabs */}
          <div className="tabs">
            {COMPANY_TABS.map((t) => (
              <button key={t.key} className={companyTab === t.key ? 'active' : ''} onClick={() => setCompanyTab(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {companyTab === 'info' && <CompanyInfo company={viewCompany} fn={companyFinancials} exportPilgrims={exportPilgrims} sharePilgrims={sharePilgrims} />}
          {companyTab === 'pilgrims' && <CompanyPilgrims company={viewCompany} pilgrims={companyPilgrims(viewCompany.id)} exportPilgrims={exportPilgrims} sharePilgrims={sharePilgrims} addPilgrim={addPilgrim} updatePilgrim={updatePilgrim} deletePilgrim={deletePilgrim} />}
          {companyTab === 'payments' && <CompanyPayments company={viewCompany} payments={companyPayments(viewCompany.id)} companyPilgrims={companyPilgrims(viewCompany.id)} exportPayments={exportPayments} addPayment={addPayment} />}
          {companyTab === 'receipts' && <CompanyReceipts company={viewCompany} payments={companyPayments(viewCompany.id)} pilgrims={pilgrims} allPayments={payments} settings={settings} addPayment={addPayment} companyPilgrims={companyPilgrims(viewCompany.id)} />}
        </div>
      ) : (
        /* ─── Companies List ─── */
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
                    <th>باقی مانده</th>
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
                        <td>
                          <span className="badge" style={{ background: fin.remaining > 0 ? 'var(--danger)' : 'var(--success)', color: '#fff' }}>
                            {formatCurrency(fin.remaining)}
                          </span>
                        </td>
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

      {/* ─── Add/Edit Modal ─── */}
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
        message="آیا از حذف این شرکت اطمینان دارید؟"
      />
    </div>
  )
}

// ─── Company Info Tab ───
function CompanyInfo({ company, fn, exportPilgrims, sharePilgrims }) {
  const fin = fn(company.id)
  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={<FiUser />} label="تعداد زائران" value={toPersianDigits(fin.totalPilgrims)} color="var(--color-primary)" />
        <StatCard icon={<FiDollarSign />} label="مفاد" value={formatCurrency(fin.totalPackages - fin.totalFinal)} color="#D4AF37" />
        <StatCard icon={<FiDollarSign />} label="مجموع پرداخت‌ها" value={formatCurrency(fin.totalPaid)} color="var(--success)" />
        <StatCard icon={<FiDollarSign />} label="باقی مانده" value={formatCurrency(Math.max(0, fin.remaining))} color={fin.remaining > 0 ? 'var(--danger)' : 'var(--success)'} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={() => exportPilgrims(company, 'pdf')}><FiFileText /> خروجی PDF زائران</button>
        <button className="btn btn-outline btn-sm" onClick={() => exportPilgrims(company, 'excel')}><FiDownload /> خروجی Excel زائران</button>
        <button className="btn btn-outline btn-sm" onClick={() => sharePilgrims(company)}><FiShare2 /> اشتراک زائران</button>
      </div>
    </div>
  )
}

// ─── Company Pilgrims Tab ───
function CompanyPilgrims({ company, pilgrims: cp, exportPilgrims, sharePilgrims, addPilgrim, updatePilgrim, deletePilgrim }) {
  const table = useTableState(cp, { searchFields: ['fullName', 'lastName', 'phone'], pageSize: 8 })
  const [pilgrimModalOpen, setPilgrimModalOpen] = useState(false)
  const [pilgrimForm, setPilgrimForm] = useState({ fullName: '', lastName: '', passportNumber: '', packagePrice: '', currency: 'افغانی', stayDuration: '', status: 'در انتظار', photo: '', finalPrice: '' })
  const [pilgrimErrors, setPilgrimErrors] = useState({})
  const [pilgrimEditId, setPilgrimEditId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  function handlePilgrimPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPilgrimForm({ ...pilgrimForm, photo: reader.result })
    reader.readAsDataURL(file)
  }

  function openAddPilgrim() {
    setPilgrimForm({ fullName: '', lastName: '', passportNumber: '', packagePrice: '', currency: 'افغانی', stayDuration: '', status: 'در انتظار', photo: '', finalPrice: '' })
    setPilgrimErrors({})
    setPilgrimEditId(null)
    setPilgrimModalOpen(true)
  }

  function openEditPilgrim(p) {
    setPilgrimForm({ fullName: p.fullName, lastName: p.lastName, passportNumber: p.passportNumber, packagePrice: p.packagePrice, currency: p.currency || 'افغانی', stayDuration: p.stayDuration || '', status: p.status || 'در انتظار', photo: p.photo || '', finalPrice: p.finalPrice || '' })
    setPilgrimErrors({})
    setPilgrimEditId(p.id)
    setPilgrimModalOpen(true)
  }

  function handlePilgrimSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!pilgrimForm.fullName.trim()) errs.fullName = 'نام الزامی است'
    if (!pilgrimForm.lastName.trim()) errs.lastName = 'نام خانوادگی الزامی است'
    setPilgrimErrors(errs)
    if (Object.keys(errs).length > 0) return
    if (pilgrimEditId) {
      updatePilgrim(pilgrimEditId, pilgrimForm)
    } else {
      addPilgrim({ ...pilgrimForm, companyId: company.id })
    }
    setPilgrimModalOpen(false)
  }

  function handleDeletePilgrim() {
    deletePilgrim(confirmDeleteId)
    setConfirmDeleteId(null)
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>زائران شرکت ({toPersianDigits(cp.length)})</h3>
        <div className="toolbar">
          <div className="search-box">
            <FiSearch />
            <input placeholder="جستجوی زائر..." value={table.search} onChange={(e) => table.setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAddPilgrim}><FiPlus /> زائر جدید</button>
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
                  <td>{p.packagePrice ? Number(p.packagePrice).toLocaleString() + ' ' + (p.currency || 'افغانی') : '-'}</td>
                  <td><span className={`badge ${p.status === 'تایید شده' ? 'badge-success' : p.status === 'لغو شده' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="edit-btn" onClick={() => openEditPilgrim(p)} title="ویرایش"><FiEdit2 /></button>
                      <button className="delete-btn" onClick={() => setConfirmDeleteId(p.id)} title="حذف"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={table.page} totalPages={table.totalPages} onChange={table.setPage} totalItems={table.totalItems} pageSize={table.pageSize} />

      <Modal open={pilgrimModalOpen} onClose={() => setPilgrimModalOpen(false)} title={pilgrimEditId ? 'ویرایش زائر' : 'افزودن زائر جدید'} footer={
        <><button className="btn btn-outline" onClick={() => setPilgrimModalOpen(false)}>انصراف</button><button className="btn btn-primary" onClick={handlePilgrimSubmit}>{pilgrimEditId ? 'ذخیره تغییرات' : 'ثبت زائر'}</button></>
      }>
        <form onSubmit={handlePilgrimSubmit}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <div className="profile-photo">
              {pilgrimForm.photo ? <img src={pilgrimForm.photo} alt="" /> : <FiUser />}
            </div>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              <FiUpload /> آپلود عکس پاسپورت
              <input type="file" accept="image/*" onChange={handlePilgrimPhoto} style={{ display: 'none' }} />
            </label>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>نام</label>
              <input className="text-input" value={pilgrimForm.fullName} onChange={(e) => setPilgrimForm({ ...pilgrimForm, fullName: e.target.value })} placeholder="نام" />
              {pilgrimErrors.fullName && <span className="error-text">{pilgrimErrors.fullName}</span>}
            </div>
            <div className="form-field">
              <label>نام خانوادگی</label>
              <input className="text-input" value={pilgrimForm.lastName} onChange={(e) => setPilgrimForm({ ...pilgrimForm, lastName: e.target.value })} placeholder="نام خانوادگی" />
              {pilgrimErrors.lastName && <span className="error-text">{pilgrimErrors.lastName}</span>}
            </div>
            <div className="form-field">
              <label>شماره گذرنامه</label>
              <input className="text-input" value={pilgrimForm.passportNumber} onChange={(e) => setPilgrimForm({ ...pilgrimForm, passportNumber: e.target.value })} placeholder="شماره گذرنامه" />
            </div>
            <div className="form-field">
              <label>مدت اقامت (روز)</label>
              <input type="number" className="text-input" value={pilgrimForm.stayDuration} onChange={(e) => setPilgrimForm({ ...pilgrimForm, stayDuration: e.target.value })} placeholder="مثال: 21" />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <select className="select-input" value={pilgrimForm.status} onChange={(e) => setPilgrimForm({ ...pilgrimForm, status: e.target.value })}>
                <option>در انتظار</option><option>تایید شده</option><option>لغو شده</option>
              </select>
            </div>
            <div className="form-field">
              <label>قیمت بسته</label>
              <div className="input-with-currency">
                <input type="number" className="text-input" value={pilgrimForm.packagePrice} onChange={(e) => setPilgrimForm({ ...pilgrimForm, packagePrice: e.target.value })} placeholder="قیمت بسته" />
                <select className="currency-select" value={pilgrimForm.currency} onChange={(e) => setPilgrimForm({ ...pilgrimForm, currency: e.target.value })}>
                  <option value="افغانی">افغانی</option><option value="دالر">دالر</option>
                </select>
              </div>
            </div>
            <div className="form-field">
              <label>قیمت تمام شده</label>
              <input type="number" className="text-input" value={pilgrimForm.finalPrice} onChange={(e) => setPilgrimForm({ ...pilgrimForm, finalPrice: e.target.value })} placeholder="قیمت تمام شده" />
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmModal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDeletePilgrim} title="حذف زائر" message="آیا از حذف این زائر اطمینان دارید؟" />
    </div>
  )
}

// ─── Company Payments Tab ───
function CompanyPayments({ company, payments: cPay, companyPilgrims, exportPayments, addPayment }) {
  const table = useTableState(cPay, { searchFields: ['receiptNumber', 'pilgrimName'], pageSize: 8 })
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ receiptNumber: 'RC-' + Math.floor(10000 + Math.random() * 89999), pilgrimId: '', pilgrimName: '', amount: '', paymentType: 'نقدی', date: todayISO(), description: '', status: 'پرداخت شده', currency: 'افغانی', exchangeRate: '', usdAmount: '' })
  const [paymentErrors, setPaymentErrors] = useState({})
  const [selectedPilgrimDetails, setSelectedPilgrimDetails] = useState(null)

  function openAddPayment() {
    setPaymentForm({ receiptNumber: 'RC-' + Math.floor(10000 + Math.random() * 89999), pilgrimId: '', pilgrimName: '', amount: '', paymentType: 'نقدی', date: todayISO(), description: '', status: 'پرداخت شده', currency: 'افغانی', exchangeRate: '', usdAmount: '' })
    setPaymentErrors({})
    setSelectedPilgrimDetails(null)
    setPaymentModalOpen(true)
  }

  function handlePilgrimChange(id) {
    const p = companyPilgrims.find((x) => x.id === id)
    setPaymentForm((f) => ({ ...f, pilgrimId: id, pilgrimName: p ? `${p.fullName} ${p.lastName}` : '' }))
    setSelectedPilgrimDetails(p || null)
  }

  function validatePayment() {
    const errs = {}
    if (!paymentForm.pilgrimId) errs.pilgrimId = 'انتخاب زائر الزامی است'
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) errs.amount = 'مبلغ معتبر وارد کنید'
    if (!paymentForm.date) errs.date = 'تاریخ الزامی است'
    setPaymentErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handlePaymentSubmit(e) {
    e.preventDefault()
    if (!validatePayment()) return
    const usdAmount = paymentForm.currency === 'دالر'
      ? Number(paymentForm.amount || 0)
      : Number(paymentForm.amount || 0) / (Number(paymentForm.exchangeRate) || 1)
    addPayment({ ...paymentForm, usdAmount })
    setPaymentModalOpen(false)
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>پرداخت‌های زائران شرکت ({toPersianDigits(cPay.length)})</h3>
        <div className="toolbar">
          <div className="search-box">
            <FiSearch />
            <input placeholder="جستجوی پرداخت..." value={table.search} onChange={(e) => table.setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAddPayment}><FiPlus /> پرداخت جدید</button>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={table.page} totalPages={table.totalPages} onChange={table.setPage} totalItems={table.totalItems} pageSize={table.pageSize} />

      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="ثبت پرداخت جدید" footer={
        <><button className="btn btn-outline" onClick={() => setPaymentModalOpen(false)}>انصراف</button><button className="btn btn-primary" onClick={handlePaymentSubmit}>ثبت پرداخت</button></>
      }>
        <form onSubmit={handlePaymentSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره فیش</label>
              <input className="text-input" value={paymentForm.receiptNumber} disabled />
            </div>
            <div className="form-field">
              <label>زائر</label>
              <select className="select-input" value={paymentForm.pilgrimId} onChange={(e) => handlePilgrimChange(e.target.value)}>
                <option value="">انتخاب زائر...</option>
                {companyPilgrims.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} {p.lastName}</option>
                ))}
              </select>
              {paymentErrors.pilgrimId && <span className="error-text">{paymentErrors.pilgrimId}</span>}
              {selectedPilgrimDetails && (selectedPilgrimDetails.packagePrice || selectedPilgrimDetails.stayDuration) && (
                <div className="pilgrim-package-info">
                  {selectedPilgrimDetails.packagePrice && (
                    <span>قیمت بسته: <strong>{Number(selectedPilgrimDetails.packagePrice).toLocaleString()} {selectedPilgrimDetails.currency || 'افغانی'}</strong></span>
                  )}
                  {selectedPilgrimDetails.stayDuration && (
                    <span>مدت اقامت: <strong>{selectedPilgrimDetails.stayDuration} روز</strong></span>
                  )}
                </div>
              )}
            </div>
            <div className="form-field">
              <label>مبلغ</label>
              <div className="input-with-currency">
                <input type="number" className="text-input" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="مبلغ پرداختی" />
                <select className="currency-select" value={paymentForm.currency} onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value, exchangeRate: '' })}>
                  <option value="افغانی">افغانی</option>
                  <option value="دالر">دالر</option>
                </select>
              </div>
              {paymentErrors.amount && <span className="error-text">{paymentErrors.amount}</span>}

            </div>
            <div className="form-field">
              <label>نوع پرداخت</label>
              <select className="select-input" value={paymentForm.paymentType} onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}>
                <option value="نقدی">نقدی</option>
                <option value="بانکی">بانکی</option>
                <option value="حواله">حواله</option>
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ</label>
              <input type="date" className="date-input" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} />
              {paymentErrors.date && <span className="error-text">{paymentErrors.date}</span>}
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <select className="select-input" value={paymentForm.status} onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}>
                <option value="پرداخت شده">پرداخت شده</option>
                <option value="در انتظار">در انتظار</option>
              </select>
            </div>
            <div className="form-field full">
              <label>توضیحات</label>
              <input className="text-input" value={paymentForm.description} onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })} placeholder="توضیحات پرداخت..." />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Company Receipts Tab ───
function CompanyReceipts({ company, payments: cPay, pilgrims, allPayments, settings, addPayment, companyPilgrims }) {
  const table = useTableState(cPay, { searchFields: ['receiptNumber', 'pilgrimName'], pageSize: 8 })
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ receiptNumber: 'RC-' + Math.floor(10000 + Math.random() * 89999), pilgrimId: '', pilgrimName: '', amount: '', paymentType: 'نقدی', date: todayISO(), description: '', status: 'پرداخت شده', currency: 'افغانی', exchangeRate: '', usdAmount: '' })
  const [paymentErrors, setPaymentErrors] = useState({})
  const [selectedPilgrimDetails, setSelectedPilgrimDetails] = useState(null)

  function openAddPayment() {
    setPaymentForm({ receiptNumber: 'RC-' + Math.floor(10000 + Math.random() * 89999), pilgrimId: '', pilgrimName: '', amount: '', paymentType: 'نقدی', date: todayISO(), description: '', status: 'پرداخت شده', currency: 'افغانی', exchangeRate: '', usdAmount: '' })
    setPaymentErrors({})
    setSelectedPilgrimDetails(null)
    setPaymentModalOpen(true)
  }

  function handlePilgrimChange(id) {
    const p = companyPilgrims.find((x) => x.id === id)
    setPaymentForm((f) => ({ ...f, pilgrimId: id, pilgrimName: p ? `${p.fullName} ${p.lastName}` : '' }))
    setSelectedPilgrimDetails(p || null)
  }

  function validatePayment() {
    const errs = {}
    if (!paymentForm.pilgrimId) errs.pilgrimId = 'انتخاب زائر الزامی است'
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) errs.amount = 'مبلغ معتبر وارد کنید'
    if (!paymentForm.date) errs.date = 'تاریخ الزامی است'
    setPaymentErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handlePaymentSubmit(e) {
    e.preventDefault()
    if (!validatePayment()) return
    const usdAmount = paymentForm.currency === 'دالر'
      ? Number(paymentForm.amount || 0)
      : Number(paymentForm.amount || 0) / (Number(paymentForm.exchangeRate) || 1)
    addPayment({ ...paymentForm, usdAmount })
    setPaymentModalOpen(false)
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
          <button className="btn btn-primary btn-sm" onClick={openAddPayment}><FiPlus /> رسید جدید</button>
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
                    <button className="print-btn" onClick={() => {
                      const pilgrim = pilgrims.find((x) => x.id === pm.pilgrimId)
                      const pPayments = allPayments.filter((p) => p.pilgrimId === pm.pilgrimId)
                      const totalPaid = pPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
                      const remaining = pilgrim ? Number(pilgrim.packagePrice || 0) - totalPaid : 0
                      exportReceiptToPDF(pm, settings, remaining > 0 ? remaining : undefined)
                    }} title="چاپ رسید"><FiPrinter /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={table.page} totalPages={table.totalPages} onChange={table.setPage} totalItems={table.totalItems} pageSize={table.pageSize} />

      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="ثبت پرداخت و رسید جدید" footer={
        <><button className="btn btn-outline" onClick={() => setPaymentModalOpen(false)}>انصراف</button><button className="btn btn-primary" onClick={handlePaymentSubmit}>ثبت پرداخت</button></>
      }>
        <form onSubmit={handlePaymentSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره فیش</label>
              <input className="text-input" value={paymentForm.receiptNumber} disabled />
            </div>
            <div className="form-field">
              <label>زائر</label>
              <select className="select-input" value={paymentForm.pilgrimId} onChange={(e) => handlePilgrimChange(e.target.value)}>
                <option value="">انتخاب زائر...</option>
                {companyPilgrims.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} {p.lastName}</option>
                ))}
              </select>
              {paymentErrors.pilgrimId && <span className="error-text">{paymentErrors.pilgrimId}</span>}
              {selectedPilgrimDetails && (selectedPilgrimDetails.packagePrice || selectedPilgrimDetails.stayDuration) && (
                <div className="pilgrim-package-info">
                  {selectedPilgrimDetails.packagePrice && (
                    <span>قیمت بسته: <strong>{Number(selectedPilgrimDetails.packagePrice).toLocaleString()} {selectedPilgrimDetails.currency || 'افغانی'}</strong></span>
                  )}
                  {selectedPilgrimDetails.stayDuration && (
                    <span>مدت اقامت: <strong>{selectedPilgrimDetails.stayDuration} روز</strong></span>
                  )}
                </div>
              )}
            </div>
            <div className="form-field">
              <label>مبلغ</label>
              <div className="input-with-currency">
                <input type="number" className="text-input" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="مبلغ پرداختی" />
                <select className="currency-select" value={paymentForm.currency} onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value, exchangeRate: '' })}>
                  <option value="افغانی">افغانی</option>
                  <option value="دالر">دالر</option>
                </select>
              </div>
              {paymentErrors.amount && <span className="error-text">{paymentErrors.amount}</span>}

            </div>
            <div className="form-field">
              <label>نوع پرداخت</label>
              <select className="select-input" value={paymentForm.paymentType} onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}>
                <option value="نقدی">نقدی</option>
                <option value="بانکی">بانکی</option>
                <option value="حواله">حواله</option>
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ</label>
              <input type="date" className="date-input" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} />
              {paymentErrors.date && <span className="error-text">{paymentErrors.date}</span>}
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <select className="select-input" value={paymentForm.status} onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}>
                <option value="پرداخت شده">پرداخت شده</option>
                <option value="در انتظار">در انتظار</option>
              </select>
            </div>
            <div className="form-field full">
              <label>توضیحات</label>
              <input className="text-input" value={paymentForm.description} onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })} placeholder="توضیحات پرداخت..." />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
