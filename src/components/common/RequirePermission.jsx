import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import EmptyState from './EmptyState'

// ترتیب صفحه‌ها برای هدایت کاربر به اولین صفحه‌ای که اجازه‌ی دیدنش را دارد
const PAGE_PATHS = [
  ['dashboard', '/'],
  ['pilgrims', '/pilgrims'],
  ['payments', '/payments'],
  ['reports', '/reports'],
  ['employees', '/employees'],
  ['companies', '/companies'],
  ['expenses', '/expenses'],
  ['settings', '/settings'],
]

export default function RequirePermission({ page, action = 'view', children }) {
  const { can, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!can(page, action)) {
    // هدایت به صفحه‌ی دیگری که دسترسی دارد (هدایت به خودِ داشبورد حلقه‌ی بی‌پایان می‌ساخت)
    const next = PAGE_PATHS.find(([p]) => p !== page && can(p, 'view'))
    if (next) return <Navigate to={next[1]} replace />
    return <EmptyState title="دسترسی ندارید" description="نقش شما به هیچ صفحه‌ای دسترسی ندارد. با مدیر سیستم تماس بگیرید." />
  }
  return children
}
