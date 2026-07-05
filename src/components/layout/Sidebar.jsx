import { NavLink } from 'react-router-dom'
import {
  FiGrid, FiUsers, FiCreditCard, FiBarChart2, FiUserCheck, FiSettings, FiMoon, FiShoppingCart,
} from 'react-icons/fi'
import { FaMosque } from 'react-icons/fa'
import { useData } from '../../contexts/DataContext'
import { useAuth } from '../../contexts/AuthContext'

const MENU = [
  { to: '/', label: 'داشبورد', icon: <FiGrid />, end: true, page: 'dashboard' },
  { to: '/pilgrims', label: 'زائران', icon: <FiUsers />, page: 'pilgrims' },
  { to: '/payments', label: 'پرداخت‌ها', icon: <FiCreditCard />, page: 'payments' },
  { to: '/reports', label: 'گزارش‌ها', icon: <FiBarChart2 />, page: 'reports' },
  { to: '/employees', label: 'کارمندان', icon: <FiUserCheck />, page: 'employees' },
  { to: '/expenses', label: 'مصارف روزانه', icon: <FiShoppingCart />, page: 'expenses' },
  { to: '/settings', label: 'تنظیمات', icon: <FiSettings />, page: 'settings' },
]

export default function Sidebar({ open, onNavigate }) {
  const { settings } = useData()
  const { can } = useAuth()
  const visible = MENU.filter((item) => can(item.page, 'view'))

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onNavigate} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="islamic-pattern" />
          <h1>
            <FaMosque style={{ marginInlineEnd: 8, color: 'var(--color-secondary)' }} />
            {settings?.companyName ? settings.companyName : 'سیستم مدیریت حج و عمره'}
          </h1>
          <span>پنل مدیریت یکپارچه</span>
        </div>
        <nav className="sidebar-nav">
          {visible.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              دسترسی به هیچ صفحه‌ای ندارید
            </div>
          )}
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <FiMoon style={{ marginInlineEnd: 6 }} />
          نسخه ۱.۰.۰ — کلیه حقوق محفوظ است
        </div>
      </aside>
    </>
  )
}
