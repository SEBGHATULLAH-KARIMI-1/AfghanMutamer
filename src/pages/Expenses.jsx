import { useMemo, useState } from 'react'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiTrendingDown, FiDownload, FiFileText,
} from 'react-icons/fi'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useTableState } from '../utils/useTableState'
import { useData } from '../contexts/DataContext'
import Modal from '../components/common/Modal'
import ConfirmModal from '../components/common/ConfirmModal'
import Pagination from '../components/common/Pagination'
import EmptyState from '../components/common/EmptyState'
import StatCard from '../components/common/StatCard'
import { currencyKey } from '../utils/finance'
import { formatCurrency, formatJalali, todayISO, toPersianDigits } from '../utils/dateUtils'
import { exportToExcel } from '../utils/excelExport'
import { exportTableToPDF } from '../utils/pdfExport'

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
]

const EMPTY_FORM = {
  date: '',
  type: 'مصرف',
  category: 'نان و خوراکه',
  person: '',
  amount: '',
  description: '',
  currency: 'افغانی',
}

// جمع مصارف به تفکیک ارز (دالر و افغانی هیچ‌وقت با هم جمع نمی‌شوند)
function sumExpenses(list) {
  const sum = { usd: 0, afn: 0 }
  list.forEach((e) => {
    if (e.type === 'مصرف') sum[currencyKey(e.currency)] += Number(e.amount) || 0
  })
  return sum
}

export default function Expenses() {
  const { showToast } = useToast()
  const { can } = useAuth()
  const { expenses, addExpense, updateExpense, deleteExpense } = useData()

  const table = useTableState(expenses, {
    searchFields: ['person', 'description', 'category'],
    pageSize: 10,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, date: todayISO() })
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

  const totalPages = Math.max(1, Math.ceil(dateFiltered.length / table.pageSize))
  const page = Math.min(table.page, totalPages)

  // ─── محاسبات کلی (هر ارز جداگانه) ───
  const totalExpense = useMemo(() => sumExpenses(expenses), [expenses])
  const todayExpense = useMemo(() => {
    const today = todayISO()
    return sumExpenses(expenses.filter((e) => e.date === today))
  }, [expenses])
  const filteredExpense = useMemo(() => sumExpenses(dateFiltered), [dateFiltered])

  // ─── باز کردن مودال ───
  function openAdd() {
    setForm({ ...EMPTY_FORM, date: todayISO() })
    setEditId(null)
    setErrors({})
    setModalOpen(true)
  }
  function openEdit(item) {
    setForm({ ...EMPTY_FORM, ...item })
    setEditId(item.id)
    setErrors({})
    setModalOpen(true)
  }

  // ─── اعتبارسنجی ───
  function validate() {
    const errs = {}
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'مبلغ معتبر وارد کنید'
    if (!form.date) errs.date = 'تاریخ الزامی است'
    if (!String(form.description || '').trim()) errs.description = 'توضیح الزامی است'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ─── ذخیره ───
  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    const payload = { ...form, amount: Number(form.amount) }
    if (editId) {
      updateExpense(editId, payload)
      showToast('مصرف بروزرسانی شد', 'success')
    } else {
      addExpense(payload)
      showToast('مصرف ثبت شد', 'success')
    }
    setModalOpen(false)
  }

  // ─── حذف ───
  function handleDelete() {
    deleteExpense(confirmId)
    showToast('آیتم حذف شد', 'error')
  }

  // ─── خروجی Excel ───
  async function handleExcel() {
    if (dateFiltered.length === 0) { showToast('داده‌ای برای خروجی وجود ندارد', 'error'); return }
    try {
      await exportToExcel({
        sheetName: 'مصارف',
        fileName: `expenses-${Date.now()}.xlsx`,
        rows: dateFiltered.map((e) => ({
          تاریخ: formatJalali(e.date),
          نوع: e.type,
          کتگوری: e.category,
          شخص: e.person || '-',
          مبلغ: Number(e.amount) || 0,
          ارز: e.currency || 'افغانی',
          توضیح: e.description || '',
        })),
      })
      showToast('خروجی Excel با موفقیت دریافت شد', 'success')
    } catch {
      showToast('خطا در تولید فایل Excel', 'error')
    }
  }

  // ─── خروجی PDF ───
  async function handlePDF() {
    if (dateFiltered.length === 0) { showToast('داده‌ای برای خروجی وجود ندارد', 'error'); return }
    try {
      await exportTableToPDF({
        title: 'گزارش مصارف',
        fileName: `expenses-report-${Date.now()}.pdf`,
        columns: ['تاریخ', 'نوع', 'کتگوری', 'شخص', 'مبلغ', 'توضیح'],
        rows: dateFiltered.map((e) => [
          formatJalali(e.date), e.type, e.category, e.person || '-',
          formatCurrency(e.amount, e.currency), e.description || '',
        ]),
      })
      showToast('خروجی PDF با موفقیت دریافت شد', 'success')
    } catch {
      showToast('خطا در تولید فایل PDF', 'error')
    }
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
          label="مجموع مصارف (دالر)"
          value={formatCurrency(totalExpense.usd, 'دالر')}
          color="var(--danger)"
        />
        <StatCard
          icon={<FiTrendingDown />}
          label="مجموع مصارف (افغانی)"
          value={formatCurrency(totalExpense.afn, 'افغانی')}
          color="#a93226"
        />
        <StatCard
          icon={<FiTrendingDown />}
          label="مصارف امروز (دالر)"
          value={formatCurrency(todayExpense.usd, 'دالر')}
          color="#b8860b"
        />
        <StatCard
          icon={<FiTrendingDown />}
          label="مصارف امروز (افغانی)"
          value={formatCurrency(todayExpense.afn, 'افغانی')}
          color="#8a6508"
        />
      </div>

      {/* ─── جدول ─── */}
      <div className="card">
        <div className="card-header">
          <h3>دفتر مصارف ({toPersianDigits(dateFiltered.length)})</h3>
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
              onChange={(e) => { setDateFrom(e.target.value); table.setPage(1) }}
              title="از تاریخ"
              placeholder="از تاریخ"
            />
            <input
              type="date"
              className="date-input"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); table.setPage(1) }}
              title="تا تاریخ"
              placeholder="تا تاریخ"
            />
          </div>
        </div>

        {/* دکمه‌های اکشن */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)' }}>
          {can('expenses', 'create') && <button className="btn btn-danger" onClick={openAdd}>
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
            description="اولین مصرف را ثبت کنید."
            action={
              can('expenses', 'create') && <button className="btn btn-primary" onClick={openAdd}>
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
                  .slice((page - 1) * table.pageSize, page * table.pageSize)
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

        {/* جمع‌بندی انتهای جدول (به تفکیک ارز) */}
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
              مجموع مصارف فیلترشده (دالر):{' '}
              <strong style={{ color: 'var(--danger)' }}>{formatCurrency(filteredExpense.usd, 'دالر')}</strong>
            </span>
            <span>
              مجموع مصارف فیلترشده (افغانی):{' '}
              <strong style={{ color: 'var(--danger)' }}>{formatCurrency(filteredExpense.afn, 'افغانی')}</strong>
            </span>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
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
