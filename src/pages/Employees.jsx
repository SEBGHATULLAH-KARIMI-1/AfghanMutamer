import { useState } from 'react'
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiUser } from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useTableState } from '../utils/useTableState'
import Modal from '../components/common/Modal'
import ConfirmModal from '../components/common/ConfirmModal'
import Pagination from '../components/common/Pagination'
import EmptyState from '../components/common/EmptyState'
import { formatCurrency, toPersianDigits } from '../utils/dateUtils'

const EMPTY_FORM = {
  employeeCode: '', name: '', position: 'اپراتور', phone: '', email: '',
  salary: '', joinDate: '', status: 'فعال', photo: '', currency: 'افغانی',
}

export default function Employees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useData()
  const { showToast } = useToast()
  const { can } = useAuth()

  const table = useTableState(employees, { searchFields: ['name', 'phone', 'email', 'employeeCode'], pageSize: 8 })

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [confirmId, setConfirmId] = useState(null)

  function openAdd() {
    setForm({ ...EMPTY_FORM, employeeCode: 'EMP-' + Math.floor(1000 + Math.random() * 8999) })
    setEditId(null)
    setErrors({})
    setModalOpen(true)
  }
  function openEdit(emp) {
    setForm(emp)
    setEditId(emp.id)
    setErrors({})
    setModalOpen(true)
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, photo: reader.result }))
    reader.readAsDataURL(file)
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'نام الزامی است'
    if (!form.phone.trim()) errs.phone = 'شماره تماس الزامی است'
    if (!form.salary) errs.salary = 'معاش الزامی است'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    if (editId) {
      updateEmployee(editId, form)
      showToast('اطلاعات کارمند بروزرسانی شد', 'success')
    } else {
      addEmployee(form)
      showToast('کارمند جدید اضافه شد', 'success')
    }
    setModalOpen(false)
  }

  function handleDelete() {
    deleteEmployee(confirmId)
    showToast('کارمند حذف شد', 'error')
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>فهرست کارمندان ({toPersianDigits(table.totalItems)})</h3>
          <div className="toolbar">
            <div className="search-box">
              <FiSearch />
              <input placeholder="جستجو بر اساس نام یا شماره تماس..." value={table.search} onChange={(e) => table.setSearch(e.target.value)} />
            </div>
            <select className="select-input" onChange={(e) => table.setFilter('position', e.target.value)}>
              <option value="all">همه سمت‌ها</option>
              <option value="مدیر سیستم">مدیر سیستم</option>
              <option value="حسابدار">حسابدار</option>
              <option value="اپراتور">اپراتور</option>
              <option value="رهنما">رهنما</option>
            </select>
            {can('employees', 'create') && <button className="btn btn-primary" onClick={openAdd}><FiPlus /> افزودن کارمند</button>}
          </div>
        </div>

        {table.paginated.length === 0 ? (
          <EmptyState title="کارمندی یافت نشد" />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>عکس</th>
                  <th>کد کارمند</th>
                  <th>نام</th>
                  <th>سمت</th>
                  <th>تماس</th>
                  <th>معاش</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {table.paginated.map((emp) => (
                  <tr key={emp.id}>
                    <td><div className="avatar-cell">{emp.photo ? <img src={emp.photo} alt="" /> : (emp.name?.charAt(0) || <FiUser />)}</div></td>
                    <td>{emp.employeeCode}</td>
                    <td>{emp.name}</td>
                    <td><span className="badge badge-primary">{emp.position}</span></td>
                    <td>{emp.phone}</td>
                    <td>{formatCurrency(emp.salary, emp.currency)}</td>
                    <td><span className={`badge ${emp.status === 'فعال' ? 'badge-success' : 'badge-danger'}`}>{emp.status}</span></td>
                    <td>
                      <div className="row-actions">
                        {can('employees', 'edit') && <button className="edit-btn" onClick={() => openEdit(emp)} title="ویرایش"><FiEdit2 /></button>}
                        {can('employees', 'delete') && <button className="delete-btn" onClick={() => setConfirmId(emp.id)} title="حذف"><FiTrash2 /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={table.page} totalPages={table.totalPages} onChange={table.setPage} totalItems={table.totalItems} pageSize={table.pageSize} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'ویرایش کارمند' : 'افزودن کارمند جدید'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>انصراف</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? 'ذخیره تغییرات' : 'افزودن کارمند'}</button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <div className="profile-photo">{form.photo ? <img src={form.photo} alt="" /> : <FiUser />}</div>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              آپلود عکس
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            </label>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>کد کارمند</label>
              <input className="text-input" value={form.employeeCode} disabled />
            </div>
            <div className="form-field">
              <label>نام کامل</label>
              <input className="text-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>
            <div className="form-field">
              <label>سمت</label>
              <select className="select-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                <option value="مدیر سیستم">مدیر سیستم</option>
                <option value="حسابدار">حسابدار</option>
                <option value="اپراتور">اپراتور</option>
                <option value="رهنما">رهنما</option>
              </select>
            </div>
            <div className="form-field">
              <label>شماره تماس</label>
              <input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {errors.phone && <span className="error-text">{errors.phone}</span>}
            </div>
            <div className="form-field">
              <label>ایمیل</label>
              <input type="email" className="text-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-field">
              <label>معاش</label>
              <div className="input-with-currency">
                <input type="number" className="text-input" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
                <select className="currency-select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="افغانی">افغانی</option>
                  <option value="دالر">دالر</option>
                </select>
              </div>
              {errors.salary && <span className="error-text">{errors.salary}</span>}
            </div>
            <div className="form-field">
              <label>تاریخ استخدام</label>
              <input type="date" className="date-input" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <select className="select-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="فعال">فعال</option>
                <option value="غیرفعال">غیرفعال</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={handleDelete} title="حذف کارمند" message="آیا از حذف این کارمند اطمینان دارید؟" />
    </div>
  )
}
