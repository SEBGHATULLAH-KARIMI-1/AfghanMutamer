import { useRef, useState, useEffect } from 'react'
import { FiSave, FiUpload, FiDownload, FiMoon, FiSun, FiUserPlus, FiKey, FiDroplet, FiShield, FiTrash2, FiEdit2, FiPlus, FiX } from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { storage } from '../utils/storage'
import Modal from '../components/common/Modal'
import { useAuth } from '../contexts/AuthContext'

const COLOR_THEMES = [
  { key: 'default', label: 'سبز / طلایی', colors: ['#0F5132', '#D4AF37'] },
  { key: 'blue', label: 'آبی / نقره‌ای', colors: ['#1A365D', '#A0AEC0'] },
  { key: 'emerald', label: 'زمرد / کهربایی', colors: ['#064E3B', '#F59E0B'] },
  { key: 'burgundy', label: 'یاقوتی / طلایی', colors: ['#7B1A1A', '#D4AF37'] },
  { key: 'slate', label: 'تیره / نقره‌ای', colors: ['#334155', '#94A3B8'] },
]

const SIDEBAR_STYLES = [
  { key: 'gradient', label: 'گرادینت' },
  { key: 'solid', label: 'تک‌رنگ' },
  { key: 'glass', label: 'شیشه‌ای' },
]

const PAGE_LABELS = {
  dashboard: 'داشبورد',
  pilgrims: 'زائران',
  payments: 'پرداخت‌ها',
  reports: 'گزارش‌ها',
  employees: 'کارمندان',
  expenses: 'مصارف',
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
  const { settings, updateSettings } = useData()
  const { theme, toggleTheme, appearance, updateAppearance } = useTheme()
  const { showToast } = useToast()
  const { user: currentUser } = useAuth()
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState(settings || {})
  const fileInputRef = useRef(null)
  const restoreInputRef = useRef(null)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: '' })
  const [roles, setRoles] = useState([])
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', label: '', permissions: DEFAULT_PERMISSIONS })
  const [users, setUsers] = useState([])
  const [page, setPage] = useState('dashboard')

  useEffect(() => { setRoles(storage.getAll(storage.KEYS.ROLES)) }, [])
  useEffect(() => { setUsers(storage.getAll(storage.KEYS.USERS)) }, [])

  function refreshRoles() {
    const r = storage.getAll(storage.KEYS.ROLES)
    setRoles(r)
    return r
  }

  function refreshUsers() {
    const u = storage.getAll(storage.KEYS.USERS)
    setUsers(u)
  }

  function userCountForRole(roleName) {
    return users.filter((u) => u.role === roleName).length
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }))
    reader.readAsDataURL(file)
  }

  function handleSaveGeneral() {
    updateSettings(form)
    showToast('تنظیمات عمومی ذخیره شد', 'success')
  }

  function handleBackup() {
    const backup = storage.exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hajj-umrah-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('فایل پشتیبان دانلود شد', 'success')
  }

  function handleRestore(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        storage.restoreBackup(data)
        showToast('بازیابی اطلاعات با موفقیت انجام شد. صفحه را بازخوانی کنید.', 'success')
      } catch {
        showToast('فایل پشتیبان نامعتبر است', 'error')
      }
    }
    reader.readAsText(file)
  }

  function handleCreateUser() {
    if (!newUser.username || !newUser.password || !newUser.name || !newUser.role) {
      showToast('لطفا تمامی فیلدها را تکمیل کنید', 'error')
      return
    }
    const allUsers = storage.getAll(storage.KEYS.USERS)
    storage.saveAll(storage.KEYS.USERS, [...allUsers, { ...newUser, id: Date.now().toString() }])
    showToast('کاربر جدید با موفقیت ایجاد شد', 'success')
    setUserModalOpen(false)
    refreshUsers()
    setNewUser({ username: '', password: '', name: '', role: '' })
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

  function handleSaveRole() {
    if (!roleForm.name || !roleForm.label) {
      showToast('نام و عنوان نقش را وارد کنید', 'error')
      return
    }
    if (roles.some((r) => r.name === roleForm.name && (!editingRole || editingRole.name !== roleForm.name))) {
      showToast('این نام نقش قبلاً ثبت شده است', 'error')
      return
    }
    const allRoles = storage.getAll(storage.KEYS.ROLES)
    if (editingRole) {
      const idx = allRoles.findIndex((r) => r.id === editingRole.id)
      if (idx !== -1) {
        allRoles[idx] = { ...allRoles[idx], ...roleForm, id: editingRole.id }
        storage.saveAll(storage.KEYS.ROLES, allRoles)
        showToast('نقش ویرایش شد', 'success')
      }
    } else {
      allRoles.push({ ...roleForm, id: Date.now().toString() })
      storage.saveAll(storage.KEYS.ROLES, allRoles)
      showToast('نقش جدید ایجاد شد', 'success')
    }
    refreshRoles()
    setRoleModalOpen(false)
  }

  function handleDeleteRole(role) {
    const count = userCountForRole(role.name)
    if (count > 0) {
      showToast(`امکان حذف نقش وجود ندارد. ${count} کاربر با این نقش ثبت شده است.`, 'error')
      return
    }
    if (!confirm(`آیا از حذف نقش «${role.label}» اطمینان دارید؟`)) return
    const allRoles = storage.getAll(storage.KEYS.ROLES).filter((r) => r.id !== role.id)
    storage.saveAll(storage.KEYS.ROLES, allRoles)
    refreshRoles()
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
              <div className="form-field"><label>نام شرکت</label><input className="text-input" value={form.companyName || ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
              <div className="form-field"><label>شماره تماس</label><input className="text-input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="form-field full"><label>آدرس</label><input className="text-input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="form-field"><label>ایمیل</label><input type="email" className="text-input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
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
            <button className="btn btn-primary btn-sm" onClick={() => setUserModalOpen(true)}><FiUserPlus /> کاربر جدید</button>
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
                <label>زبان سیستم</label>
                <select className="select-input">
                  <option value="fa">فارسی / دری</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="form-field mb-2">
                <label>ارز پیش‌فرض نمایش</label>
                <select className="select-input" value={settings.displayCurrency || 'دالر'} onChange={(e) => updateSettings({ displayCurrency: e.target.value })}>
                  <option value="دالر">دالر</option>
                  <option value="افغانی">افغانی</option>
                </select>
                <span style={{ fontSize: 11, color: '#667085' }}>همه مبالغ در کارت‌های آماری و نمودارها به این ارز نمایش داده می‌شوند</span>
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
            <div className="card-header"><h3>پشتیبان‌گیری از اطلاعات</h3></div>
            <div className="card-body">
              <p className="text-muted" style={{ fontSize: 13 }}>از تمامی اطلاعات ذخیره شده در سیستم نسخه پشتیبان تهیه کرده یا اطلاعات قبلی را بازیابی کنید.</p>
              <div className="toolbar mt-2">
                <button className="btn btn-primary" onClick={handleBackup}><FiDownload /> دانلود نسخه پشتیبان</button>
                <button className="btn btn-outline" onClick={() => restoreInputRef.current.click()}><FiUpload /> بازیابی اطلاعات</button>
                <input ref={restoreInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleRestore} />
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)} title="ایجاد کاربر جدید" size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setUserModalOpen(false)}>انصراف</button>
            <button className="btn btn-primary" onClick={handleCreateUser}>ایجاد کاربر</button>
          </>
        }
      >
        <div className="form-field mb-2"><label>نام کامل</label><input className="text-input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></div>
        <div className="form-field mb-2"><label>نام کاربری</label><input className="text-input" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /></div>
        <div className="form-field mb-2"><label>رمز عبور</label><input type="password" className="text-input" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
        <div className="form-field"><label>نقش</label>
          <select className="select-input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
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
