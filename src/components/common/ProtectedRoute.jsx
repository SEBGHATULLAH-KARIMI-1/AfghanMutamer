import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>در حال بارگذاری...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}
