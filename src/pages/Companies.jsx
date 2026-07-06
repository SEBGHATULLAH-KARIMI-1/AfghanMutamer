import { useState, useMemo } from 'react'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiBriefcase, FiPhone, FiMail, FiMapPin, FiUser, FiDollarSign, FiDownload, FiFileText, FiShare2, FiArrowRight, FiEye,
} from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/common/Modal'
import ConfirmModal from '../components/common/ConfirmModal'
import EmptyState from '../components/common/EmptyState'
import { formatCurrency, formatJalali, toPersianDigits } from '../utils/dateUtils'
import { exportToExcel } from '../utils/excelExport'
import { exportTableToPDF, previewPdfBlob } from '../utils/pdfExport'
import StatCard from '../components/common/StatCard'

const EMPTY_FORM = {
  name: '', phone: '', address: '', email: '', contactPerson: '',
}

export default function Companies() {
  const { companies, addCompany, updateCompany, deleteCompany, pilgrims, payments, settings } = useData()
  const { showToast } = useToast()
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmId, setConfirmId] = useState(null)
  const [viewCompany, setViewCompany] = useState(null)

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
    const totalPaid = cPay.reduce((s, pm) => s + Number(pm.amount || 0), 0)
    return { totalPilgrims: cp.length, totalPayments: cPay.length, totalPackages, totalPaid, remaining: totalPackages - totalPaid }
  }

  // ─── Export ───
  function exportData(company, format) {
    const cp = companyPilgrims(company.id)
    if (cp.length === 0) { showToast('این شرکت زائری ندارد', 'error'); return }
    const fin = companyFinancials(company.id)
    const rows = cp.map((p, i) => ({
      ردیف: i + 1,
      نام: `${p.fullName} ${p.lastName}`,
      تلفن: p.phone,
      'نوع سفر': p.travelType,
      'قیمت بسته': Number(p.packagePrice || 0).toLocaleString(),
      'پرداخت شده': '-',
      'باقی مانده': '-',
    }))
    if (format === 'excel') {
      exportToExcel({ sheetName: company.name, fileName: `${company.name}-zayeran.xlsx`, rows })
      showToast('خروجی Excel دریافت شد', 'success')
    } else {
      const cols = ['ردیف', 'نام', 'تلفن', 'نوع سفر', 'قیمت بسته']
      exportTableToPDF({
        title: `زائران شرکت: ${company.name}`,
        columns: cols,
        rows: rows.map((r) => cols.map((c) => r[c])),
        fileName: `${company.name}-zayeran.pdf`,
      })
      showToast('خروجی PDF دریافت شد', 'success')
    }
  }

  async function shareCompany(company) {
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
        /* ─── Company Detail View ─── */
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => setViewCompany(null)} style={{ marginBottom: 16 }}>
            <FiArrowRight /> برگشت به لیست شرکت‌ها
          </button>
          {(() => {
            const fin = companyFinancials(viewCompany.id)
            const cp = companyPilgrims(viewCompany.id)
            const cPay = companyPayments(viewCompany.id)
            return (
              <>
                <div className="card" style={{ marginBottom: 18 }}>
                  <div className="card-header">
                    <h3><FiBriefcase /> {viewCompany.name}</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => exportData(viewCompany, 'pdf')}><FiFileText /> PDF</button>
                      <button className="btn btn-outline btn-sm" onClick={() => exportData(viewCompany, 'excel')}><FiDownload /> Excel</button>
                      <button className="btn btn-outline btn-sm" onClick={() => shareCompany(viewCompany)}><FiShare2 /> اشتراک</button>
                    </div>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                      {viewCompany.phone && <span><FiPhone /> {viewCompany.phone}</span>}
                      {viewCompany.email && <span><FiMail /> {viewCompany.email}</span>}
                      {viewCompany.address && <span><FiMapPin /> {viewCompany.address}</span>}
                      {viewCompany.contactPerson && <span><FiUser /> {viewCompany.contactPerson}</span>}
                    </div>
                  </div>
                </div>

                <div className="stats-grid">
                  <StatCard icon={<FiUser />} label="تعداد زائران" value={toPersianDigits(fin.totalPilgrims)} color="var(--color-primary)" />
                  <StatCard icon={<FiDollarSign />} label="مجموع قیمت بسته‌ها" value={formatCurrency(fin.totalPackages)} color="#D4AF37" />
                  <StatCard icon={<FiDollarSign />} label="مجموع پرداخت‌ها" value={formatCurrency(fin.totalPaid)} color="var(--success)" />
                  <StatCard icon={<FiDollarSign />} label="باقی مانده" value={formatCurrency(Math.max(0, fin.remaining))} color={fin.remaining > 0 ? 'var(--danger)' : 'var(--success)'} />
                </div>

                {/* Pilgrims Table */}
                <div className="card" style={{ marginBottom: 18 }}>
                  <div className="card-header">
                    <h3>زائران شرکت ({toPersianDigits(cp.length)})</h3>
                  </div>
                  {cp.length === 0 ? (
                    <EmptyState title="زائری ثبت نشده" description="این شرکت هنوز زائری ندارد" />
                  ) : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>نام</th>
                            <th>تلفن</th>
                            <th>نوع سفر</th>
                            <th>قیمت بسته</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cp.map((p) => (
                            <tr key={p.id}>
                              <td>{p.fullName} {p.lastName}</td>
                              <td>{p.phone}</td>
                              <td><span className="badge badge-info">{p.travelType}</span></td>
                              <td>{p.packagePrice ? Number(p.packagePrice).toLocaleString() + ' ' + (p.currency || 'افغانی') : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Payments Table */}
                <div className="card">
                  <div className="card-header">
                    <h3>پرداخت‌های زائران شرکت ({toPersianDigits(cPay.length)})</h3>
                  </div>
                  {cPay.length === 0 ? (
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
                          {cPay.map((pm) => (
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
                </div>
              </>
            )
          })()}
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
                    <th>پرداخت‌ها</th>
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
                            <button className="view-btn" onClick={() => setViewCompany(c)} title="مشاهده"><FiEye /></button>
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
