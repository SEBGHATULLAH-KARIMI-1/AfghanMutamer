import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FiMenu, FiSun, FiMoon, FiBell, FiLogOut, FiChevronDown } from 'react-icons/fi'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const TITLES = {
  '/': 'داشبورد',
  '/pilgrims': 'مدیریت زائران',
  '/payments': 'مدیریت پرداخت‌ها',
  '/reports': 'گزارش‌ها',
  '/employees': 'مدیریت کارمندان',
  '/expenses': 'مصارف و عواید روزانه',
  '/settings': 'تنظیمات سیستم',
}

export default function Navbar({ onToggleSidebar }) {
  const { theme, toggleTheme } = useTheme()
  const { user, logout, getRoleLabel } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const title = TITLES[location.pathname] || 'سیستم مدیریت'

  function handleLogout() {
    logout()
    showToast('با موفقیت خارج شدید', 'info')
    navigate('/login')
  }

  const notifications = [
    { id: 1, text: 'پرداخت جدید ثبت شد', time: '۵ دقیقه پیش' },
    { id: 2, text: 'زائر جدید اضافه شد', time: '۲ ساعت پیش' },
    { id: 3, text: 'کاروان شماره C-112 آماده حرکت است', time: 'دیروز' },
  ]

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="icon-btn hamburger-btn" onClick={onToggleSidebar} aria-label="منو">
          <FiMenu />
        </button>
        <span className="navbar-title">{title}</span>
      </div>
      <div className="navbar-right">
        <button className="icon-btn" onClick={toggleTheme} title="تغییر حالت نمایش">
          {theme === 'light' ? <FiMoon /> : <FiSun />}
        </button>

        <div style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={() => setNotifOpen((v) => !v)} title="اعلان‌ها">
            <FiBell />
          </button>
          {notifOpen && (
            <div className="card glass" style={{ position: 'absolute', insetInlineEnd: 0, top: 48, width: 280, zIndex: 60, padding: 0 }}>
              <div className="card-header"><h3>اعلان‌ها</h3></div>
              <div>
                {notifications.map((n) => (
                  <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                    <div>{n.text}</div>
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button className="navbar-user" onClick={() => setMenuOpen((v) => !v)}>
            <span className="avatar">{user?.name?.charAt(0) || 'ک'}</span>
            <span style={{ textAlign: 'right' }}>
              <div className="name">{user?.name || 'کاربر سیستم'}</div>
              <div className="role">{user ? getRoleLabel(user.role) : ''}</div>
            </span>
            <FiChevronDown style={{ fontSize: 13 }} />
          </button>
          {menuOpen && (
            <div className="card" style={{ position: 'absolute', insetInlineEnd: 0, top: 50, width: 180, zIndex: 60, padding: 8 }}>
              <button className="btn btn-outline btn-block" onClick={handleLogout}>
                <FiLogOut /> خروج از سیستم
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
