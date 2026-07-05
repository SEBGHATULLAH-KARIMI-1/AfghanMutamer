import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function RequirePermission({ page, action = 'view', children }) {
  const { can, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!can(page, action)) return <Navigate to="/" replace />
  return children
}
