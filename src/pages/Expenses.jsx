import { useMemo, useState } from 'react'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiTrendingDown, FiDollarSign, FiDownload, FiFileText,
} from 'react-icons/fi'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useTableState } from '../utils/useTableState'
import { storage, generateId } from '../utils/storage'
import Modal from '../components/common/Modal'
import ConfirmModal from '../components/common/ConfirmModal'
import Pagination from '../components/common/Pagination'
import EmptyState from '../components/common/EmptyState'
import StatCard from '../components/common/StatCard'
import { formatCurrency, formatJalali, todayISO, toPersianDigits } from '../utils/dateUtils'
import { exportToExcel } from '../utils/excelExport'
import { exportTableToPDF } from '../utils/pdfExport'

// ─── کلید ذخیره‌سازی مصارف در LocalStorage ───
const EXPENSES_KEY = 'hums_expenses'

const CATEGORIES = [
  'نان و خوراکه',
  'ترانسپورت',
  'معاش کارمندان',
  'کرایه دفتر',
  'برق و آب',
  'قرطاسیه و لوازم',
  'تلیفون و انترنت',
  'تبلیغات',
  'تعمیرات',
  'خریداری تجهیزات',
  'سایر مصارف',
  'عاید متفرقه',
]



const EMPTY_FORM = {
  date: todayISO(),
  type: 'مصرف',
  category: 'نان و خوراکه',
  person: '',
  amount: '',
  description: '',
  currency: 'افغانی',
}

function getExpenses() {
  return storage.getAll(EXPENSES_KEY)
}
function saveExpenses(list) {
  storage.saveAll(EXPENSES_KEY, list)
}

export default function Expenses() {
  const { showToast } = useToast()
  const { can } = useAuth()
  const [expenses, setExpenses] = useState(() => getExpenses())

  const table = useTableState(expenses, {
    searchFields: ['person', 'description', 'category'],
    pageSize: 10,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, type: 'مصرف' })
  const [errors, setErrors] = useState({})
  const [confirmId, setConfirmId] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const allCategories = useMemo(() => {
    const custom = expenses.map((e) => e.category).filter(Boolean)
    return [...new Set([...CATEGORIES, ...custom])]
  }, [expenses])
  const dateFiltered = useMemo(() => {
    let list = table.filtered
    if (dateFrom) list = list.filter((e) => e.date >= dateFrom)
    if (dateTo) list = list.filter((e) => e.date <= dateTo)
    return list
  }, [table.filtered, dateFrom, dateTo])

  // ─── محاسبات کلی ───
  const totalExpense = expenses
    .filter((e) => e.type === 'مصرف')
    .reduce((s, e) => s + Number(e.amount || 0), 0)


  const todayExpense = expenses
    .filter((e) => e.date === todayISO() && e.type === 'مصرف')
    .reduce((s, e) => s + Number(e.amount || 0), 0)

  // ─── باز کردن مودال ───
  function openAdd() {
    setForm({ ...EMPTY_FORM, type: 'مصرف' })
    setEditId(null)
    setErrors({})
    setModalOpen(true)
  }
  function openEdit(item) {
    setForm(item)
    setEditId(item.id)
    setErrors({})
    setModalOpen(true)
  }

  // ─── اعتبارسنجی ───
  function validate() {
    const errs = {}
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'مبلغ معتبر وارد کنید'
    if (!form.date) errs.date = 'تاریخ الزامی است'
    if (!form.description.trim()) errs.description = 'توضیح الزامی است'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ─── ذخیره ───
  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    let updated
    if (editId) {
      updated = expenses.map((x) => (x.id === editId ? { ...x, ...form } : x))
      showToast('مصرف/عاید بروزرسانی شد', 'success')
    } else {
      const newItem = { ...form, id: generateId(), createdAt: new Date().toISOString() }
      updated = [newItem, ...expenses]
      showToast('مصرف ثبت شد', 'success')
    }

    saveExpenses(updated)
    setExpenses(updated)
    setModalOpen(false)
  }

  // ─── حذف ───
  function handleDelete() {
    const updated = expenses.filter((x) => x.id !== confirmId)
    saveExpenses(updated)
    setExpenses(updated)
    showToast('آیتم حذف شد', 'error')
  }

  // ─── خروجی Excel ───
  function handleExcel() {
    exportToExcel({
      sheetName: 'Expenses',
      fileName: 'expenses.xlsx',
      rows: dateFiltered.map((e) => ({
        تاریخ: e.date,
        نوع: e.type,
        کتگوری: e.category,
        شخص: e.person || '-',
        مبلغ: e.amount,
        توضیح: e.description,
      })),
    })
  }

  // ─── خروجی PDF ───
  function handlePDF() {
    exportTableToPDF({
      title: 'Expenses & Income Report',
      fileName: 'expenses-report.pdf',
      columns: ['Date', 'Type', 'Category', 'Person', 'Amount', 'Description'],
      rows: dateFiltered.map((e) => [
        e.date, e.type, e.category, e.person || '-', e.amount, e.description,
      ]),
    })
  }

  // ─── رنگ ردیف ───
  function rowStyle(type) {
    return type === 'مصرف'
      ? { borderRight: '3px solid var(--danger)' }
      : { borderRight: '3px solid var(--success)' }
  }

  return (
    <div>
      {/* ─── کارت‌های آماری ─── */}
      <div className="stats-grid">
        <StatCard
          icon={<FiTrendingDown />}
          label="مجموع مصارف"
          value={formatCurrency(totalExpense)}
          color="var(--danger)"
        />

        <StatCard
          icon={<FiTrendingDown />}
          label="مصارف امروز"
          value={formatCurrency(todayExpense)}
          color="#b8860b"
        />
      </div>

      {/* ─── جدول ─── */}
      <div className="card">
        <div className="card-header">
          <h3>دفتر مصارف و عواید ({toPersianDigits(dateFiltered.length)})</h3>
          <div className="toolbar">
            <div className="search-box">
              <FiSearch />
              <input
                placeholder="جستجو: شخص، توضیح، کتگوری..."
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
              />
            </div>

            <select
              className="select-input"
              onChange={(e) => table.setFilter('category', e.target.value)}
            >
              <option value="all">همه کتگوری‌ها</option>
                {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              className="date-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="از تاریخ"
              placeholder="از تاریخ"
            />
            <input
              type="date"
              className="date-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="تا تاریخ"
              placeholder="تا تاریخ"
            />
          </div>
        </div>

        {/* دکمه‌های اکشن */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)' }}>
          {can('expenses', 'create') && <button className="btn btn-danger" onClick={() => openAdd('مصرف')}>
            <FiPlus /> ثبت مصرف
          </button>}
          <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={handlePDF}>
              <FiFileText /> PDF
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleExcel}>
              <FiDownload /> Excel
            </button>
          </div>
        </div>

        {dateFiltered.length === 0 ? (
          <EmptyState
            title="مصرفی ثبت نشده"
            description="اولین مصرف یا عاید را ثبت کنید."
            action={
              can('expenses', 'create') && <button className="btn btn-primary" onClick={() => openAdd('مصرف')}>
                <FiPlus /> ثبت مصرف
              </button>
            }
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>نوع</th>
                  <th>کتگوری</th>
                  <th>شخص / منبع</th>
                  <th>مبلغ</th>
                  <th>توضیح</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {dateFiltered
                  .slice((table.page - 1) * table.pageSize, table.page * table.pageSize)
                  .map((item) => (
                    <tr key={item.id} style={rowStyle(item.type)}>
                      <td>{formatJalali(item.date)}</td>
                      <td>
                        <span className={`badge ${item.type === 'مصرف' ? 'badge-danger' : 'badge-success'}`}>
                          {item.type === 'مصرف' ? '↓ ' : '↑ '}{item.type}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-primary">{item.category}</span>
                      </td>
                      <td>{item.person || <span className="text-muted">—</span>}</td>
                      <td className="fw-bold" style={{ color: item.type === 'مصرف' ? 'var(--danger)' : 'var(--success)' }}>
                        {item.type === 'مصرف' ? '- ' : '+ '}{formatCurrency(item.amount, item.currency)}
                      </td>
                      <td className="text-muted" style={{ fontSize: 13 }}>{item.description}</td>
                      <td>
                        <div className="row-actions">
                          {can('expenses', 'edit') && <button className="edit-btn" onClick={() => openEdit(item)} title="ویرایش">
                            <FiEdit2 />
                          </button>}
                          {can('expenses', 'delete') && <button className="delete-btn" onClick={() => setConfirmId(item.id)} title="حذف">
                            <FiTrash2 />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* جمع‌بندی انتهای جدول */}
        {dateFiltered.length > 0 && (
          <div style={{
            padding: '14px 20px',
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            fontSize: 13.5,
          }}>
            <span>
              مجموع مصارف فیلترشده:{' '}
              <strong style={{ color: 'var(--danger)' }}>
                {formatCurrency(dateFiltered.filter(e => e.type === 'مصرف').reduce((s, e) => s + Number(e.amount || 0), 0))}
              </strong>
            </span>

          </div>
        )}

        <Pagination
          page={table.page}
          totalPages={Math.max(1, Math.ceil(dateFiltered.length / table.pageSize))}
          onChange={table.setPage}
          totalItems={dateFiltered.length}
          pageSize={table.pageSize}
        />
      </div>

      {/* ─── مودال ثبت/ویرایش ─── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'ویرایش مصرف' : 'ثبت مصرف جدید'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>انصراف</button>
            <button
              className="btn btn-danger"
              onClick={handleSubmit}
            >
              {editId ? 'ذخیره تغییرات' : 'ثبت مصرف'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>


          <div className="form-grid">
            <div className="form-field">
              <label>تاریخ</label>
              <input
                type="date"
                className="date-input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              {errors.date && <span className="error-text">{errors.date}</span>}
            </div>

            <div className="form-field">
              <label>مبلغ</label>
              <div className="input-with-currency">
                <input
                  type="number"
                  className="text-input"
                  placeholder="مثال: 500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
                <select className="currency-select" title="انتخاب ارز" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="افغانی">افغانی</option>
                  <option value="دالر">دالر</option>
                </select>
              </div>
              {errors.amount && <span className="error-text">{errors.amount}</span>}
            </div>

            <div className="form-field">
              <label>کتگوری</label>
              <input
                className="text-input"
                list="category-list"
                placeholder="انتخاب یا تایپ کنید..."
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="category-list">
              {allCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="form-field">
              <label>شخص / منبع</label>
              <input
                className="text-input"
                placeholder="مثال: احمد، دکان نان، شرکت برشنا..."
                value={form.person}
                onChange={(e) => setForm({ ...form, person: e.target.value })}
              />
            </div>

            <div className="form-field full">
              <label>توضیح</label>
              <input
                className="text-input"
                placeholder="مثال: نان صبحانه برای کارمندان، کرایه موتر..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              {errors.description && <span className="error-text">{errors.description}</span>}
            </div>
          </div>
        </form>
      </Modal>

      {/* ─── مودال تایید حذف ─── */}
      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="حذف آیتم"
        message="آیا از حذف این آیتم اطمینان دارید؟"
      />
    </div>
  )
}
