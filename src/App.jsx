import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import RequirePermission from './components/common/RequirePermission'
import Layout from './components/layout/Layout'

import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Pilgrims from './pages/Pilgrims'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Employees from './pages/Employees'
import Expenses from './pages/Expenses'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<RequirePermission page="dashboard"><Dashboard /></RequirePermission>} />
                  <Route path="pilgrims" element={<RequirePermission page="pilgrims"><Pilgrims /></RequirePermission>} />
                  <Route path="payments" element={<RequirePermission page="payments"><Payments /></RequirePermission>} />
                  <Route path="reports" element={<RequirePermission page="reports"><Reports /></RequirePermission>} />
                  <Route path="employees" element={<RequirePermission page="employees"><Employees /></RequirePermission>} />
                  <Route path="expenses" element={<RequirePermission page="expenses"><Expenses /></RequirePermission>} />
                  <Route path="settings" element={<RequirePermission page="settings"><Settings /></RequirePermission>} />
                </Route>
              </Routes>
            </BrowserRouter>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
