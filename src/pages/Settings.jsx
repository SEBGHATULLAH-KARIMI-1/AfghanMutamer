import { useRef, useState, useEffect } from 'react'
import { FiSave, FiUpload, FiDownload, FiMoon, FiSun, FiUserPlus, FiKey, FiDroplet, FiShield, FiTrash2, FiEdit2, FiPlus, FiX, FiType } from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { api, apiErrorMessage } from '../utils/api'
import { checkIntegrity } from '../utils/integrity'
import { compressImage } from '../utils/image'
import { todayISO } from '../utils/dateUtils'
import Modal from '../components/common/Modal'
import { useAuth } from '../contexts/AuthContext'

const COLOR_THEMES = [
  { key: 'default', label: 'سبز / طلایی', colors: ['#0F5132', '#D4AF37'] },
  { key: 'blue', label: 'آبی / نقره‌ای', colors: ['#1A365D', '#A0AEC0'] },
  { key: 'emerald', label: 'زمرد / کهربایی', colors: ['#064E3B', '#F59E0B'] },
  { key: 'burgundy', label: 'یاقوتی / طلایی', colors: ['#7B1A1A', '#D4AF37'] },
  { key: 'slate', label: 'تیره / نقره‌ای', colors: ['#334155', '#94A3B8'] },
  { key: 'rose', label: 'گلی / صورتی', colors: ['#881337', '#FBCFE8'] },
  { key: 'navy', label: 'دریایی / طلایی', colors: ['#1E3A5F', '#E8C547'] },
  { key: 'forest', label: 'جنگی / نارنجی', colors: ['#2D5016', '#E67E22'] },
]

const SIDEBAR_STYLES = [
  { key: 'gradient', label: 'گرادینت' },
  { key: 'solid', label: 'تک‌رنگ' },
  { key: 'glass', label: 'شیشه‌ای' },
]

const FONT_SIZES = [
  { key: 'small', label: 'کوچک', desc: '12px' },
  { key: 'medium', label: 'متوسط', desc: '13.5px' },
  { key: 'large', label: 'بزرگ', desc: '15px' },
  { key: 'xlarge', label: 'خیلی بزرگ', desc: '16.5px' },
]

const FONT_WEIGHTS = [
  { key: 'normal', label: 'نازک', desc: '400' },
  { key: 'medium', label: 'متوسط', desc: '500' },
  { key: 'semibold', label: 'نیمه‌پررنگ', desc: '600' },
  { key: 'bold', label: 'پررنگ', desc: '700' },
]

const FONT_FAMILIES = [
  { key: 'vazir', label: 'وزیرمتن', desc: 'Vazirmatn' },
  { key: 'notosans', label: 'نوتو سنس', desc: 'Noto Sans Arabic' },
  { key: 'naskh', label: 'نسخ', desc: 'Noto Naskh Arabic' },
  { key: 'cairo', label: 'کایرو', desc: 'Cairo' },
]

const PAGE_LABELS = {
  dashboard: 'داشبورد',
  pilgrims: 'زائران',
  payments: 'پرداخت‌ها',
  reports: 'گزارش‌ها',
  employees: 'کارمندان',
  expenses: 'مصارف',
  companies: 'شرکت‌ها',
  settings: 'تنظیمات',
}

const ACTION_LABELS = {
  view: 'مشاهده',
  create: 'ایجاد',
  edit: 'ویرایش',
  delete: 'حذف',
  export: 'خروجی',
}

const DEFAULT_PERMISSIONS = {
  dashboard: { view: false },
  pilgrims: { view: false, create: false, edit: false, delete: false },
  payments: { view: false, create: false, edit: false, delete: false },
  reports: { view: false, export: false },
  employees: { view: false, create: false, edit: false, delete: false },
  expenses: { view: false, create: false, edit: false, delete: false },
  companies: { view: false, create: false, edit: false, delete: false },
  settings: { view: false },
}

const TABS = [
  { key: 'general', label: 'تنظیمات عمومی' },
  { key: 'appearance', label: 'ظاهر و تم' },
  { key: 'users', label: 'مدیریت کاربران' },
  { key: 'roles', label: 'نقش‌ها' },
  { key: 'system', label: 'تنظیمات سیستم' },
]

export default function Settings() {
  const { settings, updateSettings, pilgrims, payments, companies, employees } = useData()
  const { theme, toggleTheme, appearance, updateAppearance } = useTheme()
  const { showToast } = useToast()
  const { user: currentUser, refreshAuth } = useAuth()
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState(settings || {})
  const fileInputRef = useRef(null)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: '' })
  const [editingUser, setEditingUser] = useState(null)
  const [integrity, setIntegrity] = useState(null)
  const [roles, setRoles] = useState([])
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', label: '', permissions: DEFAULT_PERMISSIONS })
  const [users, setUsers] = useState([])
  const [page, setPage] = useState('dashboard')

  async function refreshRoles() {
    try { setRoles(await api('/roles')) } catch (e) { showToast(apiErrorMessage(e), 'error') }
  }

  async function refreshUsers() {
    try { setUsers(await api('/users')) } catch (e) { showToast(apiErrorMessage(e), 'error') }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshRoles(); refreshUsers() }, [])

  function userCountForRole(roleName) {
    return users.filter((u) => u.role === roleName).length
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const logo = await compressImage(file)
      setForm((f) => ({ ...f, logo }))
    } catch {
      showToast('فایل عکس معتبر نیست', 'error')
    }
  }

  function handleSaveGeneral() {
    if (form.phone && String(form.phone).replace(/\D/g, '').length < 7) { showToast('شماره تماس معتبر نیست', 'error'); return }
    if (form.email && !/^\S+@\S+\.\S+$/.test(String(form.email).trim())) { showToast('ایمیل معتبر نیست', 'error'); return }
    // فقط فیلدهای همین تب ذخیره می‌شوند تا تنظیمات دیگر (مثل ارز نمایش) با مقدار قدیمی بازنویسی نشوند
    updateSettings({
      companyName: form.companyName || '',
      phone: form.phone || '',
      address: form.address || '',
      email: form.email || '',
      logo: form.logo,
    })
    showToast('تنظیمات عمومی ذخیره شد', 'success')
  }

  async function handleBackup() {
    let backup
    try { backup = await api('/backup') } catch (e) { showToast(apiErrorMessage(e), 'error'); return }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hajj-umrah-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('فایل پشتیبان دانلود شد', 'success')
  }

  function openNewUser() {
    setEditingUser(null)
    setNewUser({ username: '', password: '', name: '', role: '' })
    setUserModalOpen(true)
  }

  function openEditUser(u) {
    setEditingUser(u)
    setNewUser({ username: u.username, password: '', name: u.name, role: u.role })
    setUserModalOpen(true)
  }

  async function handleSaveUser() {
    const username = newUser.username.trim()
    const name = newUser.name.trim()
    if (!username || !name || !newUser.role || (!editingUser && !newUser.password)) {
      showToast('لطفا تمامی فیلدها را تکمیل کنید', 'error')
      return
    }
    if (newUser.password && newUser.password.length < 6) {
      showToast('رمز عبور باید حداقل ۶ کاراکتر باشد', 'error')
      return
    }
    try {
      const body = { username, name, role: newUser.role, password: newUser.password }
      if (editingUser) {
        await api(`/users/${editingUser.id}`, { method: 'PUT', body })
        showToast('اطلاعات کاربر بروزرسانی شد', 'success')
      } else {
        await api('/users', { method: 'POST', body })
        showToast('کاربر جدید با موفقیت ایجاد شد', 'success')
      }
    } catch (e) {
      showToast(apiErrorMessage(e), 'error')
      return
    }
    setUserModalOpen(false)
    setEditingUser(null)
    refreshUsers()
    refreshAuth()
    setNewUser({ username: '', password: '', name: '', role: '' })
  }

  async function handleDeleteUser(u) {
    if (u.id === currentUser?.id) {
      showToast('نمی‌توانید حساب خودتان را حذف کنید', 'error')
      return
    }
    if (!confirm(`آیا از حذف کاربر «${u.name}» اطمینان دارید؟`)) return
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' })
    } catch (e) {
      showToast(apiErrorMessage(e), 'error')
      return
    }
    refreshUsers()
    refreshAuth()
    showToast('کاربر حذف شد', 'success')
  }

  function openNewRole() {
    setEditingRole(null)
    setRoleForm({ name: '', label: '', permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)) })
    setPage('dashboard')
    setRoleModalOpen(true)
  }

  function openEditRole(role) {
    setEditingRole(role)
    setRoleForm({ name: role.name, label: role.label, permissions: JSON.parse(JSON.stringify(role.permissions)) })
    setPage('dashboard')
    setRoleModalOpen(true)
  }

  function togglePagePerm(pageKey, action) {
    setRoleForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [pageKey]: {
          ...prev.permissions[pageKey],
          [action]: !prev.permissions[pageKey]?.[action],
        },
      },
    }))
  }

  function setAllView(pageKey, value) {
    const page = roleForm.permissions[pageKey]
    if (!page) return
    const updated = {}
    Object.keys(page).forEach((a) => { updated[a] = value })
    setRoleForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [pageKey]: updated },
    }))
  }

  async function handleSaveRole() {
    const name = roleForm.name.trim()
    const label = roleForm.label.trim()
    if (!name || !label) {
      showToast('نام و عنوان نقش را وارد کنید', 'error')
      return
    }
    if (roles.some((r) => r.id !== editingRole?.id && String(r.name).toLowerCase() === name.toLowerCase())) {
      showToast('این نام نقش قبلاً ثبت شده است', 'error')
      return
    }
    // محافظت از قفل شدن خود کاربر: نقشِ خودش را نمی‌تواند بازنامی کند یا دسترسی تنظیمات را از آن بگیرد
    if (editingRole && editingRole.name === currentUser?.role) {
      if (name !== editingRole.name) {
        showToast('نقش خودتان را نمی‌توانید بازنامی کنید', 'error')
        return
      }
      if (!roleForm.permissions.settings?.view) {
        showToast('نقش شما باید دسترسی «مشاهده» تنظیمات را حفظ کند؛ در غیر این صورت قفل می‌شوید', 'error')
        return
      }
    }
    try {
      const body = { name, label, permissions: roleForm.permissions }
      if (editingRole) {
        await api(`/roles/${editingRole.id}`, { method: 'PUT', body })
        // اگر نام نقش عوض شد، سرور کاربران آن نقش را هم هماهنگ می‌کند
        if (name !== editingRole.name) refreshUsers()
        showToast('نقش ویرایش شد', 'success')
      } else {
        await api('/roles', { method: 'POST', body })
        showToast('نقش جدید ایجاد شد', 'success')
      }
    } catch (e) {
      showToast(apiErrorMessage(e), 'error')
      return
    }
    refreshRoles()
    refreshAuth()
    setRoleModalOpen(false)
  }

  async function handleDeleteRole(role) {
    const count = userCountForRole(role.name)
    if (count > 0) {
      showToast(`امکان حذف نقش وجود ندارد. ${count} کاربر با این نقش ثبت شده است.`, 'error')
      return
    }
    if (!confirm(`آیا از حذف نقش «${role.label}» اطمینان دارید؟`)) return
    try {
      await api(`/roles/${role.id}`, { method: 'DELETE' })
    } catch (e) {
      showToast(apiErrorMessage(e), 'error')
      return
    }
    refreshRoles()
    refreshAuth()
    showToast('نقش حذف شد', 'success')
  }

  return (
    <div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="card">
          <div className="card-header"><h3>اطلاعات شرکت</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <div className="profile-photo">
                {form.logo ? <img src={form.logo} alt="logo" /> : 'لوگو'}
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current.click()}><FiUpload /> آپلود لوگو</button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            </div>
              <div className="form-grid">
                <div className="form-field"><label>نام شرکت</label><input className="text-input" value={form.companyName || ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="مثال: شرکت خدمات حج الفردوس" /></div>
                <div className="form-field"><label>شماره تماس</label><input className="text-input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="مثال: 0700123456" /></div>
                <div className="form-field full"><label>آدرس</label><input className="text-input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="مثال: کابل، افغانستان" /></div>
                <div className="form-field"><label>ایمیل</label><input type="email" className="text-input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="مثال: info@company.com" /></div>
              </div>
            <button className="btn btn-primary mt-3" onClick={handleSaveGeneral}><FiSave /> ذخیره تغییرات</button>
          </div>
        </div>
      )}

      {tab === 'appearance' && (
        <div className="card">
          <div className="card-header"><h3><FiDroplet /> رنگ‌بندی و تم</h3></div>
          <div className="card-body">
            <div className="mb-3">
              <div className="export-label mb-1">تم رنگی</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {COLOR_THEMES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => updateAppearance({ colorTheme: t.key })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                      border: appearance.colorTheme === t.key ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                      background: appearance.colorTheme === t.key ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex', gap: 3 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, background: t.colors[0], display: 'inline-block' }} />
                      <span style={{ width: 20, height: 20, borderRadius: 6, background: t.colors[1], display: 'inline-block' }} />
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <div className="export-label mb-1">استایل سایدبار</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {SIDEBAR_STYLES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => updateAppearance({ sidebarStyle: s.key })}
                    style={{
                      padding: '10px 18px', borderRadius: 12, cursor: 'pointer',
                      border: appearance.sidebarStyle === s.key ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                      background: appearance.sidebarStyle === s.key ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3" style={{ marginTop: 18 }}>
              <div className="export-label mb-1"><FiType /> اندازه قلم</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FONT_SIZES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => updateAppearance({ fontSize: s.key })}
                    style={{
                      padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                      border: appearance.fontSize === s.key ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                      background: appearance.fontSize === s.key ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      color: 'var(--color-text)', fontWeight: 600,
                    }}
                  >
                    {s.label}
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <div className="export-label mb-1">ضخامت قلم</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FONT_WEIGHTS.map((w) => (
                  <button
                    key={w.key}
                    onClick={() => updateAppearance({ fontWeight: w.key })}
                    style={{
                      padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                      border: appearance.fontWeight === w.key ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                      background: appearance.fontWeight === w.key ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      color: 'var(--color-text)', fontWeight: w.key === 'bold' ? 700 : w.key === 'semibold' ? 600 : w.key === 'medium' ? 500 : 400,
                    }}
                  >
                    {w.label}
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>{w.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <div className="export-label mb-1">فونت</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FONT_FAMILIES.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => updateAppearance({ fontFamily: f.key })}
                    style={{
                      padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                      border: appearance.fontFamily === f.key ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                      background: appearance.fontFamily === f.key ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      color: 'var(--color-text)', fontWeight: 600,
                    }}
                  >
                    {f.label}
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-between" style={{ padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: 12, fontSize: 13 }}>
              <span>حالت نمایش</span>
              <button className="btn btn-outline btn-sm" onClick={toggleTheme}>
                {theme === 'light' ? <><FiMoon /> حالت تاریک</> : <><FiSun /> حالت روشن</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <h3>مدیریت کاربران</h3>
            <button className="btn btn-primary btn-sm" onClick={openNewUser}><FiUserPlus /> کاربر جدید</button>
          </div>
          <div className="card-body">
            {users.length === 0 ? (
              <p className="text-muted">هیچ کاربری یافت نشد</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>نام</th>
                      <th>نام کاربری</th>
                      <th>نقش</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const roleObj = roles.find((r) => r.name === u.role)
                      return (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.username}</td>
                          <td><span className="badge badge-primary">{roleObj?.label || u.role}</span></td>
                          <td>
                            <div className="row-actions">
                              <button className="edit-btn" onClick={() => openEditUser(u)} title="ویرایش"><FiEdit2 /></button>
                              <button className="delete-btn" onClick={() => handleDeleteUser(u)} title="حذف"><FiTrash2 /></button>
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
        </div>
      )}

      {tab === 'roles' && (
        <div className="card">
          <div className="card-header">
            <h3><FiShield /> مدیریت نقش‌ها</h3>
            <button className="btn btn-primary btn-sm" onClick={openNewRole}><FiPlus /> نقش جدید</button>
          </div>
          <div className="card-body">
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              برای هر نقش مشخص کنید که به کدام صفحات و عملیات‌ها دسترسی داشته باشد. نقش‌هایی که کاربر فعال دارند قابل حذف نیستند.
            </p>
            {roles.length === 0 ? (
              <p className="text-muted">هیچ نقشی تعریف نشده است</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>نام نقش</th>
                      <th>عنوان</th>
                      <th>کاربران</th>
                      <th>دسترسی‌ها</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => {
                      const accessiblePages = Object.entries(role.permissions)
                        .filter(([, perms]) => perms.view)
                        .map(([key]) => PAGE_LABELS[key] || key)
                      const userCount = userCountForRole(role.name)
                      return (
                        <tr key={role.id}>
                          <td><strong>{role.name}</strong></td>
                          <td>{role.label}</td>
                          <td><span className="badge badge-info">{userCount} نفر</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {accessiblePages.length === 0
                                ? <span className="text-muted" style={{ fontSize: 12 }}>بدون دسترسی</span>
                                : accessiblePages.map((p) => <span key={p} className="badge badge-success" style={{ fontSize: 11 }}>{p}</span>)
                              }
                            </div>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button className="edit-btn" onClick={() => openEditRole(role)} title="ویرایش"><FiEdit2 /></button>
                              <button className="delete-btn" onClick={() => handleDeleteRole(role)} title="حذف"><FiTrash2 /></button>
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
        </div>
      )}

      {tab === 'system' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h3>زبان و نمایش</h3></div>
            <div className="card-body">
              <div className="form-field mb-2">
                <label>زبان سیستم (فعلاً فقط فارسی / دری)</label>
                <select className="select-input" disabled>
                  <option value="fa">فارسی / دری</option>
                </select>
              </div>
              <div className="form-field mb-2">
                <label>ارز پیش‌فرض نمایش</label>
                <select className="select-input" value={settings.displayCurrency || 'دالر'} onChange={(e) => updateSettings({ displayCurrency: e.target.value })}>
                  <option value="دالر">دالر</option>
                  <option value="افغانی">افغانی</option>
                </select>
                <span style={{ fontSize: 11, color: '#667085' }}>ارز پیش‌فرض نمودار درآمد در داشبورد. کارت‌ها دالر و افغانی را جداگانه نشان می‌دهند</span>
              </div>
              <div className="flex-between">
                <span style={{ fontSize: 13.5 }}>حالت نمایش</span>
                <button className="btn btn-outline btn-sm" onClick={toggleTheme}>
                  {theme === 'light' ? <><FiMoon /> فعال‌سازی حالت تاریک</> : <><FiSun /> فعال‌سازی حالت روشن</>}
                </button>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>بررسی یکپارچگی داده‌ها</h3></div>
            <div className="card-body">
              <p className="text-muted" style={{ fontSize: 13 }}>ارتباط زائران، شرکت‌ها، پرداخت‌ها، کاربران و نقش‌ها را بررسی می‌کند و موارد ناسازگار را گزارش می‌دهد. چیزی تغییر نمی‌کند.</p>
              <button className="btn btn-outline mt-2" onClick={() => setIntegrity(checkIntegrity({ pilgrims, payments, companies, employees, users, roles }))}><FiShield /> اجرای بررسی</button>
              {integrity && (
                integrity.length === 0 ? (
                  <div style={{ marginTop: 14, fontSize: 13, color: 'var(--success)' }}>✅ مشکلی پیدا نشد؛ همه‌ی ارتباط‌ها درست است.</div>
                ) : (
                  <ul style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {integrity.map((it, i) => (
                      <li key={i} style={{ fontSize: 13 }}>
                        <div className="fw-bold">{it.level === 'error' ? '❌' : it.level === 'warning' ? '⚠️' : 'ℹ️'} {it.title} ({it.count})</div>
                        {it.samples.length > 0 && (
                          <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{it.samples.join('، ')}{it.count > it.samples.length ? ' ...' : ''}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>پشتیبان‌گیری از اطلاعات</h3></div>
            <div className="card-body">
              <p className="text-muted" style={{ fontSize: 13 }}>از تمامی اطلاعات ذخیره‌شده در دیتابیس نسخه پشتیبان (JSON) تهیه کنید. رمز عبور کاربران در فایل نیست. بازیابی از طریق سرور انجام می‌شود (npm run import).</p>
              <div className="toolbar mt-2">
                <button className="btn btn-primary" onClick={handleBackup}><FiDownload /> دانلود نسخه پشتیبان</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)} title={editingUser ? 'ویرایش کاربر' : 'ایجاد کاربر جدید'} size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setUserModalOpen(false)}>انصراف</button>
            <button className="btn btn-primary" onClick={handleSaveUser}>{editingUser ? 'ذخیره تغییرات' : 'ایجاد کاربر'}</button>
          </>
        }
      >
        <div className="form-field mb-2"><label>نام کامل</label><input className="text-input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="مثال: احمد محمدی" /></div>
        <div className="form-field mb-2"><label>نام کاربری</label><input className="text-input" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="مثال: ahmad" /></div>
        <div className="form-field mb-2"><label>رمز عبور</label><input type="password" className="text-input" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder={editingUser ? 'خالی بگذارید تا تغییر نکند' : 'حداقل ۶ کاراکتر'} /></div>
        <div className="form-field"><label>نقش</label>
          <select className="select-input" value={newUser.role} disabled={!!editingUser && editingUser.id === currentUser?.id} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
            <option value="">انتخاب نقش</option>
            {roles.map((r) => <option key={r.id} value={r.name}>{r.label}</option>)}
          </select>
        </div>
      </Modal>

      <Modal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={editingRole ? 'ویرایش نقش' : 'نقش جدید'} size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRoleModalOpen(false)}>انصراف</button>
            <button className="btn btn-primary" onClick={handleSaveRole}><FiSave /> ذخیره نقش</button>
          </>
        }
      >
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div className="form-field"><label>نام نقش (لاتین)</label><input className="text-input" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="مثال: Supervisor" /></div>
          <div className="form-field"><label>عنوان نقش (فارسی)</label><input className="text-input" value={roleForm.label} onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })} placeholder="مثال: ناظر" /></div>
        </div>

        <div className="export-label mb-1">دسترسی‌ها</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.keys(PAGE_LABELS).map((k) => (
            <button key={k} onClick={() => setPage(k)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                background: page === k ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: page === k ? '#fff' : 'var(--color-text)',
              }}
            >{PAGE_LABELS[k]}</button>
          ))}
        </div>

        {page && roleForm.permissions[page] && (
          <div style={{ padding: 14, borderRadius: 12, background: 'var(--color-surface-2)' }}>
            <div className="flex-between mb-2">
              <strong style={{ fontSize: 13.5 }}>{PAGE_LABELS[page]}</strong>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-outline" onClick={() => setAllView(page, true)}>انتخاب همه</button>
                <button className="btn btn-sm btn-outline" onClick={() => setAllView(page, false)}>لغو همه</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(roleForm.permissions[page]).map(([action, value]) => (
                <label key={action} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={value} onChange={() => togglePagePerm(page, action)}
                    style={{ width: 17, height: 17, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                  {ACTION_LABELS[action] || action}
                </label>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
