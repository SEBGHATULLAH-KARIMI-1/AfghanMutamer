import { useState } from 'react'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiPrinter, FiUpload, FiUser, FiX, FiDownload, FiFileText, FiShare2, FiImage,
} from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useTableState } from '../utils/useTableState'
import Modal from '../components/common/Modal'
import ConfirmModal from '../components/common/ConfirmModal'
import Pagination from '../components/common/Pagination'
import EmptyState from '../components/common/EmptyState'
import { formatJalali, toPersianDigits } from '../utils/dateUtils'
import { exportToExcel } from '../utils/excelExport'
import { exportTableToPDF, previewPdfBlob } from '../utils/pdfExport'

const EMPTY_FORM = {
  fullName: '', fatherName: '', lastName: '', gender: 'مرد', dob: '',
  phone: '', address: '', passportNumber: '', passportIssueDate: '', passportExpiryDate: '',
  travelType: 'عمره', caravanNumber: '', status: 'در انتظار', photo: '', familyGroup: '',
  packagePrice: '', stayDuration: '', currency: 'افغانی', companyId: '',
}

export default function Pilgrims() {
  const { pilgrims, addPilgrim, updatePilgrim, deletePilgrim, companies } = useData()
  const { showToast } = useToast()
  const { can } = useAuth()

  const EXPORT_FIELDS = [
    { key: 'fullName', label: 'نام' },
    { key: 'lastName', label: 'نام خانوادگی' },
    { key: 'fatherName', label: 'نام پدر' },
    { key: 'gender', label: 'جنسیت' },
    { key: 'phone', label: 'تلفن' },
    { key: 'address', label: 'آدرس' },
    { key: 'passportNumber', label: 'شماره گذرنامه' },
    { key: 'passportIssueDate', label: 'تاریخ صدور' },
    { key: 'passportExpiryDate', label: 'تاریخ انقضا' },
    { key: 'travelType', label: 'نوع سفر' },
    { key: 'caravanNumber', label: 'شماره کاروان' },
    { key: 'status', label: 'وضعیت' },
    { key: 'familyGroup', label: 'گروه خانوادگی' },
    { key: 'packagePrice', label: 'قیمت بسته' },
    { key: 'stayDuration', label: 'مدت اقامت' },
  ]

  const table = useTableState(pilgrims, {
    searchFields: ['fullName', 'lastName', 'phone', 'passportNumber', 'caravanNumber'],
    pageSize: 8,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [editId, setEditId] = useState(null)
  const [forms, setForms] = useState([{ ...EMPTY_FORM }])
  const [errorsList, setErrorsList] = useState([{}])
  const [confirmId, setConfirmId] = useState(null)
  const [exportFormat, setExportFormat] = useState(null)
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null)
  const [exportFilters, setExportFilters] = useState({
    statuses: [], travelTypes: [], genders: [], caravans: [],
  })
  const [exportFields, setExportFields] = useState(EXPORT_FIELDS.map((f) => f.key))

  function openAdd() {
    setForms([{ ...EMPTY_FORM }])
    setErrorsList([{}])
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(p) {
    setForms([{ ...EMPTY_FORM, ...p }])
    setErrorsList([{}])
    setEditId(p.id)
    setModalOpen(true)
  }

  function addForm() {
    setForms((prev) => [...prev, { ...EMPTY_FORM, travelType: prev[0].travelType, familyGroup: prev[0].familyGroup }])
    setErrorsList((prev) => [...prev, {}])
  }

  function removeForm(idx) {
    if (forms.length <= 1) return
    setForms((prev) => prev.filter((_, i) => i !== idx))
    setErrorsList((prev) => prev.filter((_, i) => i !== idx))
  }

  function setForm(idx, patch) {
    setForms((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }

  function handlePhoto(idx, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm(idx, { photo: reader.result })
    reader.readAsDataURL(file)
  }

  function validateAll() {
    const newErrorsList = forms.map((f) => {
      const errs = {}
      if (!f.fullName.trim()) errs.fullName = 'نام الزامی است'
      if (!f.lastName.trim()) errs.lastName = 'نام خانوادگی الزامی است'
      if (!f.phone.trim()) errs.phone = 'شماره تماس الزامی است'
      if (!f.passportNumber.trim()) errs.passportNumber = 'شماره گذرنامه الزامی است'
      return errs
    })
    setErrorsList(newErrorsList)
    return newErrorsList.every((e) => Object.keys(e).length === 0)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validateAll()) return
    if (editId) {
      updatePilgrim(editId, forms[0])
      showToast('اطلاعات زائر بروزرسانی شد', 'success')
      setModalOpen(false)
    } else {
      forms.forEach((f) => addPilgrim(f))
      showToast(`${forms.length} زائر با موفقیت اضافه شدند`, 'success')
      setModalOpen(false)
    }
  }

  function handleDelete() {
    deletePilgrim(confirmId)
    showToast('زائر حذف شد', 'error')
  }

  function printProfile(p) {
    const w = window.open('', '_blank', 'width=700,height=900')
    if (!w) return
    w.document.write(`
      <html dir="rtl" lang="fa">
        <head><meta charset="utf-8" /><title>پروفایل زائر</title>
        <style>
          body { font-family: Tahoma, sans-serif; padding: 30px; color: #1a1a1a; }
          h2 { color: #0F5132; border-bottom: 3px solid #D4AF37; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
          td.label { color: #667085; width: 40%; }
        </style>
        </head>
        <body>
          <h2>پروفایل زائر: ${p.fullName} ${p.lastName}</h2>
          <table>
            <tr><td class="label">نام پدر</td><td>${p.fatherName || '-'}</td></tr>
            <tr><td class="label">جنسیت</td><td>${p.gender}</td></tr>
            <tr><td class="label">تاریخ تولد</td><td>${p.dob || '-'}</td></tr>
            <tr><td class="label">شماره تماس</td><td>${p.phone}</td></tr>
            <tr><td class="label">آدرس</td><td>${p.address || '-'}</td></tr>
            <tr><td class="label">شماره گذرنامه</td><td>${p.passportNumber}</td></tr>
            <tr><td class="label">تاریخ صدور گذرنامه</td><td>${p.passportIssueDate || '-'}</td></tr>
            <tr><td class="label">تاریخ انقضای گذرنامه</td><td>${p.passportExpiryDate || '-'}</td></tr>
            <tr><td class="label">نوع سفر</td><td>${p.travelType}</td></tr>
            <tr><td class="label">شماره کاروان</td><td>${p.caravanNumber || '-'}</td></tr>
            <tr><td class="label">قیمت بسته</td><td>${p.packagePrice ? Number(p.packagePrice).toLocaleString() + ' ' + (p.currency || 'افغانی') : '-'}</td></tr>
            <tr><td class="label">مدت اقامت</td><td>${p.stayDuration ? p.stayDuration + ' روز' : '-'}</td></tr>
            <tr><td class="label">وضعیت</td><td>${p.status}</td></tr>
          </table>
        </body>
      </html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  function openExportModal(format) {
    setExportFormat(format)
    setExportFilters({
      statuses: [],
      travelTypes: [],
      genders: [],
      caravans: [],
    })
    setExportFields(EXPORT_FIELDS.map((f) => f.key))
    setPreviewPdfUrl(null)
  }

  function getFilteredRows() {
    let rows = pilgrims
    if (exportFilters.statuses.length) rows = rows.filter((p) => exportFilters.statuses.includes(p.status))
    if (exportFilters.travelTypes.length) rows = rows.filter((p) => exportFilters.travelTypes.includes(p.travelType))
    if (exportFilters.genders.length) rows = rows.filter((p) => exportFilters.genders.includes(p.gender))
    if (exportFilters.caravans.length) rows = rows.filter((p) => exportFilters.caravans.includes(p.caravanNumber))
    return rows
  }

  function buildExportData(rows) {
    const fieldMap = {
      fullName: (p) => p.fullName,
      lastName: (p) => p.lastName,
      fatherName: (p) => p.fatherName || '-',
      gender: (p) => p.gender,
      phone: (p) => p.phone,
      address: (p) => p.address || '-',
      passportNumber: (p) => p.passportNumber,
      passportIssueDate: (p) => p.passportIssueDate || '-',
      passportExpiryDate: (p) => p.passportExpiryDate || '-',
      travelType: (p) => p.travelType,
      caravanNumber: (p) => p.caravanNumber || '-',
      status: (p) => p.status,
      familyGroup: (p) => p.familyGroup || '-',
      packagePrice: (p) => (p.packagePrice ? Number(p.packagePrice).toLocaleString() + ' ' + (p.currency || 'افغانی') : '-'),
      stayDuration: (p) => p.stayDuration || '-',
    }
    const labels = {
      fullName: 'نام', lastName: 'نام خانوادگی', fatherName: 'نام پدر',
      gender: 'جنسیت', phone: 'تلفن', address: 'آدرس',
      passportNumber: 'شماره گذرنامه', passportIssueDate: 'تاریخ صدور',
      passportExpiryDate: 'تاریخ انقضا', travelType: 'نوع سفر',
      caravanNumber: 'شماره کاروان', status: 'وضعیت', familyGroup: 'گروه خانوادگی',
      packagePrice: 'قیمت بسته', stayDuration: 'مدت اقامت',
    }
    const selectedFields = exportFields.filter((k) => fieldMap[k])
    const columns = ['ردیف', ...selectedFields.map((k) => labels[k])]
    const dataRows = rows.map((p, i) => {
      const row = { ردیف: i + 1 }
      selectedFields.forEach((k) => { row[labels[k]] = fieldMap[k](p) })
      return row
    })
    return { columns, rows: dataRows }
  }

  async function generatePreview() {
    const rows = getFilteredRows()
    if (rows.length === 0) { showToast('داده‌ای برای پیش‌نمایش وجود ندارد', 'error'); return }
    const { columns, rows: data } = buildExportData(rows)
    try {
      const url = await previewPdfBlob({
        title: 'فهرست زائران',
        columns,
        rows: data.map((r) => Object.values(r)),
      })
      setPreviewPdfUrl(url)
    } catch {
      showToast('خطا در تولید پیش‌نمایش', 'error')
    }
  }

  async function executeExport() {
    let rows = getFilteredRows()
    if (rows.length === 0) {
      showToast('داده‌ای برای خروجی وجود ندارد', 'error')
      return
    }
    const { columns, rows: data } = buildExportData(rows)
    if (exportFormat === 'excel') {
      await exportToExcel({ sheetName: 'زائران', fileName: `zayeran-${Date.now()}.xlsx`, rows: data })
      showToast('خروجی Excel با موفقیت دریافت شد', 'success')
    } else {
      await exportTableToPDF({
        title: 'فهرست زائران',
        columns,
        rows: data.map((r) => Object.values(r)),
        fileName: `zayeran-${Date.now()}.pdf`,
      })
      showToast('خروجی PDF با موفقیت دریافت شد', 'success')
    }
    if (previewPdfUrl) { URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null) }
    setExportFormat(null)
  }

  function toggleFilter(arr, val) {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
  }

  async function shareExport(rows, format) {
    if (rows.length === 0) { showToast('داده‌ای برای اشتراک وجود ندارد', 'error'); return }
    const { columns, rows: data } = buildExportData(rows)
    let blob
    if (format === 'excel') {
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet('زائران')
      ws.addRow(columns)
      data.forEach((r) => ws.addRow(columns.map((c) => r[c])))
      const buf = await workbook.xlsx.writeBuffer()
      blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    } else {
      const url = await previewPdfBlob({
        title: 'فهرست زائران', columns,
        rows: data.map((r) => Object.values(r)),
      })
      const resp = await fetch(url)
      blob = await resp.blob()
      URL.revokeObjectURL(url)
    }
    const file = new File([blob], `zayeran.${format === 'excel' ? 'xlsx' : 'pdf'}`, { type: blob.type })
    if (navigator.share && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'فهرست زائران' }).catch(() => {})
    } else {
      showToast('مرورگر شما از اشتراک فایل پشتیبانی نمی‌کند', 'error')
    }
  }

  function downloadPhoto(p) {
    if (!p.photo) { showToast('عکسی برای دانلود وجود ندارد', 'error'); return }
    const a = document.createElement('a')
    a.href = p.photo
    a.download = `${p.fullName}-${p.lastName}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>فهرست زائران ({toPersianDigits(table.totalItems)})</h3>
          <div className="toolbar">
            <div className="search-box">
              <FiSearch />
              <input
                placeholder="جستجو بر اساس نام، تلفن یا گذرنامه..."
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
              />
            </div>
            <select className="select-input" value={table.filters?.travelType || 'all'} onChange={(e) => table.setFilter('travelType', e.target.value)}>
              <option value="all">همه انواع سفر</option>
              {[...new Set(pilgrims.map((p) => p.travelType))].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="select-input" value={table.filters?.status || 'all'} onChange={(e) => table.setFilter('status', e.target.value)}>
              <option value="all">همه وضعیت‌ها</option>
              <option value="تایید شده">تایید شده</option>
              <option value="در انتظار">در انتظار</option>
              <option value="لغو شده">لغو شده</option>
            </select>
            <button className="btn btn-outline" onClick={() => openExportModal('pdf')} title="خروجی PDF"><FiFileText /> PDF</button>
            <button className="btn btn-outline" onClick={() => openExportModal('excel')} title="خروجی Excel"><FiDownload /> Excel</button>
            {can('pilgrims', 'create') && <button className="btn btn-primary" onClick={openAdd}><FiPlus /> افزودن زائر</button>}
          </div>
        </div>

        {table.paginated.length === 0 ? (
          <EmptyState title="زائری یافت نشد" description="هیچ زائری مطابق با جستجوی شما یافت نشد." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>خانواده</th>
                  <th>عکس</th>
                  <th>نام کامل</th>
                  <th>تلفن</th>
                  <th>نوع سفر</th>
                  <th>کاروان</th>
                  <th>گذرنامه</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const items = table.paginated
                  const groups = items.map((p, i) => {
                    const prev = items[i - 1]
                    const next = items[i + 1]
                    const fg = p.familyGroup?.trim()
                    if (!fg) return { ...p, _bracket: null, _group: null }
                    const samePrev = fg === prev?.familyGroup?.trim()
                    const sameNext = fg === next?.familyGroup?.trim()
                    let bracket = samePrev && sameNext ? 'mid' : samePrev ? 'end' : sameNext ? 'start' : 'single'
                    return { ...p, _bracket: bracket, _group: fg }
                  })
                  return groups.map((p) => (
                    <tr key={p.id}>
                      <td className="family-bracket-cell">
                        {p._bracket && (
                          <div className={`family-bracket family-bracket--${p._bracket}`} />
                        )}
                      </td>
                      <td>
                        <div className="avatar-cell">
                          {p.photo ? <img src={p.photo} alt="" /> : (p.fullName?.charAt(0) || <FiUser />)}
                        </div>
                      </td>
                      <td>{p.fullName} {p.lastName}</td>
                      <td>{p.phone}</td>
                      <td><span className="badge badge-info">{p.travelType}</span></td>
                      <td>{p.caravanNumber || '-'}</td>
                      <td>{p.passportNumber}</td>
                      <td><span className={`badge ${p.status === 'تایید شده' ? 'badge-success' : p.status === 'لغو شده' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="view-btn" onClick={() => setViewItem(p)} title="نمایش پروفایل"><FiEye /></button>
                          {can('pilgrims', 'edit') && <button className="edit-btn" onClick={() => openEdit(p)} title="ویرایش"><FiEdit2 /></button>}
                          <button className="print-btn" onClick={() => printProfile(p)} title="چاپ پروفایل"><FiPrinter /></button>
                          {can('pilgrims', 'delete') && <button className="delete-btn" onClick={() => setConfirmId(p.id)} title="حذف"><FiTrash2 /></button>}
                        </div>
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={table.page} totalPages={table.totalPages} onChange={table.setPage} totalItems={table.totalItems} pageSize={table.pageSize} />
      </div>

      {/* مودال افزودن / ویرایش */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'ویرایش اطلاعات زائر' : 'افزودن زائر جدید'}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>انصراف</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editId ? 'ذخیره تغییرات' : `ثبت همه (${forms.length} نفر)`}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {forms.map((form, idx) => (
            <div key={idx} className="multi-form-block">
              {!editId && forms.length > 1 && (
                <div className="multi-form-header">
                  <span className="multi-form-num">زائر {idx + 1}</span>
                  <button type="button" className="btn btn-icon btn-danger" onClick={() => removeForm(idx)} title="حذف این زائر">
                    <FiX />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
                <div className="profile-photo">
                  {form.photo ? <img src={form.photo} alt="" /> : <FiUser />}
                </div>
                <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                  <FiUpload /> آپلود عکس
                  <input type="file" accept="image/*" onChange={(e) => handlePhoto(idx, e)} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>نام</label>
                  <input className="text-input" value={form.fullName} onChange={(e) => setForm(idx, { fullName: e.target.value })} placeholder="مثال: محمد" />
                  {errorsList[idx]?.fullName && <span className="error-text">{errorsList[idx].fullName}</span>}
                </div>
                <div className="form-field">
                  <label>نام پدر</label>
                  <input className="text-input" value={form.fatherName} onChange={(e) => setForm(idx, { fatherName: e.target.value })} placeholder="مثال: احمد" />
                </div>
                <div className="form-field">
                  <label>نام خانوادگی</label>
                  <input className="text-input" value={form.lastName} onChange={(e) => setForm(idx, { lastName: e.target.value })} placeholder="مثال: حسینی" />
                  {errorsList[idx]?.lastName && <span className="error-text">{errorsList[idx].lastName}</span>}
                </div>
                <div className="form-field">
                  <label>جنسیت</label>
                  <select className="select-input" value={form.gender} onChange={(e) => setForm(idx, { gender: e.target.value })}>
                    <option value="مرد">مرد</option>
                    <option value="زن">زن</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>تاریخ تولد</label>
                  <input type="date" className="date-input" value={form.dob} onChange={(e) => setForm(idx, { dob: e.target.value })} placeholder="تاریخ تولد" />
                </div>
                <div className="form-field">
                  <label>شماره تماس</label>
                  <input className="text-input" value={form.phone} onChange={(e) => setForm(idx, { phone: e.target.value })} placeholder="مثال: 0700123456" />
                  {errorsList[idx]?.phone && <span className="error-text">{errorsList[idx].phone}</span>}
                </div>
                <div className="form-field full">
                  <label>آدرس</label>
                  <input className="text-input" value={form.address} onChange={(e) => setForm(idx, { address: e.target.value })} placeholder="مثال: کابل، افغانستان" />
                </div>
                <div className="form-field">
                  <label>شماره گذرنامه</label>
                  <input className="text-input" value={form.passportNumber} onChange={(e) => setForm(idx, { passportNumber: e.target.value })} placeholder="مثال: P12345678" />
                  {errorsList[idx]?.passportNumber && <span className="error-text">{errorsList[idx].passportNumber}</span>}
                </div>
                <div className="form-field">
                  <label>شماره کاروان</label>
                  <input className="text-input" value={form.caravanNumber} onChange={(e) => setForm(idx, { caravanNumber: e.target.value })} placeholder="مثال: C-101" />
                </div>
                <div className="form-field">
                  <label>تاریخ صدور گذرنامه</label>
                  <input type="date" className="date-input" value={form.passportIssueDate} onChange={(e) => setForm(idx, { passportIssueDate: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>تاریخ انقضای گذرنامه</label>
                  <input type="date" className="date-input" value={form.passportExpiryDate} onChange={(e) => setForm(idx, { passportExpiryDate: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>نوع سفر</label>
                  <input className="text-input" value={form.travelType} onChange={(e) => setForm(idx, { travelType: e.target.value })} placeholder="مثال: عمره، حج، سیاحتی" />
                </div>
                <div className="form-field">
                  <label>قیمت بسته</label>
                  <div className="input-with-currency">
                    <input type="number" className="text-input" value={form.packagePrice} onChange={(e) => setForm(idx, { packagePrice: e.target.value })} placeholder="مبلغ بسته سفر" />
                    <select className="currency-select" value={form.currency} onChange={(e) => setForm(idx, { currency: e.target.value })}>
                      <option value="افغانی">افغانی</option>
                      <option value="دالر">دالر</option>
                    </select>
                  </div>
                </div>
                <div className="form-field">
                  <label>مدت اقامت (روز)</label>
                  <input type="number" className="text-input" value={form.stayDuration} onChange={(e) => setForm(idx, { stayDuration: e.target.value })} placeholder="تعداد روز" />
                </div>
                <div className="form-field">
                  <label>گروه / خانواده</label>
                  <input className="text-input" value={form.familyGroup} onChange={(e) => setForm(idx, { familyGroup: e.target.value })} placeholder="نام گروه خانوادگی (اختیاری)" />
                </div>
                <div className="form-field">
                  <label>وضعیت</label>
                  <select className="select-input" value={form.status} onChange={(e) => setForm(idx, { status: e.target.value })}>
                    <option value="تایید شده">تایید شده</option>
                    <option value="در انتظار">در انتظار</option>
                    <option value="لغو شده">لغو شده</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>شرکت</label>
                  <select className="select-input" value={form.companyId} onChange={(e) => setForm(idx, { companyId: e.target.value })}>
                    <option value="">بدون شرکت</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {!editId && (
            <button type="button" className="btn btn-outline btn-block" onClick={addForm} style={{ marginTop: 12 }}>
              <FiPlus /> افزودن فرد دیگر
            </button>
          )}
        </form>
      </Modal>

      {/* مودال نمایش پروفایل */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="پروفایل زائر" size="md">
        {viewItem && (
          <div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
              <div className="profile-photo" style={{ position: 'relative' }}>
                {viewItem.photo ? <img src={viewItem.photo} alt="" /> : <FiUser />}
                {viewItem.photo && (
                  <button onClick={() => downloadPhoto(viewItem)} className="btn btn-icon" style={{ position: 'absolute', bottom: -4, insetInlineEnd: -4, width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="دانلود عکس">
                    <FiImage size={14} />
                  </button>
                )}
              </div>
              <div>
                <div className="fw-bold" style={{ fontSize: 16 }}>{viewItem.fullName} {viewItem.lastName}</div>
                <div className="text-muted" style={{ fontSize: 13 }}>{viewItem.fatherName}</div>
              </div>
            </div>
            <div className="grid-2">
              <InfoRow label="جنسیت" value={viewItem.gender} />
              <InfoRow label="تاریخ تولد" value={formatJalali(viewItem.dob)} />
              <InfoRow label="شماره تماس" value={viewItem.phone} />
              <InfoRow label="آدرس" value={viewItem.address} />
              <InfoRow label="شماره گذرنامه" value={viewItem.passportNumber} />
              <InfoRow label="انقضای گذرنامه" value={formatJalali(viewItem.passportExpiryDate)} />
              <InfoRow label="نوع سفر" value={viewItem.travelType} />
              <InfoRow label="کاروان" value={viewItem.caravanNumber} />
              <InfoRow label="قیمت بسته" value={viewItem.packagePrice ? Number(viewItem.packagePrice).toLocaleString() + ' ' + (viewItem.currency || 'افغانی') : '-'} />
              <InfoRow label="مدت اقامت" value={viewItem.stayDuration ? viewItem.stayDuration + ' روز' : '-'} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!exportFormat}
        onClose={() => { if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); setExportFormat(null) }}
        title={`خروجی ${exportFormat === 'pdf' ? 'PDF' : 'Excel'} - انتخاب مشخّصات`}
        size="md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setExportFormat(null)}>انصراف</button>
            {exportFormat === 'pdf' && <button className="btn btn-outline" onClick={generatePreview}><FiFileText /> پیش‌نمایش</button>}
            <button className="btn btn-outline" onClick={() => shareExport(getFilteredRows(), exportFormat)}><FiShare2 /> اشتراک</button>
            <button className="btn btn-primary" onClick={executeExport}><FiDownload /> دانلود</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="export-label">وضعیت</label>
            <div className="export-chips">
              {[...new Set(pilgrims.map((p) => p.status))].map((s) => (
                <label key={s} className={`chip ${exportFilters.statuses.includes(s) ? 'chip-active' : ''}`}
                  onClick={() => setExportFilters((f) => ({ ...f, statuses: toggleFilter(f.statuses, s) }))}>
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="export-label">نوع سفر</label>
            <div className="export-chips">
              {[...new Set(pilgrims.map((p) => p.travelType))].map((t) => (
                <label key={t} className={`chip ${exportFilters.travelTypes.includes(t) ? 'chip-active' : ''}`}
                  onClick={() => setExportFilters((f) => ({ ...f, travelTypes: toggleFilter(f.travelTypes, t) }))}>
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="export-label">جنسیت</label>
            <div className="export-chips">
              {['مرد', 'زن'].map((g) => (
                <label key={g} className={`chip ${exportFilters.genders.includes(g) ? 'chip-active' : ''}`}
                  onClick={() => setExportFilters((f) => ({ ...f, genders: toggleFilter(f.genders, g) }))}>
                  {g}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="export-label">شماره کاروان</label>
            <div className="export-chips">
              {[...new Set(pilgrims.map((p) => p.caravanNumber).filter(Boolean))].map((c) => (
                <label key={c} className={`chip ${exportFilters.caravans.includes(c) ? 'chip-active' : ''}`}
                  onClick={() => setExportFilters((f) => ({ ...f, caravans: toggleFilter(f.caravans, c) }))}>
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="export-label">فیلدهای مورد نظر</label>
            <div className="export-checkbox-grid">
              {EXPORT_FIELDS.map((f) => (
                <label key={f.key} className="export-checkbox">
                  <input type="checkbox" checked={exportFields.includes(f.key)}
                    onChange={() => setExportFields((prev) => prev.includes(f.key) ? prev.filter((k) => k !== f.key) : [...prev, f.key])} />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="export-checkbox-summary">
              {exportFields.length} فیلد انتخاب شده
            </div>
          </div>
          <div className="export-summary">
            {(() => {
              let rows = pilgrims
              if (exportFilters.statuses.length) rows = rows.filter((p) => exportFilters.statuses.includes(p.status))
              if (exportFilters.travelTypes.length) rows = rows.filter((p) => exportFilters.travelTypes.includes(p.travelType))
              if (exportFilters.genders.length) rows = rows.filter((p) => exportFilters.genders.includes(p.gender))
              if (exportFilters.caravans.length) rows = rows.filter((p) => exportFilters.caravans.includes(p.caravanNumber))
              const selected = []
              if (exportFilters.statuses.length) selected.push(`وضعیت: ${exportFilters.statuses.join('، ')}`)
              if (exportFilters.travelTypes.length) selected.push(`نوع سفر: ${exportFilters.travelTypes.join('، ')}`)
              if (exportFilters.genders.length) selected.push(`جنسیت: ${exportFilters.genders.join('، ')}`)
              if (exportFilters.caravans.length) selected.push(`کاروان: ${exportFilters.caravans.join('، ')}`)
              return (
                <>
                  <div className="export-summary-count">{rows.length} زائر انتخاب شده</div>
                  {selected.length > 0 && <div className="export-summary-detail">{selected.join(' | ')}</div>}
                  <div className="export-namelist">
                    {rows.map((p, i) => (
                      <span key={p.id} className="export-name">{i + 1}. {p.fullName} {p.lastName}</span>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!previewPdfUrl}
        onClose={() => { URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null) }}
        title="پیش‌نمایش"
        size="xl"
        footer={
          <button className="btn btn-primary" onClick={() => { URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); executeExport() }}><FiDownload /> دانلود همین فایل</button>
        }
      >
        <embed src={previewPdfUrl} type="application/pdf" style={{ width: '100%', height: 500, borderRadius: 8 }} />
      </Modal>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="حذف زائر"
        message="آیا از حذف این زائر اطمینان دارید؟"
      />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="text-muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{value || '-'}</div>
    </div>
  )
}
